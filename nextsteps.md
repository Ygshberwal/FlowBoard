# FlowBoard — Multi-User Migration Plan

Turn FlowBoard from a single-user app into a multi-user app with self-serve
registration, login, and per-user data isolation. Deployment is out of scope
here — a separate note lives at the bottom.

This document is written to be handed to an LLM (or a junior dev) and executed
phase-by-phase. Each phase is one commit. Do not skip phases or reorder them.

---

## 0. Goal & success criteria

**Goal:** every FlowBoard user sees only their own sections, tasks, habits,
comments, logs, and streaks. Users self-register with username + email +
password + mobile number + display picture, and authenticate with JWTs.

**Success (all must be true):**

1. `POST /api/auth/register` creates a new user; passwords are stored as
   Argon2 hashes, never plaintext.
2. `POST /api/auth/login` accepts **either** username or email plus password
   and returns an access + refresh token pair.
3. Every existing endpoint under `/api/{tasks,habits,sections,analytics}`
   requires a valid access token and returns 401 without one.
4. Two logged-in users cannot see each other's data. A test spawns user A,
   creates a task, spawns user B, and asserts `GET /api/sections/board`
   for B does not contain A's task.
5. `PATCH /api/auth/me` updates profile fields; `POST /api/auth/me/avatar`
   uploads a new display picture.
6. `POST /api/auth/logout` invalidates the refresh token so it cannot be
   redeemed.
7. Frontend has `/login` and `/register` routes accessible without auth,
   and `/planner` + `/habits` redirect to `/login` when unauthenticated.
8. The user's `dp` shows in the top-nav avatar; a dropdown offers profile
   settings + logout.
9. `pytest` passes with new auth tests included; `tsc --noEmit` passes.

---

## 1. Non-goals (defer to a later ticket)

Explicitly out of scope. Do not implement, do not ask about, do not add
libraries for these:

- Email verification / confirmation links
- Password reset / forgot-password flow
- OAuth / social login (Google, GitHub, etc.)
- Two-factor authentication
- Rate limiting on login (recommend leaving a TODO comment only)
- Admin panel / user management UI
- Organizations, teams, sharing, roles beyond "user"
- httpOnly-cookie session strategy (we use localStorage tokens for now — see §3)
- S3 / cloud storage for avatars (local disk only)
- Deployment (separate ticket)

---

## 2. Architecture decisions (locked)

Do not debate these — they are chosen for simplicity and speed of delivery.

| Concern                              | Decision                                                                                                                                                                                                                 |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Auth protocol                        | JWT access token + refresh token                                                                                                                                                                                         |
| Signing algorithm                    | HS256 (symmetric; single`JWT_SECRET`)                                                                                                                                                                                  |
| Access token TTL                     | 15 minutes                                                                                                                                                                                                               |
| Refresh token TTL                    | 7 days                                                                                                                                                                                                                   |
| Refresh revocation                   | Redis set`revoked_refresh:{jti}` with TTL = remaining lifetime                                                                                                                                                         |
| Password hashing                     | Argon2id via`argon2-cffi`                                                                                                                                                                                              |
| Token library                        | `PyJWT`                                                                                                                                                                                                                |
| Token storage on client              | `localStorage` (both access + refresh). Document the XSS tradeoff in a code comment; do not switch to cookies.                                                                                                         |
| Avatar storage                       | Local disk at`backend/uploads/avatars/{user_id}.{ext}`, served via FastAPI static mount at `/api/uploads/avatars/…`. `backend/uploads/` is gitignored.                                                            |
| Ownership model                      | App-level filtering — every query for section/habit is filtered by`user_id`. Tasks inherit ownership through their section; comments through their task; habit logs and streaks through their habit. No Postgres RLS. |
| Migration strategy for existing data | **Wipe + reseed on migration.** Existing data was seeded/demo. See §5.                                                                                                                                            |
| Username policy                      | 3-32 chars,`[a-zA-Z0-9_.-]`, unique, case-insensitive stored lowercase                                                                                                                                                 |
| Email policy                         | Validated with`email-validator`, unique, case-insensitive stored lowercase                                                                                                                                             |
| Password policy                      | Minimum 8 chars. That's it — no complexity rules (bad UX, weak security value).                                                                                                                                         |
| Mobile format                        | E.164 (`+1234567890`), validated with a simple regex `^\+[1-9]\d{6,14}$`                                                                                                                                             |

