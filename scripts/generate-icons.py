#!/usr/bin/env python3
"""Resize assets/icon-source.jpg into the Manifest V3 icon sizes."""

import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets" / "icon-source.jpg"
OUTPUT = ROOT / "public" / "icons"
SIZES = (16, 32, 48, 128)


def main() -> None:
    if not SOURCE.is_file():
        print(f"Missing icon source: {SOURCE}", file=sys.stderr)
        sys.exit(1)
    magick = shutil.which("magick") or shutil.which("convert")
    if not magick:
        print("ImageMagick is required to regenerate icons.", file=sys.stderr)
        sys.exit(1)
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for size in SIZES:
        destination = OUTPUT / f"icon{size}.png"
        subprocess.run(
            [
                magick,
                str(SOURCE),
                "-fuzz",
                "4%",
                "-trim",
                "+repage",
                "-resize",
                f"{size}x{size}",
                "-background",
                "none",
                str(destination),
            ],
            check=True,
        )


if __name__ == "__main__":
    main()
