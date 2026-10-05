# Gyülekezeti névsor lezárása

A negyedéves "Gyülekezeti névsor" határidők lezárása. A Határidők oldalon gyülekezetenként külön sor van (pl. "Gyülekezeti névsor, 2026. III. negyedév": gyülekezetenként egy-egy sor). TASK azonosító: 1, OPERATION: 1 (Lezárás).

A feladat lényege: az előző negyedévben történt névsorváltozások (keresztség, tagfelvétel, temetés, tagáthelyezés stb.) ellenőrzése, majd a negyedév lezárása.

## Menet

1. Olvasd ki a Határidők oldalt (lásd a SKILL.md "Határidők oldal" részét), és keress TASK = 1 (Gyülekezeti névsor) sorokat.
   - Ha nincs ilyen sor, a teljes feladat kész. Jelezd a felhasználónak.
   - Ha van, folytasd a 2. lépéssel.
2. Nyisd meg az első gyülekezet névsorát (a sorrend: {{GYULEKEZETEK}}; duplakattintás a sorra a Határidők oldalon).
3. Kérdezz rá a felhasználónál, hogy történt-e változás a névsorban az előző negyedévben (keresztség, tagfelvétel, temetés, tagáthelyezés stb.).
   - **Igen:** a felhasználó maga vezeti fel a változást a táblázatban. Te ne módosíts a névsorban. Várd meg, amíg jelzi, hogy kész, és utasításra folytasd a 4. lépéssel.
   - **Nem:** folytasd a 4. lépéssel.
4. Kattints a **Negyedév lezárása** gombra.
5. A felugró ablakon erősítsd meg a lezárást.
6. Lépj a Határidők menüben a következő gyülekezet "Gyülekezeti névsor" feladatára, és végezd el ugyanezt a 3-5. lépésben, majd a többi gyülekezettel is.

## Megjegyzések

- Gyülekezetenként külön rákérdezés kell a változásról, ne feltételezd, hogy a válasz azonos.
- A lezárás valószínűleg végleges. Ha a felhasználó "nem"-et válaszolt, vagy "igen" után jelezte, hogy kész, ez elég a lezáráshoz: nem kell újra rákérdezni, hogy nincs-e több változás (felhasználó megerősítette).
- Sorrend: {{GYULEKEZETEK}}.

## Befejezés

Amikor a feladat lefutott (az összes névsor lezárva, vagy nem volt Gyülekezeti névsor határidő), írd ki jól láthatóan, például így:

> ## ✅ A feladat befejeződött: Gyülekezeti névsor lezárása

Röviden foglald össze, mit végeztél el (melyik gyülekezetek névsora lett lezárva). Ezután kérdezd meg a felhasználót, hogy mivel folytassuk.
