from html.parser import HTMLParser
from pathlib import Path
import re
import sys


ROOT = Path(__file__).resolve().parent

HTML_FILES = [
    ROOT / "one-pager-ru.html",
    ROOT / "one-pager-en.html",
    ROOT / "landing" / "index.html",
    ROOT / "social" / "og-card.html",
    ROOT / "social" / "announcement-square.html",
    ROOT / "social" / "story.html",
    ROOT / "social" / "slide-cover.html",
]

ALL_FILES = HTML_FILES + [ROOT / "PRESS_KIT_RU.md"]


class StrictHTMLParser(HTMLParser):
    pass


failures = []


def require(condition, message):
    if not condition:
        failures.append(message)


for path in ALL_FILES:
    require(path.is_file(), f"missing file: {path.relative_to(ROOT)}")

for path in HTML_FILES:
    if not path.is_file():
        continue
    source = path.read_text(encoding="utf-8")
    parser = StrictHTMLParser()
    try:
        parser.feed(source)
        parser.close()
    except Exception as error:
        failures.append(f"invalid HTML in {path.name}: {error}")
    require("LastBite" not in source, f"old brand name present: {path.name}")
    require("—" not in source and "–" not in source, f"long dash present: {path.name}")
    require("<script src=" not in source, f"external script present: {path.name}")
    require("rel=\"stylesheet\"" not in source, f"external stylesheet present: {path.name}")
    require(not re.search(r"<img[^>]+src=[\"']https?://", source), f"remote image present: {path.name}")

for name in ("one-pager-ru.html", "one-pager-en.html"):
    path = ROOT / name
    if not path.is_file():
        continue
    source = path.read_text(encoding="utf-8")
    compact = re.sub(r"\s+", "", source)
    require("@page{size:A4portrait;margin:0}" in compact, f"A4 page rule missing: {name}")
    require("width:210mm" in compact and "height:297mm" in compact, f"exact A4 canvas missing: {name}")
    require("page-break-after:avoid" in compact, f"print break guard missing: {name}")

landing = ROOT / "landing" / "index.html"
if landing.is_file():
    source = landing.read_text(encoding="utf-8")
    for link in ("../demo/index.html", "../pitch-deck-ru.html"):
        require(link in source, f"landing link missing: {link}")
    for phrase in ("rafly control", "rafly market", "7-10"):
        require(phrase in source.lower(), f"landing phrase missing: {phrase}")
    require("mailto:" in source, "landing mailto CTA missing")

press = ROOT / "PRESS_KIT_RU.md"
if press.is_file():
    source = press.read_text(encoding="utf-8")
    require(";" not in source, "semicolon present in press kit")
    require("—" not in source and "–" not in source, "long dash present in press kit")
    require("LastBite" not in source, "old brand name present in press kit")
    require("docs/brand/logo/" in source, "final logo path missing in press kit")
    for term in ("проверенный оффер", "пересчёт", "вахта просрочки", "исключение", "спринт контроля"):
        require(term in source.lower(), f"glossary term missing: {term}")
    for count in (50, 100, 200):
        match = re.search(
            rf"<!-- BOILERPLATE {count} START -->(.*?)<!-- BOILERPLATE {count} END -->",
            source,
            flags=re.S,
        )
        require(match is not None, f"{count}-word boilerplate markers missing")
        if match:
            words = re.findall(r"[A-Za-zА-Яа-яЁё0-9]+(?:-[A-Za-zА-Яа-яЁё0-9]+)*", match.group(1))
            require(len(words) == count, f"{count}-word boilerplate has {len(words)} words")

social_sizes = {
    "og-card.html": (1200, 630),
    "announcement-square.html": (1080, 1080),
    "story.html": (1080, 1920),
    "slide-cover.html": (1920, 1080),
}
for name, (width, height) in social_sizes.items():
    path = ROOT / "social" / name
    if not path.is_file():
        continue
    compact = re.sub(r"\s+", "", path.read_text(encoding="utf-8"))
    require(f"width:{width}px" in compact, f"wrong width in {name}")
    require(f"height:{height}px" in compact, f"wrong height in {name}")
    require(f"{width} x {height}" in path.read_text(encoding="utf-8"), f"screenshot note missing in {name}")

if failures:
    print("MEDIA KIT CHECK FAILED")
    for failure in failures:
        print(f"- {failure}")
    sys.exit(1)

print(f"MEDIA KIT CHECK PASSED: {len(ALL_FILES)} deliverables verified")
