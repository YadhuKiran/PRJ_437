"""Seed demo users: admin / handler / viewer. Run: python -m app.seed (from backend/)."""
from .database import Base, engine, SessionLocal
from .models import User
from .auth import create_user

Base.metadata.create_all(bind=engine)
db = SessionLocal()
for username, password, role in [
    ("admin", "Admin123!", "admin"),
    ("handler", "Handler123!", "case_handler"),
    ("viewer", "Viewer123!", "viewer"),
]:
    if not db.query(User).filter(User.username == username).first():
        create_user(db, username, password, role)
        print(f"created {username} ({role})")
    else:
        print(f"exists {username}")
db.close()
