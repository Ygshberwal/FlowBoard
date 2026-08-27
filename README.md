# FlowBoard

FlowBoard is a habit tracker and daily planner app with a FastAPI backend and a React + Vite frontend.

This guide explains how to run it locally without Docker.

## Requirements

- Python 3.11+
- Node.js 18+
- PostgreSQL 14+ or 15+
- Redis 7+
- npm

### macOS (Homebrew)

If you are on macOS, you can install the local services with:

```bash
brew install postgresql redis node
brew services start postgresql
brew services start redis
```

## 1. Clone and enter the project

```bash
git clone <your-repo-url>
cd flowboard
```

## 2. Backend setup

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Create a local environment file at `backend/.env`:

```env
DATABASE_URL=postgresql+asyncpg://flowboard:flowboard@localhost:5432/flowboard
REDIS_URL=redis://localhost:6379/0
CORS_ORIGINS=http://localhost:5173,http://localhost:80,https://flowboard-fontend.vercel.app
```

If your local PostgreSQL uses different credentials, update the `DATABASE_URL` to match your setup.

Create the database locally:

```bash
createdb flowboard
```

If your PostgreSQL user is not `flowboard`, create it first or adjust the connection string accordingly.

Run the database migrations:

```bash
alembic upgrade head
```

Start the backend:

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The API should be available at:

- http://localhost:8000/docs
- http://localhost:8000/api/health

## 3. Frontend setup

Open a new terminal and run:

```bash
cd frontend
npm install
```

Create a local environment file at `frontend/.env`:

```env
VITE_API_URL=http://localhost:8000
```

Start the frontend:

```bash
npm run dev
```

The app should be available at:

- http://localhost:5173

## 4. Dependencies

### Backend dependencies

The backend dependencies are listed in `backend/requirements.txt` and include:

- FastAPI
- Uvicorn
- SQLAlchemy with asyncio
- AsyncPG
- Alembic
- Pydantic
- Redis
- python-dotenv
- httpx
- psycopg2-binary

### Frontend dependencies

The frontend dependencies are listed in `frontend/package.json` and include:

- React
- React DOM
- Vite
- TypeScript
- Tailwind CSS
- Axios
- Zustand
- TanStack React Query
- date-fns

## Troubleshooting

- If the backend cannot connect to PostgreSQL, verify the `DATABASE_URL` and that PostgreSQL is running.
- If Redis errors appear, make sure Redis is running locally on port `6379`.
- If the frontend cannot reach the API, confirm that `VITE_API_URL` points to the backend URL.
