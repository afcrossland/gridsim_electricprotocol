"""The /klute sign-in gate.

Firebase Hosting serves the public explorers as static files and rewrites every /klute/** request
to this Cloud Run service. Nothing under /klute is served until the visitor has signed in with
Google (Firebase Auth) as an email on KLUTE_ALLOWED_EMAILS:

- not signed in: any page request gets the sign-in page; anything else gets 401.
- POST /klute/session: verifies the Firebase ID token from the sign-in page and, if the email is
  allowed, sets a signed `__session` cookie (the only cookie Firebase Hosting forwards).
- signed in: /klute/** serves the klute build (the image bundles it; it is not on public
  hosting), and /klute/api/** is proxied to the simulator backend with the backend's klute
  password added here, so the password never reaches a browser.

The allowlist is re-checked on every request, so removing an email takes effect on the next
deploy of this service even for an existing session.
"""

import base64
import hashlib
import hmac
import json
import os
import time
from pathlib import Path

import httpx
from fastapi import FastAPI, Request, Response
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, RedirectResponse
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token

COOKIE = "__session"
SESSION_SECONDS = 12 * 60 * 60
# Firebase Hosting's CDN caches Cloud Run responses that allow it. Every response here depends
# on who is asking, so none of them may be cached.
NO_STORE = {"Cache-Control": "private, no-store"}

STATIC_DIR = Path(os.environ.get("KLUTE_STATIC_DIR", Path(__file__).parent / "static")).resolve()
LOGIN_HTML = (Path(__file__).parent / "login.html").read_text()


def _allowed_emails() -> set[str]:
    return {e.strip().lower() for e in os.environ.get("KLUTE_ALLOWED_EMAILS", "").split(",") if e.strip()}


def _session_key() -> bytes:
    # Fails closed: without a key no cookie can be issued or accepted.
    key = os.environ.get("KLUTE_SESSION_KEY", "")
    if not key:
        raise RuntimeError("KLUTE_SESSION_KEY is not set")
    return key.encode()


def _sign(payload: bytes) -> str:
    return hmac.new(_session_key(), payload, hashlib.sha256).hexdigest()


def make_cookie(email: str, now: float | None = None) -> str:
    body = json.dumps({"email": email, "exp": int((now or time.time()) + SESSION_SECONDS)}).encode()
    encoded = base64.urlsafe_b64encode(body).decode()
    return f"{encoded}.{_sign(encoded.encode())}"


def session_email(request: Request) -> str | None:
    """The signed-in, still-allowed email for this request, or None."""
    raw = request.cookies.get(COOKIE, "")
    encoded, _, sig = raw.partition(".")
    if not encoded or not sig or not os.environ.get("KLUTE_SESSION_KEY"):
        return None
    if not hmac.compare_digest(sig, _sign(encoded.encode())):
        return None
    try:
        body = json.loads(base64.urlsafe_b64decode(encoded))
    except ValueError:
        return None
    if body.get("exp", 0) < time.time():
        return None
    email = str(body.get("email", "")).lower()
    return email if email in _allowed_emails() else None


def verify_firebase_token(token: str) -> dict:
    """Checks signature, expiry, issuer and audience against this Firebase project."""
    return id_token.verify_firebase_token(token, google_requests.Request(), audience=os.environ["FIREBASE_PROJECT_ID"])


app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)


def _login_page() -> HTMLResponse:
    config = {
        "apiKey": os.environ.get("FIREBASE_API_KEY", ""),
        "authDomain": os.environ.get("FIREBASE_AUTH_DOMAIN", ""),
        "projectId": os.environ.get("FIREBASE_PROJECT_ID", ""),
    }
    return HTMLResponse(LOGIN_HTML.replace("__FIREBASE_CONFIG__", json.dumps(config)), headers=NO_STORE)


@app.get("/klute")
def klute_root() -> Response:
    return RedirectResponse("/klute/", headers=NO_STORE)


@app.post("/klute/session")
async def create_session(request: Request) -> Response:
    try:
        token = (await request.json())["idToken"]
        claims = verify_firebase_token(token)
    except Exception:
        return JSONResponse({"error": "Sign-in could not be verified."}, status_code=401, headers=NO_STORE)
    email = str(claims.get("email", "")).lower()
    if not claims.get("email_verified") or email not in _allowed_emails():
        return JSONResponse({"error": f"{email or 'This account'} does not have access."}, status_code=403, headers=NO_STORE)
    response = JSONResponse({"email": email}, headers=NO_STORE)
    response.set_cookie(COOKIE, make_cookie(email), max_age=SESSION_SECONDS, path="/klute", secure=True, httponly=True, samesite="lax")
    return response


@app.post("/klute/logout")
def logout() -> Response:
    response = JSONResponse({}, headers=NO_STORE)
    response.delete_cookie(COOKIE, path="/klute", secure=True, httponly=True, samesite="lax")
    return response


@app.get("/klute/whoami")
def whoami(request: Request) -> Response:
    email = session_email(request)
    if not email:
        return JSONResponse({"error": "Not signed in."}, status_code=401, headers=NO_STORE)
    return JSONResponse({"email": email}, headers=NO_STORE)


@app.get("/klute/api/{path:path}")
async def proxy(path: str, request: Request) -> Response:
    if not session_email(request):
        return JSONResponse({"error": "Not signed in."}, status_code=401, headers=NO_STORE)
    backend = os.environ.get("FGS_API_BASE_URL", "").rstrip("/")
    if not backend:
        return JSONResponse({"error": "FGS_API_BASE_URL is not set."}, status_code=503, headers=NO_STORE)
    headers = {"X-Klute-Password": os.environ.get("KLUTE_BACKEND_PASSWORD", "")}
    async with httpx.AsyncClient(timeout=55) as client:
        upstream = await client.get(f"{backend}/{path}", params=request.query_params, headers=headers)
    return Response(upstream.content, status_code=upstream.status_code, media_type=upstream.headers.get("content-type"), headers=NO_STORE)


@app.get("/klute/{path:path}")
def static_file(path: str, request: Request) -> Response:
    if not session_email(request):
        # Pages get the sign-in page (it reloads to the same URL once signed in); assets don't.
        if path == "" or path.endswith(".html") or "text/html" in request.headers.get("accept", ""):
            return _login_page()
        return Response(status_code=401, headers=NO_STORE)
    target = (STATIC_DIR / (path or "index.html")).resolve()
    if not target.is_relative_to(STATIC_DIR) or not target.is_file():
        return Response(status_code=404, headers=NO_STORE)
    return FileResponse(target, headers=NO_STORE)
