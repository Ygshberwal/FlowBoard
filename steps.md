# FlowBoard — Step-by-Step Playbook

Compact, ordered tasks to go from a fresh clone to a running app, run tests,
add features, and ship. Pick a path in step 1; the rest is common.

---

## 1. Pick a setup path

| Path                            | Best for                     | You need                                       |
| ------------------------------- | ---------------------------- | ---------------------------------------------- |
| **A — Docker**           | Anyone with Docker Desktop   | Docker 4.x+                                    |
| **B — Native**           | macOS / Linux contributors   | Python 3.11+, Node 18+, Postgres 14+, Redis 7+ |
| **C — Windows portable** | Windows without admin rights | Python 3.11+, Node 18+, ~350 MB free           |

---

## 2. Configure `.env` files (all paths)

```bash
cp .env.example .env
printf "VITE_API_URL=http://localhost:8000\n" > frontend/.env
```

For **native / portable** paths, also create `backend/.env`:

```env
DATABASE_URL=postgresql+asyncpg://flowboard:flowboard@127.0.0.1:5432/flowboard
REDIS_URL=redis://127.0.0.1:6379/0
CORS_ORIGINS=http://localhost:5173,http://localhost:80
```

---

## 3-A. Start with Docker (one command)

```bash
docker compose up --build
```

Migrations + seed run automatically on backend startup. When ready:

- Backend  → http://localhost:8000/docs
- Frontend → http://localhost:5173

Stop with `docker compose down` (add `-v` to wipe the Postgres volume).

---

## 3-B. Start natively (macOS / Linux)

Three terminals. Steps assume Homebrew on macOS; adapt for `apt`, `dnf`, etc.

```bash
# T1 — services
brew install python@3.11 node postgresql@16 redis
brew services start redis
createdb flowboard
psql -d postgres -c "CREATE USER flowboard WITH PASSWORD 'flowboard';"
psql -d postgres -c "GRANT ALL PRIVILEGES ON DATABASE flowboard TO flowboard;"

# T2 — backend
cd backend
python3.11 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8000

# T3 — frontend
cd frontend
npm install
npm run dev
```

---

## 3-C. Start on Windows without admin (portable binaries)

`winget install PostgreSQL...` needs admin and silently hangs otherwise. Use
portable Postgres (EnterpriseDB zip) and portable Redis (tporadowski build).

```powershell
$tmp = "$env:TEMP\flowboard-services"; New-Item -ItemType Directory $tmp -Force | Out-Null

# 3-C.1  Download (~300 MB Postgres + ~12 MB Redis)
Invoke-WebRequest "https://get.enterprisedb.com/postgresql/postgresql-16.6-1-windows-x64-binaries.zip" -OutFile "$tmp\pg.zip"
Invoke-WebRequest "https://github.com/tporadowski/redis/releases/download/v5.0.14.1/Redis-x64-5.0.14.1.zip" -OutFile "$tmp\redis.zip"

# 3-C.2  Extract  (tar is ~10x faster than Expand-Archive on large zips)
tar -xf "$tmp\pg.zip" -C $tmp
Expand-Archive "$tmp\redis.zip" -DestinationPath "$tmp\redis" -Force

# 3-C.3  Init + start Postgres (detached so it survives shell exit)
& "$tmp\pgsql\bin\initdb.exe" -D "$tmp\pgdata" -U postgres --auth=trust --encoding=UTF8
Start-Process "$tmp\pgsql\bin\postgres.exe" `
    -ArgumentList "-D","$tmp\pgdata","-p","5432","-h","127.0.0.1" `
    -RedirectStandardOutput "$tmp\pg.log" -WindowStyle Hidden

# 3-C.4  Start Redis (detached)
Start-Process "$tmp\redis\redis-server.exe" `
    -ArgumentList "--port","6379","--bind","127.0.0.1" `
    -RedirectStandardOutput "$tmp\redis.log" -WindowStyle Hidden

# 3-C.5  Create app DB
& "$tmp\pgsql\bin\psql.exe" -h 127.0.0.1 -U postgres -c "CREATE ROLE flowboard WITH LOGIN PASSWORD 'flowboard';"
& "$tmp\pgsql\bin\psql.exe" -h 127.0.0.1 -U postgres -c "CREATE DATABASE flowboard OWNER flowboard;"

# 3-C.6  Backend  (env vars set here so alembic + uvicorn inherit them)
$env:DATABASE_URL="postgresql+asyncpg://flowboard:flowboard@127.0.0.1:5432/flowboard"
$env:REDIS_URL="redis://127.0.0.1:6379/0"
$env:PYTHONIOENCODING="utf-8"
cd backend
python -m venv .venv; .venv\Scripts\Activate.ps1
pip install -r requirements.txt
alembic upgrade head
python -m uvicorn app.main:app --reload --port 8000

# 3-C.7  Frontend  (new terminal)
cd frontend
npm install
npm run dev
```