---

## 3. New data model

### 3.1 New table: `users`

```sql
CREATE TABLE users (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username       CITEXT NOT NULL UNIQUE,          -- case-insensitive
    email          CITEXT NOT NULL UNIQUE,
    password_hash  TEXT   NOT NULL,
    mobile_number  TEXT   NOT NULL,                 -- E.164
    avatar_url     TEXT   NULL,                     -- e.g. /api/uploads/avatars/<uuid>.png
    is_active      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_users_username ON users (username);
CREATE INDEX ix_users_email    ON users (email);
```

**Note:** `CITEXT` requires enabling the extension in the same migration:
`CREATE EXTENSION IF NOT EXISTS citext;`

### 3.2 Add ownership FKs

Add `user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE` to:

- `sections`
- `habits`

Also create index `ix_sections_user_id` and `ix_habits_user_id`.

Tasks, task_comments, habit_logs, and habit_streaks inherit ownership through
their parent, so they do **not** get a `user_id` column. Queries join through
the parent.

### 3.3 Alembic revisions

Create exactly two new revisions:

- `0004_users_and_auth.py` — creates `citext` extension + `users` table
- `0005_add_ownership.py` — adds `user_id` to sections + habits, drops all
  rows from `sections`, `tasks`, `task_comments`, `habits`, `habit_logs`,
  `habit_streaks` first (see §5), then adds NOT NULL columns

---

## 4. API contract

All new endpoints are under `/api/auth/`. All request/response bodies are JSON
unless noted.

| Method | Path                    | Auth   | Body / query                                                | 200 response                                                           | Errors                                         |
| ------ | ----------------------- | ------ | ----------------------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------- |
| POST   | `/api/auth/register`  | none   | `{username, email, password, mobile_number}`              | `{user: UserOut, access_token, refresh_token, token_type: "bearer"}` | 409 if username/email taken, 422 on validation |
| POST   | `/api/auth/login`     | none   | `{identifier, password}` (identifier = username OR email) | same as register                                                       | 401 invalid credentials                        |
| POST   | `/api/auth/refresh`   | none   | `{refresh_token}`                                         | `{access_token, refresh_token, token_type: "bearer"}`                | 401 if refresh expired/revoked                 |
| POST   | `/api/auth/logout`    | bearer | `{refresh_token}`                                         | `204`                                                                | 401                                            |
| GET    | `/api/auth/me`        | bearer | —                                                          | `UserOut`                                                            | 401                                            |
| PATCH  | `/api/auth/me`        | bearer | `{username?, email?, mobile_number?, password?}`          | `UserOut`                                                            | 409, 401, 422                                  |
| POST   | `/api/auth/me/avatar` | bearer | multipart`file` (image/png\|jpeg\|webp, ≤ 2 MB)          | `{avatar_url}`                                                       | 401, 413, 415                                  |

`UserOut` shape:

```json
{ "id": "uuid", "username": "yogesh", "email": "y@x.com",
  "mobile_number": "+91XXXXXXXXXX", "avatar_url": "/api/uploads/avatars/..png",
  "created_at": "...", "updated_at": "..." }
```

**Never** include `password_hash` in any response.

### 4.1 Guarded existing endpoints

Every existing endpoint under `/api/{tasks,habits,sections,analytics}` gains a
`current_user: User = Depends(get_current_user)` param and filters/joins on
`user_id`. Return `401` if the token is missing or invalid, `404` if the
requested row exists but belongs to a different user (do NOT distinguish
"not found" from "not yours" — leaks less info).

### 4.2 JWT payload

```json
{
  "sub": "<user_id>",
  "type": "access" | "refresh",
  "jti": "<random uuid4>",
  "iat": <unix>,
  "exp": <unix>
}
```

