"""Shared helper for calling Ember's official Data API
(https://api.ember-energy.org/v1) - used by build_ember_solar.py's monthly
leg and build_ember_generation.py, both migrated off Ember's public CSV
downloads onto the API 2026-09-10. Not a script of its own to run directly
- imported, hence the leading underscore, matching this directory's other
underscore-prefixed non-script files (the download caches).

Confirmed by inspection against https://api.ember-energy.org/v1/openapi.json
and live test calls: `/installed-capacity/monthly` and
`/electricity-generation/yearly` each return full history in one call (no
pagination needed - 2871 and 5267 rows respectively as of 2026-09-10), and
`stats.rate_limit` reports "No" for this key. There is no
`/installed-capacity/yearly` endpoint (confirmed both via the OpenAPI spec
and a live call, which 404s) - that is why the broader annual-capacity
data build_ember_solar.py's second leg needs still comes from Ember's CSV,
not the API.
"""

import json
import os
import subprocess
import urllib.parse
from pathlib import Path

API_BASE = "https://api.ember-energy.org/v1"

# French overseas departments - Ember (via ISO 3166-1) gives these their own
# plain alpha-2 code (GF, GP, MQ, RE), but this app's own map geometry
# splits them out as exclaves of France under "FR-XX" codes instead (see
# scripts/build_geometry.py's EXCLAVES and the root README's "Overseas
# exclaves" section). Shared between build_ember_solar.py and
# build_ember_generation.py, which both need it - remapped so their real
# data lands on a mappable jurisdiction rather than silently going nowhere.
FR_EXCLAVE_REMAP = {"GF": "FR-GF", "GP": "FR-GP", "MQ": "FR-MQ", "RE": "FR-RE", "YT": "FR-YT"}


def iso3_to_iso2(iso3: str):
    """Alpha-3 -> alpha-2, with the French-exclave remap above applied. None if pycountry doesn't recognise it."""
    import pycountry

    try:
        country = pycountry.countries.get(alpha_3=iso3)
        if not country:
            return None
        return FR_EXCLAVE_REMAP.get(country.alpha_2, country.alpha_2)
    except (LookupError, AttributeError):
        return None


def api_key() -> str:
    """EMBER_API_KEY from the environment, or deployment/.env (gitignored -
    see that file) if not set there. Andrew's own key, given 2026-09-10."""
    env_var = os.environ.get("EMBER_API_KEY")
    if env_var:
        return env_var
    env_path = Path(__file__).resolve().parent.parent / ".env"
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            if line.startswith("EMBER_API_KEY="):
                return line.split("=", 1)[1].strip()
    raise RuntimeError(
        "EMBER_API_KEY not set - export it, or add it to deployment/.env "
        "(gitignored). Register for a key at https://ember-energy.org/data/api/."
    )


def fetch(endpoint: str, **params: str | None) -> list[dict]:
    """GETs one endpoint with the given query params, returns its `data` array.

    Shells out to curl rather than urllib - this machine's Python doesn't
    have a usable CA bundle configured (SSLCertVerificationError on plain
    urllib.request.urlopen against any HTTPS host), a pre-existing
    environment quirk hit repeatedly by this project's other import
    scripts, not specific to Ember's API.
    """
    query = {k: v for k, v in params.items() if v is not None}
    query["api_key"] = api_key()
    url = f"{API_BASE}{endpoint}?{urllib.parse.urlencode(query)}"
    result = subprocess.run(
        ["curl", "-s", "--max-time", "60", url],
        capture_output=True,
        text=True,
        check=True,
    )
    payload = json.loads(result.stdout)
    if "data" not in payload:
        raise RuntimeError(f"Unexpected API response from {endpoint}: {payload}")
    return payload["data"]
