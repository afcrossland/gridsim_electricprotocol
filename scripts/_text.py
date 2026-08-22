"""Shared text normalisation for generated data files.

Not a package init - imported directly by the sibling scripts via sys.path,
since this repo has no shared Python package structure yet.
"""

import re

# "CER Technology" / "CERs Technology" is CER used as an adjective in front of
# the word it already means, e.g. the section heading "Access to CER
# Technology". Matched and replaced as one phrase first, or the generic rule
# below would leave a duplicate: "behind-the-meter technology Technology".
_CER_TECHNOLOGY_RE = re.compile(r"\bCERs?\s+Technology\b")

# Row 35 of the source spreadsheet spells out "behind the meter" in plain
# English immediately before the acronym: "...generation from behind the
# meter CERs". Matched as one phrase first too, for the same reason as above -
# the generic rule alone would leave "behind the meter behind-the-meter
# technology". Optional hyphens because the sheet is not consistent about it.
_SPELLED_OUT_CER_RE = re.compile(
    r"\bbehind[\s-]the[\s-]meter\s+CERs?\b", re.IGNORECASE
)

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
    text = _CER_TECHNOLOGY_RE.sub("behind-the-meter technology", text)
    text = _SPELLED_OUT_CER_RE.sub("behind-the-meter technology", text)
    text = _CER_RE.sub("behind-the-meter technology", text)
    text = _CP_PLURAL_RE.sub("customers", text)
    text = _CP_SINGULAR_RE.sub("customer", text)
    return text
