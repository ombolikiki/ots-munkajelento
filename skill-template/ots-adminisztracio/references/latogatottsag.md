# Gyülekezeti látogatottság (létszámjelentő) kitöltése

Az OTS "Titkári > Istentiszteleti létszámjelentő" felülete. A Határidők oldal "Gyülekezeti látogatottság" sorain keresztül is megnyitható (dupla kattintás a soron).

## Háttér

- Minden határidőhöz két dátum tartozik, ezt a dátumválasztóval lehet váltani.
- Minden dátumhoz tartozik egy **Szombatiskola** és egy **Istentisztelet** szekció, mindegyikben 3 kérdéssel: Hány gyermek / Hány felnőtt adventista / Hány felnőtt vendég.
- Negyedévente, minden gyülekezetre ({{GYULEKEZETEK}}) és mindkét dátumra ki kell tölteni.
- A létszámokat a felhasználó adja meg (lásd lent). Soha ne írj be kitalált vagy becsült számot.
- Felület gombjai: Mentés, Törlés, Negyedév lezárása.

## Lezárás és Rögzítés sorok

A Határidők oldalon a látogatottságnál kétféle művelet jelenik meg: "Lezárás" (OPERATION = 1, negyedéves időszak, pl. "2026. II. negyedév") és "Rögzítés" (OPERATION = 3, egy konkrét dátum, pl. "2026.07.11."). A felhasználó megerősítette: technikailag azonosak, a feladat leírása (menet, adatok) mindkettőre ugyanaz. Mindkettőt a lenti lépések szerint kezeld.

## Kiválasztók

- A gyülekezet a bal felső legördülőben váltható, nem kell visszamenni a Határidők menübe.
- A negyedév/dátum a felső dátumválasztóban állítható. Negyedévek: január-március, április-június, július-szeptember, október-december.

## Sorrend

Mindig a RÉGEBBI negyedévvel kezdd, és időrendben haladj. A teendők listáját a Határidők oldalról olvasd ki (TASK = 2, OPERATION = 1 Lezárás és 3 Rögzítés, MARKERC = red).

## Lépések (minden gyülekezet és negyedév esetén)

1. Nyisd meg a határidőt (vagy válaszd ki a gyülekezetet és a negyedévet a felső legördülőkkel).
2. Válaszd ki az **első dátumot**.
3. Nyisd le a **Szombatiskola** szekciót, írd be a felhasználótól (vagy a trackerből) kapott 3 adatot.
4. Nyisd le az **Istentisztelet** szekciót, írd be a felhasználótól (vagy a trackerből) kapott 3 adatot.
5. Mentés előtt mutasd meg a felhasználónak a beírt adatokat, és kérj megerősítést.
6. Kattints a **Mentés** gombra.
7. Válaszd ki a **második dátumot**, és ismételd meg a 3-6. lépést.
8. Kattints a **Negyedév lezárása** gombra (az első alkalmakkor kérj előtte megerősítést).
9. Lépj tovább a következő Látogatottság határidőre.

## Létszámok: először a trackerből

A felhasználó az OTS Munkajelentő Trackerben rögzíti a létszámokat (a beállításfájl és a mappa: references/tracker-adatforras.md): a bejegyzések fájlja mellett a `letszamjelentesek.csv` fájlban (ugyanabban a mappában; a mappát a `beallitasok.json` `attendanceFile` mezője adja meg). Pontosvesszővel tagolt, UTF-8, oszlopok: `Dátum`, `Gyülekezet`, `Szombatiskola gyermek`, `Szombatiskola felnőtt adventista`, `Szombatiskola felnőtt vendég`, `Istentisztelet gyermek`, `Istentisztelet felnőtt adventista`, `Istentisztelet felnőtt vendég`. Esedékes: minden negyedév második és hetedik szombatja.

- Az OTS-ben kiválasztott gyülekezethez és dátumhoz keresd meg a megfelelő sort, és **azokat a számokat írd be** (nem kell kérdezni).
- Ha az adott dátumra és gyülekezetre nincs sor a fájlban, kérdezd meg a felhasználót (lásd lent).

## Ha a trackerben nincs adat

Ha az adott dátumra és gyülekezetre nincs létszám a trackerben, **kérdezd meg a felhasználót** gyülekezetenként, dátumonként és szekciónként (Szombatiskola / Istentisztelet; gyermek / felnőtt adventista / felnőtt vendég), és várd meg a választ. **Soha ne írj be kitalált vagy becsült számot.**

## Tudnivalók

- Ha az adott dátumra már vannak mentett adatok, ne írd felül. Szólj a felhasználónak.
- A lezárás valószínűleg végleges, ezért csak megerősítéssel nyomd meg, amíg a felhasználó mást nem mond.

## Befejezés

Amikor a feladat lefutott (nincs több lejárt vagy esedékes Gyülekezeti látogatottság határidő a felhasználó által kért körben), írd ki jól láthatóan, például így:

> ## ✅ A feladat befejeződött: Gyülekezeti látogatottság

Röviden foglald össze, mit végeztél el (gyülekezetek, negyedévek). Ezután kérdezd meg a felhasználót, hogy mivel folytassuk.
