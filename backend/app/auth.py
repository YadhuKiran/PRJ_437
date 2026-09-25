"""JWT auth + RBAC. Passwords: PBKDF2-HMAC-SHA256 (stdlib, no extra deps)."""
import hashlib
import secrets
import datetime
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from .config import JWT_SECRET, JWT_EXPIRES_MINUTES
from .database import get_db
from .models import User

security = HTTPBearer()


def hash_password(password: str, salt: str) -> str:
    return hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 200_000).hex()


def create_user(db: Session, username: str, password: str, role: str) -> User:
    if len(password or "") < 8:
        raise ValueError("Password must be at least 8 characters")
    if len(username or "") < 3:
        raise ValueError("Username must be at least 3 characters")
    salt = secrets.token_hex(16)
    user = User(username=username, password_hash=hash_password(password, salt), salt=salt, role=role)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def change_password(db: Session, user: User, old_password: str, new_password: str) -> None:
    if not verify_password(old_password, user):
        raise ValueError("Current password is incorrect")
    if len(new_password or "") < 8:
        raise ValueError("New password must be at least 8 characters")
    salt = secrets.token_hex(16)
    user.salt = salt
    user.password_hash = hash_password(new_password, salt)
    db.commit()


def verify_password(password: str, user: User) -> bool:
    return hash_password(password, user.salt) == user.password_hash


def create_token(user: User) -> str:
    payload = {
        "sub": user.username,
        "uid": user.id,
        "role": user.role,
        "exp": datetime.datetime.utcnow() + datetime.timedelta(minutes=JWT_EXPIRES_MINUTES),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


def get_current_user(
    creds: HTTPAuthorizationCredentials = Depends(security), db: Session = Depends(get_db)
) -> User:
    try:
        payload = jwt.decode(creds.credentials, JWT_SECRET, algorithms=["HS256"])
        user = db.query(User).filter(User.id == payload["uid"]).first()
        if not user:
            raise ValueError("unknown user")
        return user
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")


def require_roles(*roles: str):
    def checker(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(status_code=403, detail="Forbidden: insufficient role")
        return user

    return checker
