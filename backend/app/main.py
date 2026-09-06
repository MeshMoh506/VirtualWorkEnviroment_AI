from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import Base, engine
from app.routers import agents, auth, tasks, users

app = FastAPI(title="Venv API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten before demo/deploy
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(tasks.router)
app.include_router(agents.router)


@app.on_event("startup")
def on_startup():
    # Dev convenience: creates tables if they don't exist. Once the schema
    # stabilizes, switch to `alembic upgrade head` in the startup/deploy
    # script instead and drop this.
    Base.metadata.create_all(bind=engine)


@app.get("/health")
def health():
    return {"status": "ok"}
