"""Who may change the policy data (ROADMAP.md, Phase 2; decision 2).

Editors sign in with Google through Firebase Auth in the Policy Explorer, and send the resulting
Firebase ID token as `Authorization: Bearer <token>`. Every write endpoint depends on
`require_editor`, which checks the token's signature, expiry and audience against this Firebase
project and the email against POLICY_EDITOR_EMAILS. Fails closed: no list means no editors.

The same Firebase project and web app as the /klute gate, so one sign-in setup covers both.
"""

import os

from fastapi import Depends, Header, HTTPException
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token


def editor_emails() -> set[str]:
    return {e.strip().lower() for e in os.environ.get("POLICY_EDITOR_EMAILS", "").split(",") if e.strip()}


def verify_firebase_token(token: str) -> dict:
    """Checks signature, expiry, issuer and audience. Patched in tests."""
    return id_token.verify_firebase_token(token, google_requests.Request(), audience=os.environ["FIREBASE_PROJECT_ID"])


def require_editor(authorization: str = Header(default="")) -> str:
    """The signed-in editor's email, or 401 (no/invalid sign-in) / 403 (not an editor)."""
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(401, "Sign in to make changes.")
    try:
        claims = verify_firebase_token(token)
    except Exception:
        raise HTTPException(401, "Your sign-in couldn't be verified - sign in again.") from None
    email = str(claims.get("email", "")).lower()
    if not claims.get("email_verified") or email not in editor_emails():
        raise HTTPException(403, f"{email or 'This account'} can't edit the policy data.")
    return email


Editor = Depends(require_editor)
