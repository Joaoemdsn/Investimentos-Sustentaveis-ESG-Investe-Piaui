"""Generate a portable static website (including GitHub Pages subpaths)."""

import argparse
import json
from pathlib import Path
import shutil
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from backend.repositories.csv_repository import CsvRepository
from backend.services.offline import offline_html
from backend.domain.internal import referral_indicator


def build(destination=None):
    destination = Path(destination) if destination else ROOT / "build/static"
    destination.mkdir(parents=True, exist_ok=True)
    source = ROOT / "frontend"
    shutil.copytree(source / "assets", destination / "assets", dirs_exist_ok=True)
    for name in ("index.html", "contexto.html"):
        html = (
            (source / name).read_text(encoding="utf-8").replace('data-runtime="api"', 'data-runtime="static"')
        )
        (destination / name).write_text(html, encoding="utf-8")
    repository = CsvRepository(ROOT / "data")
    (destination / "data").mkdir(exist_ok=True)
    for name in ("finance", "fne", "atlas"):
        (destination / "data" / f"{name}.json").write_text(
            json.dumps(getattr(repository, name)(), ensure_ascii=False, separators=(",", ":")),
            encoding="utf-8",
        )
    (destination / "data/internal.json").write_text(
        json.dumps(
            referral_indicator(repository.internal_projects(), **repository.internal_period()),
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    for page, name in (("finance", "offline.html"), ("context", "contexto-offline.html")):
        (destination / name).write_text(offline_html(repository, source, page), encoding="utf-8")
    (destination / ".nojekyll").touch()
    return destination


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    print(f"Site estático gerado: {build(args.output)}")
