#!/usr/bin/env python3
"""A skill sablon (skill-template/ots-adminisztracio) ellenőrzése. A sablon az egyetlen, közös forrás: kézzel karbantartott.
Ellenőrzi: nincs benne személyes adat vagy régi név, a jelölők kiegyensúlyozottak, érvényes a SKILL.md fejléce,
a tasks.json minden fájlja létezik, és a helyőrzők ismertek. Hiba esetén nem nulla kilépési kóddal áll meg (a build és a teszt is megáll).
Használat: scripts/check-skill-template.py [mappa]"""
import json, os, re, sys

root = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "skill-template", "ots-adminisztracio"))
errors = []
BAD = ("Ömböli", "Krisztián", "Győr", "Tatabánya", "Tata,", "Toggl", "toggl", "Claude_Browser",
       "ots.detkapu.hu", "ots.tetkapu.hu", "DETKAPU", "detkapu-adminisztracio")
KNOWN = {"FELHASZNALO_NEVE", "SZEKHELY", "GYULEKEZETEK", "BONGESZO", "OTS_URL", "OTS_NEV"}

files = []
for d, _, fs in os.walk(root):
    for f in fs:
        files.append(os.path.join(d, f))
if not files:
    print("HIBA: a sablon mappa üres vagy nem létezik:", root); sys.exit(1)

for path in files:
    rel = os.path.relpath(path, root)
    if not (rel.endswith(".md") or rel.endswith(".json")):
        continue
    text = open(path, encoding="utf-8").read()
    for bad in BAD:
        for m in re.finditer(re.escape(bad), text):
            errors.append(f"{rel}: tiltott szöveg: {bad!r} ...{text[max(0, m.start()-25):m.end()+25]!r}")
    if rel.endswith(".md"):
        for tag in ("TASK", "SHARED"):
            if len(re.findall(rf"\[\[{tag}:", text)) != len(re.findall(rf"\[\[/{tag}\]\]", text)):
                errors.append(f"{rel}: kiegyensúlyozatlan {tag} jelölők")
        for key in re.findall(r"\{\{[#/]?([A-Z_]+)\}\}", text):
            if key not in KNOWN:
                errors.append(f"{rel}: ismeretlen helyőrző: {key}")

skill = open(os.path.join(root, "SKILL.md"), encoding="utf-8").read()
if not skill.startswith("---") or "name: ots-adminisztracio" not in skill.split("---")[1]:
    errors.append("SKILL.md: érvénytelen fejléc vagy név (name: ots-adminisztracio kell)")
try:
    tasks = json.load(open(os.path.join(root, "tasks.json"), encoding="utf-8"))["tasks"]
    for t in tasks:
        for f in t["files"] + t["shared"]:
            if not os.path.exists(os.path.join(root, f)):
                errors.append(f"tasks.json: hiányzó fájl: {f}")
except Exception as e:
    errors.append(f"tasks.json: {e}")

for e in errors:
    print("HIBA:", e)
if errors:
    sys.exit(1)
print(f"sablon rendben: {root} ({len(files)} fájl)")
