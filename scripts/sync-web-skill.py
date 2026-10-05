#!/usr/bin/env python3
"""A skill sablonból (skill-template/ots-adminisztracio) elkészíti a webalkalmazás csomagját: skill/bundle.json.
A webalkalmazás ebből tölti ki és csomagolja a skillt a felhasználónak. Előbb lefuttatja a sablon-ellenőrzést (személyes adat nélkül).
Használat: scripts/sync-web-skill.py  (a publish.sh is lefuttatja)"""
import json, os, subprocess, sys

here = os.path.dirname(os.path.abspath(__file__))
root = os.path.abspath(os.path.join(here, "..", "skill-template", "ots-adminisztracio"))
out = os.path.abspath(os.path.join(here, "..", "skill", "bundle.json"))

if subprocess.call([sys.executable, os.path.join(here, "check-skill-template.py")]) != 0:
    print("A skill sablon ellenőrzése hibás, a webes csomag nem készül el."); sys.exit(1)

files = {}
for d, _, fs in os.walk(root):
    for f in fs:
        path = os.path.join(d, f)
        rel = os.path.relpath(path, root).replace(os.sep, "/")
        if f.startswith(".") or rel == "tasks.json" or not (rel.endswith(".md")):
            continue
        files[rel] = open(path, encoding="utf-8").read()
tasks = json.load(open(os.path.join(root, "tasks.json"), encoding="utf-8"))["tasks"]
for t in tasks:
    for p in t["files"] + t["shared"]:
        if p not in files:
            print("Hiányzó fájl a sablonban:", p); sys.exit(1)

os.makedirs(os.path.dirname(out), exist_ok=True)
text = json.dumps({"name": "ots-adminisztracio", "tasks": tasks, "files": dict(sorted(files.items()))}, ensure_ascii=False, indent=1) + "\n"
if not os.path.exists(out) or open(out, encoding="utf-8").read() != text:
    open(out, "w", encoding="utf-8").write(text)
    print(f"Elkészült: {os.path.relpath(out)} ({len(files)} fájl)")
else:
    print("A webes skill-csomag naprakész.")
