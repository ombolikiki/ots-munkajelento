#!/bin/bash
# A webalkalmazás közzététele (GitHub Pages): skill-csomag frissítése, tesztek (négy időzónában), commit és push ebben a tárban.
# Használat: ./scripts/publish.sh ["commit üzenet"]
set -euo pipefail
cd "$(dirname "$0")/.."
echo "→ A skill csomag frissítése a sablonból"
python3 scripts/sync-web-skill.py
echo "→ Tesztek"
for tz in Europe/Budapest America/New_York Pacific/Auckland UTC; do
  TZ=$tz node --test test/*.test.js >/dev/null || { echo "A tesztek hibásak ($tz), nem töltök fel semmit."; exit 1; }
done
git add -A
if git diff --cached --quiet; then echo "Nincs változás, nincs mit feltölteni."; exit 0; fi
git commit -q -m "${1:-Frissítés}"
git push -q
echo "Kész. A GitHub Pages néhány percen belül frissül (ellenőrizd az sw.js CACHE nevét az éles oldalon)."
