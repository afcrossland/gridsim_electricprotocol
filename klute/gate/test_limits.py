"""Payload cache, body size and submission limits that need no database."""

import gzip
import json
import threading
import time

import pytest
from fastapi.testclient import TestClient

from ep_db import cache as cache_module
from ep_db import review
from ep_db.cache import Busy, CachedPayload
from ep_db.limits import MAX_BODY_BYTES


def _json(body: bytes):
    return json.loads(gzip.decompress(body))


def test_payload_is_built_once_while_fresh():
    built = []
    payload = CachedPayload()
    for _ in range(3):
        assert _json(payload.get("db", lambda: built.append(1) or {"a": 1})) == {"a": 1}
    assert len(built) == 1


def test_another_source_or_an_expired_copy_is_rebuilt():
    payload = CachedPayload(ttl_s=0.05)
    assert _json(payload.get("db1", lambda: 1)) == 1
    assert _json(payload.get("db2", lambda: 2)) == 2
    time.sleep(0.1)
    assert _json(payload.get("db2", lambda: 3)) == 3


def test_a_failed_build_is_not_kept_and_releases_the_lock():
    payload = CachedPayload()

    def boom():
        raise RuntimeError

    with pytest.raises(RuntimeError):
        payload.get("db", boom)
    assert _json(payload.get("db", lambda: 1)) == 1


def test_only_one_request_builds_and_extra_waiters_are_refused(monkeypatch):
    monkeypatch.setattr(cache_module, "WAIT_S", 5)
    payload = CachedPayload()
    started, go, builds, results = threading.Event(), threading.Event(), [], []

    def build():
        builds.append(1)
        started.set()
        go.wait(5)
        return 7

    def request():
        try:
            results.append(_json(payload.get("db", build)))
        except Busy:
            results.append("busy")

    threads = [threading.Thread(target=request) for _ in range(1)]
    threads[0].start()
    started.wait(5)
    threads += [threading.Thread(target=request) for _ in range(cache_module.MAX_WAITERS + 5)]
    for t in threads[1:]:
        t.start()
    deadline = time.time() + 5
    while results.count("busy") < 5 and time.time() < deadline:
        time.sleep(0.01)
    go.set()
    for t in threads:
        t.join(5)
    assert len(builds) == 1
    assert results.count("busy") == 5 and results.count(7) == 1 + cache_module.MAX_WAITERS


def test_a_stale_copy_is_served_while_one_request_rebuilds():
    payload = CachedPayload(ttl_s=0.05)
    payload.get("db", lambda: "old")
    time.sleep(0.1)
    started, go = threading.Event(), threading.Event()

    def slow():
        started.set()
        go.wait(5)
        return "new"

    builder = threading.Thread(target=lambda: payload.get("db", slow))
    builder.start()
    started.wait(5)
    assert _json(payload.get("db", lambda: "never")) == "old"
    go.set()
    builder.join(5)
    assert _json(payload.get("db", lambda: "never")) == "new"


@pytest.fixture
def client():
    import main

    return TestClient(main.app)


def test_oversized_bodies_are_refused(client):
    big = b"x" * (MAX_BODY_BYTES + 1)
    assert client.post("/api/policy/suggestions", content=big).status_code == 413
    chunks = (b"x" * 100_000 for _ in range(MAX_BODY_BYTES // 100_000 + 2))
    assert client.post("/api/policy/suggestions", content=chunks).status_code == 413


def test_a_chunked_body_within_the_limit_still_reaches_the_app(client):
    r = client.post("/api/policy/suggestions", content=iter([b"{", b"}"]), headers={"Content-Type": "application/json"})
    assert r.status_code == 422  # parsed, and missing its fields


class _Request:
    def __init__(self, forwarded):
        self.headers = {"x-forwarded-for": forwarded}
        self.client = None


def _outcomes(forwarded, n):
    out = []
    for i in range(n):
        try:
            review._rate_limit(_Request(forwarded(i)))
            out.append("ok")
        except review.HTTPException as e:
            out.append(e.status_code)
    return out


def test_faked_visitor_addresses_still_hit_the_connecting_address_limit():
    # Straight to run.app: the caller picks the first entry, Google's front end appends the real one.
    out = _outcomes(lambda i: f"203.0.113.{i}, 198.51.100.7", review.PEER_RATE_LIMIT + 5)
    assert out == ["ok"] * review.PEER_RATE_LIMIT + [429] * 5


def test_visitors_behind_the_same_hosting_address_have_their_own_limit():
    assert _outcomes(lambda i: "192.0.2.1, 142.250.0.1", review.RATE_LIMIT + 1)[-1] == 429
    assert _outcomes(lambda i: "192.0.2.2, 142.250.0.1", 1) == ["ok"]


def test_remembered_addresses_are_bounded(monkeypatch):
    monkeypatch.setattr(review, "MAX_TRACKED", 50)
    _outcomes(lambda i: f"a{i}, b{i}", 500)
    assert len(review._recent) <= 50 and len(review._peers) <= 50