---

## 4. Daily dev loop

```bash
# services (skip if already running)
brew services start postgresql@16 redis      # or docker compose up -d postgres redis

# backend  (auto-reload on save)
cd backend && uvicorn app.main:app --reload --port 8000

# frontend (auto-reload on save)
cd frontend && npm run dev
```

---

## 5. Run tests + type-check

```bash
# Backend — 14 pure-Python tests, no DB required
cd backend
pip install -r requirements-dev.txt
pytest

# Frontend — TypeScript compile check
cd frontend && npx tsc --noEmit
```

---

## 6. Common ops

| Task                     | Command (from`backend/`)                                                                                             |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| Create new migration     | `alembic revision --autogenerate -m "<name>"`                                                                        |
| Apply migrations         | `alembic upgrade head`                                                                                               |
| Roll back one migration  | `alembic downgrade -1`                                                                                               |
| Reset DB from scratch    | `dropdb flowboard && createdb flowboard && alembic upgrade head`                                                     |
| Re-run seed data         | Drop all rows in`sections`, `habits`, `tasks` then restart backend (seed runs on lifespan when tables are empty) |
| Flush Redis streak cache | `redis-cli DEL streaks:all`                                                                                          |
| Open API docs            | http://localhost:8000/docs                                                                                             |
| Health check             | `curl http://localhost:8000/api/health`                                                                              |

---

## 7. Deploy

### Railway

Two services declared in `railway.toml` (`backend`, `frontend`), each built
from its own Dockerfile's production target. Set these env vars in the
Railway dashboard:

- `DATABASE_URL` — from Railway Postgres plugin
- `REDIS_URL` — from Railway Redis plugin
- `CORS_ORIGINS` — public frontend URL
- `VITE_API_URL` (frontend service) — public backend URL

Backend healthcheck: `/api/health`.

### Self-hosted with docker-compose

```bash
cp .env.example .env         # fill in real POSTGRES_PASSWORD etc.
docker compose -f docker-compose.prod.yml up -d --build
```

Frontend on port 80 (nginx), backend on 8000, Postgres + Redis internal-only.

---

## 8. Troubleshooting

| Symptom                                                          | Fix                                                                                                                                                                            |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `alembic` fails with `getaddrinfo failed` for `postgres`   | `alembic/env.py` reads `os.getenv("DATABASE_URL")` — the `.env` file is only read by the app process. Export `DATABASE_URL` in your shell before running `alembic`. |
| Backend crashes on startup with`UnicodeEncodeError` on Windows | Set`PYTHONIOENCODING=utf-8` in your shell before starting uvicorn.                                                                                                           |
| `winget install PostgreSQL...` hangs forever with no output    | Your shell isn't elevated. Either relaunch as admin, or use §3-C (portable).                                                                                                  |
| `Expand-Archive` takes >2 minutes on the Postgres zip          | Use`tar -xf` instead — built into Windows 10+, ~10× faster.                                                                                                                |
| `pg_ctl start` server dies as soon as the shell exits          | Use`Start-Process` on `postgres.exe` directly (see §3-C.3). PowerShell kills child processes on tool timeout.                                                             |
| Frontend loads but API calls 404                                 | Check`frontend/.env` has `VITE_API_URL=http://localhost:8000`; restart `npm run dev` after editing.                                                                      |
| Streak endpoint fails when Redis is down                         | Redis is required — start it first. Streak cache lives at key`streaks:all` (TTL 1 h).                                                                                       |
| Tests fail with`ModuleNotFoundError: asyncpg`                  | Install runtime deps too:`pip install -r requirements.txt` (not just `requirements-dev.txt`).                                                                              |
| deplpyment later deplpyment later                                |                                                                                                                                                                                |
