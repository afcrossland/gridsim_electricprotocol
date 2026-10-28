"""Tests for the /klute sign-in gate. Run: python -m pytest klute/gate (needs no network)."""

import os
import time

import httpx
import pytest
from fastapi.testclient import TestClient

import main


@pytest.fixture
def client(monkeypatch, tmp_path):
    (tmp_path / "index.html").write_text("<p>klute app</p>")
    (tmp_path / "assets").mkdir()
    (tmp_path / "assets" / "app.js").write_text("console.log(1)")
    (tmp_path.parent / "secret.txt").write_text("outside")
    monkeypatch.setattr(main, "STATIC_DIR", tmp_path.resolve())
    monkeypatch.setenv("KLUTE_SESSION_KEY", "test-key")
    monkeypatch.setenv("KLUTE_ALLOWED_EMAILS", "Ally@Example.org, bo@example.org")
    monkeypatch.setenv("FIREBASE_PROJECT_ID", "proj")
    monkeypatch.setenv("FGS_API_BASE_URL", "https://backend.test")
    monkeypatch.setenv("KLUTE_BACKEND_PASSWORD", "pw")
    # TestClient talks plain http; the real cookie is Secure.
    return TestClient(main.app, base_url="https://testserver")


def sign_in(client, email="ally@example.org"):
    client.cookies.set(main.COOKIE, main.make_cookie(email), path="/klute")


def test_signed_out_page_gets_login_and_asset_gets_401(client):
    page = client.get("/klute/", headers={"accept": "text/html"})
    assert page.status_code == 200 and "Sign in with Google" in page.text
    assert '"projectId": "proj"' in page.text
    assert page.headers["cache-control"] == "private, no-store"
    assert client.get("/klute/assets/app.js").status_code == 401
    assert client.get("/klute/api/coverage/generation").status_code == 401


def test_signed_in_serves_files_and_blocks_traversal(client):
    sign_in(client)
    assert client.get("/klute/").text == "<p>klute app</p>"
    assert client.get("/klute/assets/app.js").status_code == 200
    assert client.get("/klute/assets/app.js").headers["cache-control"] == "private, no-store"
    assert client.get("/klute/..%2Fsecret.txt").status_code == 404
    assert client.get("/klute/missing.js").status_code == 404
    assert client.get("/klute/whoami").json() == {"email": "ally@example.org"}


def test_bare_klute_redirects(client):
    r = client.get("/klute", follow_redirects=False)
    assert r.status_code in (301, 302, 307) and r.headers["location"] == "/klute/"


def test_removed_email_loses_access_and_tampering_fails(client, monkeypatch):
    sign_in(client)
    monkeypatch.setenv("KLUTE_ALLOWED_EMAILS", "bo@example.org")
    assert client.get("/klute/whoami").status_code == 401
    monkeypatch.setenv("KLUTE_ALLOWED_EMAILS", "ally@example.org")
    encoded, sig = main.make_cookie("ally@example.org").split(".")
    client.cookies.set(main.COOKIE, f"{encoded}.{'0' * len(sig)}", path="/klute")
    assert client.get("/klute/whoami").status_code == 401


def test_expired_cookie_and_missing_key_fail_closed(client, monkeypatch):
    client.cookies.set(main.COOKIE, main.make_cookie("ally@example.org", now=time.time() - main.SESSION_SECONDS - 1), path="/klute")
    assert client.get("/klute/whoami").status_code == 401
    sign_in(client)
    monkeypatch.delenv("KLUTE_SESSION_KEY")
    assert client.get("/klute/whoami").status_code == 401


@pytest.mark.parametrize(
    ("claims", "status"),
    [
        ({"email": "ALLY@example.org", "email_verified": True}, 200),
        ({"email": "ally@example.org", "email_verified": False}, 403),
        ({"email": "eve@example.org", "email_verified": True}, 403),
    ],
)
def test_session_needs_verified_allowed_email(client, monkeypatch, claims, status):
    monkeypatch.setattr(main, "verify_firebase_token", lambda token: claims)
    r = client.post("/klute/session", json={"idToken": "t"})
    assert r.status_code == status
    if status == 200:
        cookie = r.headers["set-cookie"]
        assert "HttpOnly" in cookie and "Secure" in cookie and "Path=/klute" in cookie
        assert client.get("/klute/whoami").json() == {"email": "ally@example.org"}


def test_bad_token_is_401(client, monkeypatch):
    def reject(token):
        raise ValueError("bad")

    monkeypatch.setattr(main, "verify_firebase_token", reject)
    assert client.post("/klute/session", json={"idToken": "t"}).status_code == 401


def test_logout_clears_cookie(client):
    sign_in(client)
    r = client.post("/klute/logout")
    assert 'Max-Age=0' in r.headers["set-cookie"] or "expires=" in r.headers["set-cookie"].lower()


def test_proxy_adds_password_server_side(client, monkeypatch):
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["url"] = str(request.url)
        seen["password"] = request.headers.get("x-klute-password")
        return httpx.Response(200, json={"ok": True})

    real_client = httpx.AsyncClient
    monkeypatch.setattr(main.httpx, "AsyncClient", lambda **kw: real_client(transport=httpx.MockTransport(handler), **kw))
    sign_in(client)
    r = client.get("/klute/api/coverage/generation", params={"refresh": "1"})
    assert r.json() == {"ok": True}
    assert seen == {"url": "https://backend.test/coverage/generation?refresh=1", "password": "pw"}
    assert r.headers["cache-control"] == "private, no-store"


if __name__ == "__main__":
    raise SystemExit(pytest.main([os.path.dirname(__file__)]))


def test_large_responses_are_gzipped_only_when_asked(client):
    sign_in(client)
    (main.STATIC_DIR / "big.js").write_text("x" * 5000)
    r = client.get("/klute/big.js", headers={"Accept-Encoding": "gzip"})
    assert r.headers["content-encoding"] == "gzip"
    assert "Accept-Encoding" in r.headers["vary"]
    assert r.text == "x" * 5000
    assert "content-encoding" not in client.get("/klute/big.js", headers={"Accept-Encoding": "identity"}).headers
    assert "content-encoding" not in client.get("/klute/index.html", headers={"Accept-Encoding": "gzip"}).headers
