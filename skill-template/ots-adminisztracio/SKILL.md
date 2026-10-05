---
name: ots-adminisztracio
description: OTS Adminisztráció - adminisztrációs feladatok az OTS 4.40 rendszerben ({{OTS_URL}}, Hetednapi Adventista Egyház, {{OTS_NEV}}). Használd, ha a felhasználó az OTS-ben, a Határidők oldalon vagy a {{OTS_NEV}} felületén kér feladatot elvégezni, például gyülekezeti látogatottság (létszámjelentő) kitöltése, határidők listázása, negyedév lezárása.
---

# OTS Adminisztráció

Az OTS 4.40 ({{OTS_URL}}) webes rendszerben végzett adminisztrációs feladatok. A skill bővül, ezért a feladatonkénti leírások a `references/` mappában vannak.

## Feladatok

| Feladat | Leírás |
|---|---|
[[TASK:latogatottsag]]| Gyülekezeti látogatottság kitöltése és negyedév lezárása | [references/latogatottsag.md](references/latogatottsag.md) |[[/TASK]]
[[TASK:nevsor]]| Gyülekezeti névsor lezárása (negyedéves) | [references/gyulekezeti-nevsor.md](references/gyulekezeti-nevsor.md) |[[/TASK]]
[[TASK:hittan]]| Hitoktatás (Hittan) rögzítése, félévente | [references/hitoktatas.md](references/hitoktatas.md) |[[/TASK]]
[[TASK:havi]]| Havi munkajelentő (az OTS Munkajelentő Tracker alapján, havonta) | [references/havi-munkajelento.md](references/havi-munkajelento.md) |[[/TASK]]
[[TASK:koltseg]]| Költségelszámolás (havi útiköltség, az OTS Munkajelentő Tracker Utazás-bejegyzései alapján) | [references/koltsegelszamolas.md](references/koltsegelszamolas.md) |[[/TASK]]
| Határidők kiolvasása, listázása | alább, "Határidők oldal" |

## Indítás (a skill beolvasása után mindig ezt told előre)

1. Nyisd meg az OTS-t ({{OTS_URL}}, {{OTS_NEV}}), és kérd meg a felhasználót a bejelentkezésre, ha még nem jelentkezett be.
2. Nyisd meg a **Határidők** menüpontot, és olvasd ki a sorokat (lásd "Határidők oldal").
3. Listázd ki, hogy a skill feladatai közül melyekhez van ténylegesen Határidő, gyülekezetenként és időszakonként összesítve (pl. "Gyülekezeti névsor: 2026. III. negyedév, {{GYULEKEZETEK}}"). **Amelyik feladathoz nincs Határidő, azt hagyd ki a felsorolásból**, ne említsd.
4. Kérdezd meg, melyikkel kezdjük. Ne indíts el feladatot, amíg a felhasználó nem választ.

A feladat és a Határidők sor megfeleltetése:
[[TASK:latogatottsag]]- Gyülekezeti látogatottság: TASK = 2 (a "Lezárás" és a "Rögzítés" sorok technikailag azonosak, lásd references/latogatottsag.md)[[/TASK]]
[[TASK:nevsor]]- Gyülekezeti névsor: TASK = 1[[/TASK]]
[[TASK:hittan]]- Hitoktatás (Hittan): TASK = 3[[/TASK]]
[[TASK:havi]]- Havi munkajelentő: TASK = 7[[/TASK]]
[[TASK:koltseg]]- Költségelszámolás: TASK = 8[[/TASK]]

## Általános szabályok

- {{BONGESZO}}
- **Bejelentkezés:** jelszót soha nem írsz be. Nyisd meg az oldalt, és kérd meg a felhasználót, hogy jelentkezzen be a panelben. Utána folytasd.
- Felhasználó: {{FELHASZNALO_NEVE}}.{{#GYULEKEZETEK}} Gyülekezetek: {{GYULEKEZETEK}}.{{/GYULEKEZETEK}}{{#SZEKHELY}} Székhely (a költségelszámolás útvonalainak kiindulópontja): {{SZEKHELY}}.{{/SZEKHELY}}
- Csak a felhasználó kifejezett utasítására kezdj el egy feladatot. Ha előtte tanít, csak figyelj.
- Lezárás, véglegesítés, törlés előtt kérj megerősítést, amíg a felhasználó azt nem mondja, hogy automatikusan mehet. Törölni véglegesen nem szabad.
- Ha egy negyedévre már vannak mentett adatok, ne írd felül, szólj.
- Magyarul kommunikálj.

## Az OTS felépítése

- Bal menü: Határidők, Lelkész, Titkári, Pénztár, Szolgálati beosztás, Látogatók, Dokumentumtár, Súgó.
- Felső sáv: gyülekezet-legördülő (bal felül), dátum/negyedév választó, értesítések (a szám a függő határidők száma).
- A tartalom egy iframe-ben van (`queries/.../*.php`), a táblázatok Webix komponensek. A `get_page_text` és a `read_page` ezekből nem ad sort, ezért JS-sel kell kiolvasni.

## Határidők oldal

- Webix grid: `document.querySelector('iframe').contentWindow.$$('grid_deadline')`. Az adatok: `.serialize()`. Oszlopok: DEADLINE, TASK, PERIOD, OPERATION, AFFECTED_ENTITY, MARKERC (`red` = lejárt, `yellow` = még nem járt le).
- TASK azonosítók: 12 Engedélyezett levonások, 6 Gyülekezeti jegyzőkönyvek, 2 Gyülekezeti látogatottság, 1 Gyülekezeti névsor, 7 Havi munkajelentő, 3 Hittan, 8 Költségelszámolás, 11 Pénztár, 15 Üzemanyagárak rögzítése.
- OPERATION azonosítók: 1 Lezárás, 2 Jóváhagyás, 3 Rögzítés.
- A sort duplán kattintva az adott feladat felülete nyílik meg (látogatottságnál az Istentiszteleti létszámjelentő). A feladat oszlopot ne szerkeszd, ha cellaszerkesztő nyílik meg, Escape.
- Teljes lista kiolvasása: `g.serialize()` majd soronként a mezők. A sorok csak részben jelennek meg a DOM-ban (virtualizált), ezért az adatobjektumot használd.

[[SHARED:tracker]]## Az OTS Munkajelentő Tracker adatai

A Havi munkajelentő, a Költségelszámolás és a Gyülekezeti látogatottság a felhasználó OTS Munkajelentő Tracker alkalmazásának adatait használja: [references/tracker-adatforras.md](references/tracker-adatforras.md).[[/SHARED]]

## Bővítés

Új feladat esetén hozz létre egy új fájlt a `references/` alatt, és vedd fel a fenti táblázatba.
