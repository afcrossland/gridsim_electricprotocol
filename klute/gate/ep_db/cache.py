"""One shared, ready-to-send copy of the large public responses.

Building every country's hourly profiles takes seconds and over 100 MB, and the CDN in front keys on
the query string, so without this any visitor could make the gate rebuild it as often as they liked.
Each payload is built by one request at a time, kept gzipped for TTL_S (the CDN's own s-maxage), and
then rebuilt by a single request while the rest get the copy just gone stale. With no copy yet, a few
requests wait for the first build and the others are told to come back: the sites fall back to their
bundled JSON on a 503.
"""

import gzip
import json
import threading
import time
from collections.abc import Callable
from typing import Any

TTL_S = 300
MAX_WAITERS = 4
WAIT_S = 25


class Busy(Exception):
    """Nothing to serve yet and enough requests are already waiting for the first build."""


class CachedPayload:
    def __init__(self, ttl_s: float = TTL_S) -> None:
        self._ttl_s = ttl_s
        self._build_lock = threading.Lock()
        self._waiters = threading.BoundedSemaphore(MAX_WAITERS)
        self._copy: tuple[str, float, bytes] | None = None  # key, built at, gzipped JSON

    def clear(self) -> None:
        self._copy = None

    def get(self, key: str, build: Callable[[], Any]) -> bytes:
        """Gzipped JSON of `build()`. `key` is the source (the database URL): a change drops the copy.

        Raises whatever `build` raises; a failed build is never kept.
        """
        copy = self._current(key)
        if copy and not self._stale(copy):
            return copy[2]
        if self._build_lock.acquire(blocking=False):
            return self._build_and_release(key, build)
        if copy:
            return copy[2]
        if not self._waiters.acquire(blocking=False):
            raise Busy
        try:
            if not self._build_lock.acquire(timeout=WAIT_S):
                raise Busy
            return self._build_and_release(key, build)
        finally:
            self._waiters.release()

    def _current(self, key: str) -> tuple[str, float, bytes] | None:
        copy = self._copy
        return copy if copy and copy[0] == key else None

    def _stale(self, copy: tuple[str, float, bytes]) -> bool:
        return time.monotonic() - copy[1] > self._ttl_s

    def _build_and_release(self, key: str, build: Callable[[], Any]) -> bytes:
        try:
            copy = self._current(key)
            if copy and not self._stale(copy):
                return copy[2]  # built while this request waited
            # The same encoding as starlette's JSONResponse.
            text = json.dumps(build(), ensure_ascii=False, allow_nan=False, separators=(",", ":"))
            body = gzip.compress(text.encode(), compresslevel=6, mtime=0)
            self._copy = (key, time.monotonic(), body)
            return body
        finally:
            self._build_lock.release()