Refresh tokens: on logout or refresh-token rotation, add the old `jti` to
Redis at `revoked_refresh:{jti}` with `SETEX` = seconds until `exp`. On every
refresh, check the blocklist first.

---

## 5. Existing-data migration

We are in dev; existing rows are seeded demo data. The `0005_add_ownership`
migration will:

1. Execute `DELETE FROM habit_logs; DELETE FROM habit_streaks; DELETE FROM habits;`
2. Execute `DELETE FROM task_comments; DELETE FROM tasks; DELETE FROM sections;`
3. `ALTER TABLE sections ADD COLUMN user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE`
4. `ALTER TABLE habits   ADD COLUMN user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE`
5. Create the two indexes.

The `seed.py` script becomes a **no-op by default** (users self-register).
Leave the function in place but early-return with a log message. Do not remove
the file.

**Rationale:** the app was not deployed with real user data, and building a
"pick a default owner" flow is more work than it's worth. If the reviewer
disagrees, alternative is documented in §5.1 (do NOT implement it without
approval).

### 5.1 Alternative (do NOT implement unless explicitly asked)

Create a `system` user in `0004_users_and_auth`, then in `0005_add_ownership`
assign all pre-existing sections/habits to that user via a data migration
before adding the NOT NULL constraint.

---

## 6. Phased implementation

Each phase is one commit. Do the phases in order. After each phase, run the
"Gate" and do not proceed until it passes.

---

### Phase 0 — Prep

**Files:** `backend/requirements.txt`, `backend/app/config.py`,
`.env.example`, `.gitignore`

Tasks:

1. Add to `requirements.txt` (pinned versions):
   - `pyjwt==2.9.0`
   - `argon2-cffi==23.1.0`
   - `python-multipart==0.0.9`   (multipart form upload)
   - `email-validator==2.2.0`    (Pydantic EmailStr backend)
   - `pillow==10.4.0`            (optional: validate uploaded image is actually an image)
2. Add to `Settings` in `config.py`:
   - `jwt_secret: str = "change-me-in-dev-only"`
   - `jwt_algorithm: str = "HS256"`
   - `access_token_minutes: int = 15`
   - `refresh_token_days: int = 7`
   - `upload_dir: str = "uploads"`  (relative to backend/)
3. Add matching entries to `.env.example` with placeholder values.
4. Add `backend/uploads/` to `.gitignore`.

**Gate:** `pip install -r requirements.txt` succeeds. `pytest` still passes
(no new tests yet). App still starts.

---

### Phase 1 — User model + registration

**Files:** `backend/app/models/user.py` (new),
`backend/app/models/__init__.py`, `backend/app/schemas/user.py` (new),
`backend/app/services/auth_service.py` (new),
`backend/app/routers/auth.py` (new), `backend/app/main.py`,
`backend/alembic/versions/0004_users_and_auth.py` (new)

Tasks:

1. Create `User` model per §3.1 using SQLAlchemy 2.0 async patterns
   (`Mapped`, `mapped_column`, etc. — match the style of `Task`).
2. Create Pydantic schemas: `UserCreate`, `UserOut`, `UserUpdate`,
   `RegisterRequest`, `LoginRequest`, `TokenPair`, `RefreshRequest`.
3. Create `auth_service`:
   - `hash_password(plain: str) -> str`   (Argon2)
   - `verify_password(plain: str, hashed: str) -> bool`
   - `create_access_token(user_id: UUID) -> str`
   - `create_refresh_token(user_id: UUID) -> tuple[str, str]`  (returns (token, jti))
   - `decode_token(token: str) -> dict`   (raises on invalid/expired)
   - `is_refresh_revoked(jti: str) -> bool`
   - `revoke_refresh(jti: str, exp_unix: int) -> None`
   - `register(db, req: RegisterRequest) -> User`   (handles uniqueness violations → 409)
4. Create `auth` router with `POST /api/auth/register`.
5. Register router in `main.py`.
6. Write alembic migration `0004_users_and_auth.py` — creates `citext`
   extension + `users` table + indexes.

**Gate:**

