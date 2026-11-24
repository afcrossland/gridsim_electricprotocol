"""Refuse oversized request bodies before anything reads or parses them."""

from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Message, Receive, Scope, Send

MAX_BODY_BYTES = 1_000_000


class BodySizeLimit:
    """Cloud Run itself allows 32 MB bodies; nothing the gate accepts comes near this limit."""

    def __init__(self, app: ASGIApp, max_bytes: int = MAX_BODY_BYTES) -> None:
        self.app = app
        self.max_bytes = max_bytes

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        declared = dict(scope["headers"]).get(b"content-length", b"")
        if declared.isdigit() and int(declared) > self.max_bytes:
            await self._refuse(scope, receive, send)
            return

        # A chunked body declares no length: read it up to the limit, then hand it on.
        body = b""
        more = declared == b"" and scope["method"] in ("POST", "PUT", "PATCH", "DELETE")
        replay: list[Message] = []
        while more:
            message = await receive()
            replay.append(message)
            if message["type"] != "http.request":
                break
            body += message.get("body", b"")
            if len(body) > self.max_bytes:
                await self._refuse(scope, receive, send)
                return
            more = message.get("more_body", False)

        async def replayed() -> Message:
            return replay.pop(0) if replay else await receive()

        await self.app(scope, replayed, send)

    async def _refuse(self, scope: Scope, receive: Receive, send: Send) -> None:
        await JSONResponse({"detail": "That request is too large."}, status_code=413)(scope, receive, send)
