import hmac

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel
from ..database import get_db
from ..models import User
from ..schemas import RegisterIn, LoginIn, TokenOut
from ..auth import create_user, verify_password, create_token, get_current_user, require_roles, change_password
from ..audit import audit
from ..config import (
    ALLOW_BOOTSTRAP_ADMIN,
    BOOTSTRAP_ADMIN_TOKEN,
    RATE_LIMIT_LOGIN,
    RATE_LIMIT_WINDOW_S,
)
from ..ratelimit import enforce_rate_limit


router = APIRouter(prefix="/api/auth", tags=["auth"])


class PasswordChangeIn(BaseModel):
    old_password: str = ""
    new_password: str = ""


@router.post("/register", response_model=TokenOut)
def register(body: RegisterIn, request: Request, db: Session = Depends(get_db)):
    """Bootstrap the first administrator.

    Disabled by default. A failed seed must never turn this into a public
    admin-creation endpoint, so it requires BOTH:
      * ALLOW_BOOTSTRAP_ADMIN=1 in the environment, and
      * BOOTSTRAP_ADMIN_TOKEN matching the submitted bootstrap_token.
    Every later registration is admin-only (POST /api/auth/create-staff).
    """
    if not ALLOW_BOOTSTRAP_ADMIN:
        raise HTTPException(
            status_code=403,
            detail="Registration is disabled. Staff accounts are created by an administrator.",
        )
    if db.query(User).count() > 0:
        raise HTTPException(status_code=403, detail="Registration is admin-only after bootstrap")
    if BOOTSTRAP_ADMIN_TOKEN:
        supplied = (body.bootstrap_token or "")
        if not hmac.compare_digest(supplied, BOOTSTRAP_ADMIN_TOKEN):
            raise HTTPException(status_code=403, detail="Invalid bootstrap token")
    else:
        raise HTTPException(
            status_code=503,
            detail="Bootstrap registration is not configured (BOOTSTRAP_ADMIN_TOKEN unset)",
        )
    if body.role not in ("admin", "case_handler", "viewer"):
        raise HTTPException(status_code=400, detail="Invalid role")
    try:
        user = create_user(db, body.username, body.password, body.role or "admin")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    audit(db, "user_register", actor_id=user.id, actor_role=user.role, details={"username": user.username})
    return TokenOut(access_token=create_token(user), role=user.role, username=user.username)



@router.post("/create-staff", response_model=dict)
def create_staff(body: RegisterIn, admin: User = Depends(require_roles("admin")), db: Session = Depends(get_db)):
    if body.role not in ("admin", "case_handler", "viewer"):
        raise HTTPException(status_code=400, detail="Invalid role")
    if db.query(User).filter(User.username == body.username).first():
        raise HTTPException(status_code=400, detail="Username exists")
    try:
        user = create_user(db, body.username, body.password, body.role)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    audit(db, "staff_created", actor_id=admin.id, actor_role=admin.role,
          details={"created_username": user.username, "role": user.role})
    return {"username": user.username, "role": user.role}


@router.post("/login", response_model=TokenOut)
def login(body: LoginIn, request: Request, db: Session = Depends(get_db)):
    """Authenticate a staff member.

    Throttled per client IP *and* per username so a single attacker cannot
    brute-force one account, and so one noisy client cannot exhaust the
    budget of every other account.
    """
    enforce_rate_limit(
        request,
        scope="login",
        limit=RATE_LIMIT_LOGIN,
        window_s=RATE_LIMIT_WINDOW_S,
        message="Too many sign-in attempts. Please wait a minute and try again.",
        extra_key=body.username or "",
    )
    user = db.query(User).filter(User.username == body.username).first()
    if not user or not verify_password(body.password, user):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    audit(db, "login", actor_id=user.id, actor_role=user.role, details={"username": user.username})
    return TokenOut(access_token=create_token(user), role=user.role, username=user.username)


@router.get("/me", response_model=dict)
def me(user: User = Depends(get_current_user)):
    return {"username": user.username, "role": user.role, "id": user.id}


@router.post("/change-password", response_model=dict)
def change_my_password(body: PasswordChangeIn, user: User = Depends(get_current_user),
                       db: Session = Depends(get_db)):
    """Authenticated password change. Never logs passwords."""
    try:
        # Re-attach to this request's session (get_current_user used its own).
        db_user = db.query(User).filter(User.id == user.id).first()
        if not db_user:
            raise HTTPException(status_code=404, detail="User not found")
        change_password(db, db_user, body.old_password, body.new_password)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    audit(db, "password_changed", actor_id=user.id, actor_role=user.role,
          details={"username": user.username})
    return {"ok": True}
