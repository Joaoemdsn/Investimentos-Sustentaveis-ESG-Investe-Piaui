"""Create a source ZIP without local environments, builds or private records."""

import argparse
import hashlib
import io
import csv
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parents[1]
EXCLUDED = {".git", ".openai", ".venv", "venv", "build", "__pycache__", "instance"}


def distributable(path):
    relative = path.relative_to(ROOT)
    if relative.as_posix() == "MANIFEST.csv":
        return False
    if any(part in EXCLUDED for part in relative.parts):
        return False
    if relative.parts[:2] == ("data", "private"):
        return False
    if relative.parts[:2] == ("data", "raw") and relative.name != "README.md":
        return False
    return not path.name.startswith(".env") and path.suffix not in (".pyc", ".pyo")


def package(destination):
    destination = Path(destination).resolve()
    destination.parent.mkdir(parents=True, exist_ok=True)
    entries = []
    for path in sorted(ROOT.rglob("*")):
        if path.is_file() and not path.is_symlink() and distributable(path) and path.resolve() != destination:
            entries.append((path.relative_to(ROOT).as_posix(), path.read_bytes()))
    manifest = io.StringIO(newline="")
    writer = csv.writer(manifest)
    writer.writerow(["arquivo", "bytes", "sha256"])
    for name, content in entries:
        writer.writerow([name, len(content), hashlib.sha256(content).hexdigest()])
    entries.append(("MANIFEST.csv", manifest.getvalue().encode("utf-8")))
    with zipfile.ZipFile(destination, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for name, content in entries:
            info = zipfile.ZipInfo("piaui-em-perspectiva/" + name, date_time=(2026, 11, 10, 0, 0, 0))
            info.external_attr = 0o100644 << 16
            info.compress_type = zipfile.ZIP_DEFLATED
            archive.writestr(info, content, compresslevel=9)
    return destination


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--output", type=Path, default=ROOT / "build/releases/Piaui_em_Perspectiva_GitHub.zip"
    )
    print(package(parser.parse_args().output))
