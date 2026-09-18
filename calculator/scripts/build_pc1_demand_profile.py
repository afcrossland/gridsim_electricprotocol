"""
Builds a normalised 8760-hour PC1 (Domestic Unrestricted) demand SHAPE from
Elexon's own published half-hourly load profile coefficients.

Source: Elexon "Electricity user load profiles by profile class" dataset,
hosted openly on the UKERC Energy Data Centre / CEDA Archive (Open Access):
https://dap.ceda.ac.uk/edc/d1/5af8ae29-86a7-4e8c-9fe4-1e2d99d9fb96/data/version_0/data/ProfileClass1.csv

That CSV gives average kW for each of the 48 half-hourly settlement periods,
split by 5 Elexon "seasons" (Autumn/High Summer/Summer/Spring/Winter) and 3
day types (Weekday/Saturday/Sunday) - a real, GB-settlement-grade domestic
demand SHAPE (not the annual total, which this repo's own DEMAND_BAND_KWH
presets still supply - see demandProfile.ts).

This script is a one-off generator, not run at build/dev time - its output
(src/data/pc1-demand-profile.json) is committed and imported directly.

Simplifications (flagged - this is still a placeholder per ROADMAP.md):
- Season boundaries are approximated by calendar month, not Elexon's actual
  clock-change/bank-holiday-anchored boundaries.
- Day type (Wd/Sat/Sun) uses the real day-of-week for calendar year 2026
  (the reference year this app's own 365-day HourlyProfile convention
  already assumes elsewhere, e.g. WorldMap's irradiance database) -
  bank holidays are not treated as non-weekdays.
- Only Profile Class 1 (Domestic Unrestricted) is used - PC2 (Economy 7)
  and all non-domestic classes are not built.
"""
import csv
import datetime
import json
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
CSV_PATH = SCRIPT_DIR / "ProfileClass1.csv"
OUT_PATH = SCRIPT_DIR.parent / "src" / "data" / "pc1-demand-profile.json"

# Elexon's 5 seasons, approximated to whole calendar months.
MONTH_SEASON = {
    11: "Wtr", 12: "Wtr", 1: "Wtr", 2: "Wtr",
    3: "Spr", 4: "Spr",
    5: "Smr", 6: "Smr",
    7: "Hsr", 8: "Hsr",
    9: "Aut", 10: "Aut",
}

DAY_TYPE_SUFFIX = {0: "Wd", 1: "Wd", 2: "Wd", 3: "Wd", 4: "Wd", 5: "Sat", 6: "Sun"}


def load_periods():
    with open(CSV_PATH, newline="") as f:
        reader = csv.DictReader(f)
        rows = list(reader)
    assert len(rows) == 48, f"expected 48 half-hourly periods, got {len(rows)}"
    return rows


def main():
    rows = load_periods()

    hourly = [0.0] * 8760
    start = datetime.date(2026, 1, 1)  # non-leap year, matches this app's own 365-day convention
    for day_of_year in range(365):
        date = start + datetime.timedelta(days=day_of_year)
        season = MONTH_SEASON[date.month]
        day_type = DAY_TYPE_SUFFIX[date.weekday()]
        column = f"{season} {day_type}"

        for hour in range(24):
            period_a = rows[hour * 2][column]
            period_b = rows[hour * 2 + 1][column]
            kw_avg = (float(period_a) + float(period_b)) / 2
            hourly[day_of_year * 24 + hour] = kw_avg  # kWh for this 1-hour slice

    total = sum(hourly)
    normalised = [round(v / total, 9) for v in hourly]

    print(f"total before normalising (kWh, arbitrary scale): {total:.2f}")
    print(f"normalised sum: {sum(normalised):.6f}")
    print(f"peak hour fraction: {max(normalised):.6f}, min: {min(normalised):.6f}")

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT_PATH, "w") as f:
        json.dump(normalised, f)
    print(f"wrote {OUT_PATH} ({OUT_PATH.stat().st_size / 1024:.1f} KB)")


if __name__ == "__main__":
    main()
