"""Build the claude.ai artifact version of Tile Week from index.html.

The artifact is the same app. claude.ai wraps the page in its own document, so this keeps only
the parts of index.html marked with <!-- artifact:head --> and <!-- artifact:body -->.

    python3 tools/build_artifact.py   # writes artifact/tile-week.html
"""
from pathlib import Path
import re

root = Path(__file__).resolve().parent.parent
html = (root / "index.html").read_text(encoding="utf-8")


def section(name: str) -> str:
    m = re.search(rf"<!-- {name} -->\n(.*?)<!-- /{name} -->", html, re.S)
    if not m:
        raise SystemExit(f"index.html is missing the <!-- {name} --> markers")
    return m.group(1)


out = root / "artifact" / "tile-week.html"
out.parent.mkdir(exist_ok=True)
out.write_text(section("artifact:head") + "\n" + section("artifact:body"), encoding="utf-8")
print(f"wrote {out.relative_to(root)}")
