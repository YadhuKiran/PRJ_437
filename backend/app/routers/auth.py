from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import User
from ..schemas import RegisterIn, LoginIn, TokenOut
from ..auth import create_user, verify_password, create_token, get_current_user, require_roles
from ..audit import audit

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=TokenOut)
def register(body: RegisterIn, db: Session = Depends(get_db)):
    # Bootstrap: first user ever can self-register (becomes admin). Afterwards, admin-only.
    user_count = db.query(User).count()
    if user_count > 0:
        # require admin for subsequent registrations
        from fastapi.security import HTTPBearer  # noqa — keeps import graph simple

        raise HTTPException(status_code=403, detail="Registration is admin-only after bootstrap")
    if body.role not in ("admin", "case_handler", "viewer"):
        raise HTTPException(status_code=400, detail="Invalid role")
    user = create_user(db, body.username, body.password, body.role or "admin")
    audit(db, "user_register", actor_id=user.id, actor_role=user.role, details={"username": user.username})
    return TokenOut(access_token=create_token(user), role=user.role, username=user.username)


@router.post("/create-staff", response_model=dict)
def create_staff(body: RegisterIn, admin: User = Depends(require_roles("admin")), db: Session = Depends(get_db)):
    if body.role not in ("admin", "case_handler", "viewer"):
        raise HTTPException(status_code=400, detail="Invalid role")
    if db.query(User).filter(User.username == body.username).first():
        raise HTTPException(status_code=400, detail="Username exists")
    user = create_user(db, body.username, body.password, body.role)
    audit(db, "staff_created", actor_id=admin.id, actor_role=admin.role,
          details={"created_username": user.username, "role": user.role})
    return {"username": user.username, "role": user.role}


@router.post("/login", response_model=TokenOut)
def login(body: LoginIn, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == body.username).first()
    if not user or not verify_password(body.password, user):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    audit(db, "login", actor_id=user.id, actor_role=user.role, details={"username": user.username})
    return TokenOut(access_token=create_token(user), role=user.role, username=user.username)


@router.get("/me", response_model=dict)
def me(user: User = Depends(get_current_user)):
    return {"username": user.username, "role": user.role, "id": user.id}