- `alembic upgrade head` creates the `users` table.
- `curl -X POST /api/auth/register -d '{"username":"a","email":"a@a.co","password":"password","mobile_number":"+911234567890"}'`
  returns 200 with a token pair.
- Trying to register the same username or email again returns 409.
- `pytest` still passes.

---

### Phase 2 — Login + refresh + me

**Files:** `backend/app/services/auth_service.py`,
`backend/app/routers/auth.py`, `backend/app/deps.py` (new)

Tasks:

1. Add to `auth_service`:
   - `authenticate(db, identifier: str, password: str) -> User | None`
     (looks up by username OR email, case-insensitive)
2. Add `deps.py` with FastAPI dependency `get_current_user`:
   - Parse `Authorization: Bearer <token>` header
   - Decode + verify token
   - Reject if type != "access"
   - Load user by `sub`, return; else 401
3. Add router endpoints:
   - `POST /api/auth/login`
   - `POST /api/auth/refresh` (rotates the refresh token — old one revoked)
   - `POST /api/auth/logout`  (revokes given refresh token)
   - `GET /api/auth/me`
   - `PATCH /api/auth/me`

**Gate:**

- Register → login → refresh → logout flow works end-to-end via curl.
- After logout, the same refresh token returns 401 on `/refresh`.
- `GET /api/auth/me` returns the current user; without a token it's 401.
- `PATCH /api/auth/me` with `{password: "new-pass"}` allows login with the
  new password and rejects the old one.

---

### Phase 3 — Add ownership to existing endpoints

**Files:** `backend/app/models/section.py`, `backend/app/models/habit.py`,
all four routers under `backend/app/routers/`, all three services under
`backend/app/services/`, `backend/app/seed.py`,
`backend/alembic/versions/0005_add_ownership.py` (new)

Tasks:

1. Write migration `0005_add_ownership.py` per §5.
2. Add `user_id` field + `owner` relationship to `Section` and `Habit`.
3. In every service function (list, get, create, update, delete for
   sections/habits/tasks; task_service.add_comment; habit_service.toggle_log,
   etc.), accept a `user_id: UUID` argument and filter/scope every query.
   - For sections: `WHERE user_id = :uid`
   - For tasks: `JOIN sections ON tasks.section_id = sections.id WHERE sections.user_id = :uid`
   - For task_comments: join through tasks → sections → user_id
   - For habits: `WHERE user_id = :uid`
   - For habit_logs/streaks: join through habits → user_id
4. In every router, add `current_user: User = Depends(get_current_user)`
   and pass `current_user.id` to the service.
5. Enforce "not yours" → 404 (do not distinguish from actual 404).
6. Update `seed.py` to early-return with a log line.
7. Delete the old `seed()` invocation from `main.py`'s lifespan (users
   self-register; there's nothing to seed until a user exists).
8. Update the existing pytest suite: any test that assumed global data now
   needs a user fixture. Add helpers `create_test_user()` and
   `auth_headers(user)` in `tests/conftest.py`.

**Gate:**

- Every non-auth endpoint returns 401 without a token.
- Two-user isolation test passes: user A creates a section, user B's
  `/api/sections/board` returns `[]`, user B's `GET /api/sections/{A_section_id}`
  returns 404.
- `pytest` still passes (14 old tests + new ones).

---

### Phase 4 — Avatar upload

**Files:** `backend/app/routers/auth.py`, `backend/app/main.py`,
`backend/app/services/auth_service.py`, `backend/uploads/.gitkeep` (new)

Tasks:

1. In `main.py`, mount static: `app.mount("/api/uploads", StaticFiles(directory=settings.upload_dir), name="uploads")`.
2. Add `POST /api/auth/me/avatar`:
   - Accept `UploadFile`
   - Validate content type (`image/png`, `image/jpeg`, `image/webp`) → else 415
   - Validate size ≤ 2 MB (`await file.read()` then check length) → else 413
   - (Optional) Open with Pillow to confirm it's a real image
   - Write to `uploads/avatars/{user_id}.{ext}` (overwrite is fine)
   - Update `user.avatar_url = f"/api/uploads/avatars/{user_id}.{ext}"`
   - Return `{avatar_url}`
