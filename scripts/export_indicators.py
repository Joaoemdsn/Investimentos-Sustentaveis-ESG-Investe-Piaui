"""Prepare analytical CSVs from the same domain functions used by the API."""

import csv
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from backend.repositories.csv_repository import CsvRepository
from backend.domain import fne, climate
from scripts.validate_data import validate


def write(path, rows):
    with path.open("w", encoding="utf-8", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)


def export(destination=None):
    repo = CsvRepository(ROOT / "data")
    validate(repo)
    destination = Path(destination) if destination else ROOT / "build/reports"
    destination.mkdir(parents=True, exist_ok=True)
    indicators = []
    for year in fne.YEARS:
        for group in fne.GROUPS:
            for comparison in ("NE", "FNE"):
                result = fne.summary(repo.fne(), year, group, comparison)
                indicators.append(
                    {
                        k: v
                        for k, v in result.items()
                        if k not in ("sector_distribution", "size_distribution", "partial_years")
                    }
                )
                indicators[-1]["includes_partial_2023"] = int(bool(result["partial_years"]))
    write(destination / "indicadores_fne.csv", indicators)
    indicators = []
    for year in fne.YEARS:
        for sector in climate.SECTORS:
            for comparison in ("NE", "BR"):
                result = climate.summary(repo.finance(), year, sector, comparison=comparison)
                indicators.append(
                    {
                        k: v
                        for k, v in result.items()
                        if k not in ("sector_distribution", "size_distribution", "interstate_mention_records")
                    }
                )
    write(destination / "indicadores_fundo_clima.csv", indicators)
    return destination


if __name__ == "__main__":
    print(f"CSVs analíticos gerados: {export()}")
