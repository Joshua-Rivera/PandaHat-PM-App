"""Who is calling?

Two modes, chosen by AUTH_MODE:

- "dev": the caller names itself with an `X-Dev-User-Id` header (the frontend's
  "Viewing as" switcher). Anyone can impersonate anyone, so config.py refuses
  this mode when ENVIRONMENT=production.
- "firebase": the browser signs in with GitHub through Firebase Authentication
  and sends `Authorization: Bearer <Firebase ID token>`. We verify the token's
  signature, issuer and audience with Google's public keys on every request,
  then map it to a PandaHat user (app/identity.py links or creates one).

People whose GitHub account isn't recognised are created PENDING. They can read
/me (to see the waiting screen) and nothing else until a PM approves them.
"""

from typing import Annotated

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app import identity
from app.config import get_settings
from app.db import get_db
from app.users.domain import MANAGER_ROLES
from app.users.models import User


def _dev_user(db: Session, x_dev_user_id: str | None) -> User:
    import uuid

    try:
        user_id = uuid.UUID(x_dev_user_id or "")
    except ValueError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing or invalid X-Dev-User-Id")
    user = db.get(User, user_id)
    if user is None or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Unknown user")
    return user


def _firebase_user(db: Session, authorization: str | None) -> User:
    scheme, _, token = (authorization or "").partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED, "Sign in required", headers={"WWW-Authenticate": "Bearer"}
        )
    try:
        claims = identity.verify_firebase_token(token)
    except identity.InvalidTokenError:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED, "Your session has expired. Sign in again.", headers={"WWW-Authenticate": "Bearer"}
        )
    user = identity.resolve_user(db, claims)
    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This account has been deactivated")
    return user


def get_signed_in_user(
    db: Annotated[Session, Depends(get_db)],
    x_dev_user_id: Annotated[str | None, Header()] = None,
    authorization: Annotated[str | None, Header()] = None,
) -> User:
    """Any signed-in account, including ones still waiting for PM approval."""
    if get_settings().is_dev_auth:
        return _dev_user(db, x_dev_user_id)
    return _firebase_user(db, authorization)


def get_current_user(user: Annotated[User, Depends(get_signed_in_user)]) -> User:
    """An approved member. Every router depends on this."""
    if not user.is_approved:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Your account is waiting for a project manager to approve it")
    return user


def require_role(*roles: str):
    def checker(user: Annotated[User, Depends(get_current_user)]) -> User:
        if user.role not in roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Insufficient role")
        return user

    return checker


SignedInUser = Annotated[User, Depends(get_signed_in_user)]
CurrentUser = Annotated[User, Depends(get_current_user)]
# PM-only endpoints. Enforced here, on the server: hiding a button in React is UX, not security.
ManagerUser = Annotated[User, Depends(require_role(*MANAGER_ROLES))]