3. Ensure `backend/uploads/avatars/` exists at startup (create it in
   `run_migrations` or a separate startup hook).

**Gate:**

- Upload a PNG via curl → `avatar_url` in response resolves to a fetchable
  image at `/api/uploads/avatars/...`.
- Upload a 3 MB file → 413.
- Upload a `.txt` file → 415.

---

### Phase 5 — Frontend auth infrastructure

**Files:** `frontend/src/types/auth.ts` (new),
`frontend/src/api/auth.ts` (new), `frontend/src/store/authStore.ts` (new),
`frontend/src/api/client.ts`

Tasks:

1. Define TS types matching backend schemas (`User`, `LoginRequest`,
   `RegisterRequest`, `TokenPair`).
2. Create `authApi` module with `register`, `login`, `refresh`, `logout`,
   `me`, `updateMe`, `uploadAvatar`.
3. Create `authStore` (Zustand, persisted to localStorage):
   - state: `{user: User | null, accessToken: string | null, refreshToken: string | null}`
   - actions: `setSession`, `clear`, `hydrate`
4. Modify `api/client.ts`:
   - Request interceptor: attach `Authorization: Bearer <accessToken>` if
     present (skip for `/api/auth/register`, `/api/auth/login`,
     `/api/auth/refresh`).
   - Response interceptor: on 401, attempt one refresh; on refresh
     failure, `authStore.clear()` + `window.location.href = "/login"`.

**Gate:**

- Nothing user-visible changes yet — this is scaffolding.
- `tsc --noEmit` still passes.

---

### Phase 6 — Login + Register pages

**Files:** `frontend/src/pages/LoginPage.tsx` (new),
`frontend/src/pages/RegisterPage.tsx` (new)

Tasks:

1. Login page:
   - Fields: `identifier` (username or email), `password`
   - "Register" link to `/register`
   - On submit: `authApi.login()` → `authStore.setSession()` → navigate to
     `/planner`
   - Show inline error on 401
2. Register page:
   - Fields: `username`, `email`, `password`, `mobile_number`, `dp` (file input)
   - Client-side validation matches backend rules (§2)
   - On submit: `authApi.register()` → `authStore.setSession()`.
     If `dp` was selected, then `authApi.uploadAvatar(dp)`. Then navigate.
3. Use existing Tailwind styling (match the visual language of `TopNav`).

**Gate:**

- Manual browser test: register a new user → land on planner → refresh page →
  still logged in. Log out → land on login → log back in.

---

### Phase 7 — Protected routes + 401 handling

**Files:** `frontend/src/App.tsx`, `frontend/src/components/layout/RouteGuard.tsx` (new)

Tasks:

1. Add `RouteGuard` component:
   - If no `accessToken` in `authStore`, redirect to `/login`.
   - Otherwise render `<Outlet />`.
2. Update `App.tsx` route tree:
   - Public: `/login`, `/register`
   - Protected (inside `RouteGuard`): `/planner`, `/habits`
   - Root `/` redirects to `/planner` (RouteGuard bounces unauth users).
3. On app boot, if we have tokens but no user in state, call `authApi.me()`
   to hydrate. If it fails, clear the session.

**Gate:**

- Visiting `/planner` without a token redirects to `/login`.
- After login, `/planner` renders normally.
- Deleting tokens from DevTools + reloading redirects to `/login`.

---

### Phase 8 — User menu in header

**Files:** `frontend/src/components/layout/TopNav.tsx`,
`frontend/src/components/layout/UserMenu.tsx` (new),
`frontend/src/pages/ProfilePage.tsx` (new)

Tasks:

1. Replace the hardcoded `"Y"` avatar with:
   - `<img src={user.avatar_url}>` if set, else initials from `user.username`.
2. Click opens `UserMenu` dropdown with:
   - Username + email
   - "Profile settings" link → `/profile`
   - "Log out" → `authApi.logout()` → `authStore.clear()` → `/login`
3. Add `ProfilePage` — form to update username, email, mobile_number,
   password, and re-upload avatar.

