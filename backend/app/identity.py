"""Firebase ID token → PandaHat user.

Linking order on each request (first match wins):
1. a `user_identities` row with this Firebase uid (the normal case after first sign-in);
2. a row with the same GitHub account id (e.g. the Firebase project was recreated);
3. an existing user with the same email: a PM added them on Team before they
   signed in, so their first GitHub sign-in links to that account automatically;
4. otherwise a new user: an admin if the email is in BOOTSTRAP_ADMIN_EMAILS,
   or if the database has no users yet; everyone else is PENDING until a PM approves.
"""

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from functools import lru_cache

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import bootstrap_admin_emails, get_settings
from app.users.domain import AccessStatus, Commitment, ResearchStatus, Role
from app.users.models import User, UserIdentity


class InvalidTokenError(Exception):
    pass


@dataclass(frozen=True)
class FirebaseClaims:
    uid: str
    email: str | None
    email_verified: bool
    name: str | None
    picture: str | None
    github_user_id: int | None
    sign_in_provider: str | None


@lru_cache
def _request():
    # Imported lazily so dev mode and the test suite don't need network-capable transports.
    from google.auth.transport import requests as google_requests

    return google_requests.Request()  # caches Google's signing certificates between calls


def verify_firebase_token(token: str) -> FirebaseClaims:
    """Checks signature, expiry, issuer and audience (our Firebase project)."""
    from google.oauth2 import id_token

    try:
        claims = id_token.verify_firebase_token(token, _request(), audience=get_settings().FIREBASE_PROJECT_ID)
    except Exception as exc:  # google-auth raises ValueError / TransportError subclasses
        raise InvalidTokenError(str(exc)) from exc
    if not claims or not claims.get("sub"):
        raise InvalidTokenError("Token has no subject")
    return claims_from_dict(claims)


def claims_from_dict(claims: dict) -> FirebaseClaims:
    firebase = claims.get("firebase") or {}
    github_ids = (firebase.get("identities") or {}).get("github.com") or []
    try:
        github_user_id = int(github_ids[0]) if github_ids else None
    except (TypeError, ValueError):
        github_user_id = None
    return FirebaseClaims(
        uid=claims["sub"],
        email=(claims.get("email") or None),
        email_verified=bool(claims.get("email_verified")),
        name=claims.get("name"),
        picture=claims.get("picture"),
        github_user_id=github_user_id,
        sign_in_provider=firebase.get("sign_in_provider"),
    )


def _trusted_email(claims: FirebaseClaims) -> str | None:
    """GitHub only exposes addresses its user has verified, and Firebase marks
    them unverified anyway, so a GitHub sign-in's email is trusted for linking."""
    if claims.email and (claims.email_verified or claims.sign_in_provider == "github.com"):
        return claims.email.lower()
    return None


def _avatar(url: str | None) -> str | None:
    return url if url and url.startswith("https://") else None


def resolve_user(db: Session, claims: FirebaseClaims) -> User:
    for attempt in range(2):
        try:
            return _resolve(db, claims)
        except IntegrityError:
            # Two first-sign-in requests raced (the app fires several queries at once).
            # The other one won; roll back and pick up the row it created.
            db.rollback()
            if attempt:
                raise
    raise AssertionError("unreachable")


def _resolve(db: Session, claims: FirebaseClaims) -> User:
    now = datetime.now(UTC)
    identity = db.scalar(select(UserIdentity).where(UserIdentity.firebase_uid == claims.uid))
    if identity is None and claims.github_user_id is not None:
        identity = db.scalar(select(UserIdentity).where(UserIdentity.github_user_id == claims.github_user_id))
        if identity is not None:
            identity.firebase_uid = claims.uid
    if identity is not None:
        # Touch at most once a minute so normal requests don't write.
        if (now - identity.last_sign_in_at).total_seconds() > 60:
            identity.last_sign_in_at = now
            db.commit()
        elif db.dirty:
            db.commit()
        return db.get(User, identity.user_id)

    email = _trusted_email(claims)
    user = db.scalar(select(User).where(func.lower(User.email) == email)) if email else None
    if user is None:
        is_first_user = not db.scalar(select(func.count()).select_from(User))
        is_bootstrap_admin = email is not None and email in bootstrap_admin_emails()
        approved = is_first_user or is_bootstrap_admin
        user = User(
            user_id=uuid.uuid4(),
            display_name=(claims.name or (email or "New member").split("@")[0])[:120],
            # Users need a unique email; GitHub accounts with a hidden email get a placeholder
            # the PM can see on the approval screen.
            email=email or f"{claims.uid}@users.noreply.pandahat",
            is_email_verified=email is not None,
            role=Role.ADMIN if approved else Role.RESEARCHER,
            research_status=ResearchStatus.RESEARCH if approved else ResearchStatus.LEARNING_PATH,
            commitment=Commitment.FULL_TIME if approved else Commitment.SHADOW,
            access_status=AccessStatus.APPROVED if approved else AccessStatus.PENDING,
        )
        db.add(user)
        db.flush()
    if user.avatar_url is None:
        user.avatar_url = _avatar(claims.picture)
    db.add(
        UserIdentity(
            user_id=user.user_id,
            firebase_uid=claims.uid,
            github_user_id=claims.github_user_id,
            email=email,
        )
    )
    db.commit()
    return user


def record_github_login(db: Session, user: User, login: str) -> None:
    """The ID token has the GitHub numeric id but not the username; the browser
    sends it after sign-in. Cosmetic only (shown on Team), never used for access."""
    identity = db.scalar(
        select(UserIdentity)
        .where(UserIdentity.user_id == user.user_id, UserIdentity.github_user_id.is_not(None))
        .order_by(UserIdentity.last_sign_in_at.desc())
        .limit(1)
    )
    if identity is not None and identity.github_login != login:
        identity.github_login = login
        db.commit()
