import pytest


@pytest.fixture(autouse=True)
def fresh_state():
    """Payload copies and submission counts live in module memory: start each test without any."""
    from ep_db import api, review

    api.clear_cached_payloads()
    review._recent.clear()
    review._peers.clear()
    yield