**Gate:**

- Avatar renders after upload. Log out from the dropdown works.
- Profile updates persist across refresh.

---

### Phase 9 — Test coverage

**Files:** `backend/tests/test_auth.py` (new),
`backend/tests/test_ownership.py` (new), `backend/tests/conftest.py`

Tasks:

1. In `conftest.py`, add fixtures:
   - `client` — a `TestClient(app)` (skip lifespan or use dependency overrides)
   - `db_session` — a function-scoped fresh test DB session, rolled back
     after each test (use SAVEPOINT nesting or truncate strategy).
   - `user_a`, `user_b` — two registered users with fresh tokens
2. `test_auth.py` covers:
   - password hash → verify round-trip
   - register → login → me
   - reject duplicate username / email
   - refresh rotation revokes the old refresh
   - logout revokes the refresh
   - `/me` without auth is 401
3. `test_ownership.py` covers:
   - user A creates a section, user B's `/board` doesn't see it
   - user B trying to `GET /api/sections/{A_section_id}` returns 404
   - user A deletes their account (if implemented) → their data cascades
     (skip if delete-account isn't implemented)

Tests may need a real Postgres. Two options: (a) provide a `pytest.fixture`
that spawns a docker container with `testcontainers`, or (b) require the
local Postgres to be running and use a dedicated `flowboard_test` DB.
**Pick (b)** — matches how the app is already run locally, no new deps.

**Gate:** `pytest` — all previous tests + new tests pass.

---

### Phase 10 — Deployment (deferred; do not implement here)

This is a separate ticket. Notes for later:

- Rotate `JWT_SECRET` per environment (never reuse dev secret in prod).
- Migrate avatars from local disk to object storage (S3 / R2 / Supabase).
- Serve backend behind HTTPS (Caddy or nginx TLS termination).
- Set `CORS_ORIGINS` to the public frontend URL only.
- Consider httpOnly-cookie refresh tokens once the auth flow is proven.
- Add rate limiting on `/api/auth/login` (SlowAPI or a WAF).
- Configure Railway (already stubbed in `railway.toml`) with the above env vars.

---

## 7. Prompt to give to an LLM

Copy the block below and paste it as a task, replacing `<phase-number>` with
the phase to work on. Do one phase per task.

```
Follow newupdates.md in this repo. Implement Phase <phase-number> ONLY.

Rules:
1. Do NOT implement any phase before or after <phase-number>.
2. Obey the architecture decisions in §2 verbatim — do not substitute
   libraries, algorithms, or token strategies.
3. Match the existing coding style (async SQLAlchemy 2.0 `Mapped` syntax,
   Pydantic v2 `ConfigDict`, TanStack Query, Zustand, Tailwind).
4. Before you touch anything, read: newupdates.md, backend/app/main.py,
   backend/app/database.py, backend/app/config.py, and one existing
   router/service/model/schema quartet (e.g. sections) to mirror the style.
5. Every new file must have zero unused imports and pass tsc/pytest as
   applicable.
6. When the phase is complete, run the "Gate" checks listed for that phase
   and paste the output.
7. Do NOT proceed to the next phase automatically — stop and hand back.
8. If you find something in newupdates.md that is ambiguous or blocks you,
   stop and ask ONE clarifying question instead of guessing.

Deliverables at the end of your turn:
- A short summary of files created/modified/deleted
- The full "Gate" output (test runs, curl outputs, etc.)
- A one-line diff summary from `git diff --stat`
```

---

## 8. Checklist for the human review at end of Phase 3

Before merging Phase 3, manually verify (browser or curl):

- [ ] Two browser profiles / two curl sessions with two different users
- [ ] Each user's `/api/sections/board` contains only their own sections
- [ ] Deleting user A's account (if implemented later) cascades to their tasks
- [ ] Redis: `KEYS revoked_refresh:*` shows revocations after logout
- [ ] Postgres: `SELECT COUNT(*) FROM users;` matches registered count
- [ ] No endpoint returns `password_hash` in its response body
- [ ] No log line contains a password or a full JWT
