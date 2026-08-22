"""Shared text normalisation for generated data files.

Not a package init - imported directly by the sibling scripts via sys.path,
since this repo has no shared Python package structure yet.
"""

import re

# "CERs" collapses to a mass noun ("technology"), same as its singular, which
# reads naturally in both cases: "connecting CERs" and "a CER" both become
# "behind-the-meter technology" / "a piece of behind-the-meter technology"
# territory, but the plain phrase alone reads fine in every sentence we have.
_CER_RE = re.compile(r"\bCERs?\b")
_CP_PLURAL_RE = re.compile(r"\bCPs\b")
_CP_SINGULAR_RE = re.compile(r"\bCP\b")


def humanize(text: str) -> str:
    """Replace the CER/CP acronyms with the plain-language terms the app uses.

    CERs -> "behind-the-meter technology" (the Charter's own definition).
    CPs  -> "customers", CP -> "customer".
    """
    text = _CER_RE.sub("behind-the-meter technology", text)
    text = _CP_PLURAL_RE.sub("customers", text)
    text = _CP_SINGULAR_RE.sub("customer", text)
    return text
