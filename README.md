# OTS Munkajelentő Tracker – webalkalmazás (0.2, asztali)

Telepíthető webalkalmazás (PWA) **Windowsra (Chrome vagy Edge)**, a Mac-alkalmazás („OTS Munkajelentő Tracker”) funkcióival, ugyanúgy működve. Telefonos változat nincs: telefonon a naptárba írnak (lásd `TERV.md`).

Élő változat: https://ombolikiki.github.io/ots-munkajelento/

## Mit tud (a natív appal azonosan)
- **Négy rögzítési mód:** Időzítő, Kézi bevitel (időponttal vagy óraszámmal), Pomodoro (hangok, értesítés, a hátralévő idő a böngészőfül címében), Naptár (heti nézet, húzással kijelölt idősáv, beállítható munkanap-sáv).
- **Mezők:** Munkahely (mentett helyszínek menüje), típus, Utazásnál Indulás / Munkahely(ek) / Érkezés és Oda-vissza, Mennyiség (fő/alkalom), Tevékenység (csak az Utazásnál kötelező).
- **Napi lista** kategóriaszínekkel, napi 8 órás jelzés, **kitöltetlen és hiányos napok**, emlékeztető sáv hosszú kihagyás után.
- **Gyülekezeti létszámjelentő** (negyedévenként a 2. és 7. szombaton), külön `letszamjelentesek.csv`.
- **Kézi felvitel az OTS-be:** Munkajelentő / Költségelszámolás / Létszámjelentő × Naptár / Felsorolás / OTS-táblázat; kattintásra vágólapra másolás, „felvittem” jelölés, Google Maps, „A skill szabályai szerint” kapcsoló.
- **Beállítások:** világos/sötét/rendszer mód, négy színséma, hangok, naptár, emlékeztetők, napi óraszám, székhely és helyszínek, saját kategóriák, kategóriaszínek (16 minta + `#RRGGBB`), OTS-kategóriák elrejtése, gyülekezetek, adatmappa, törlés (két megerősítés, másolat).
- **Skill telepítése** (6 lépéses varázsló): kitöltött csomag ZIP-ként, kézi telepítési parancsokkal, vagy kiválasztott skill-mappába kiírva (Claude, ChatGPT/Codex, Antigravity CLI).
- Ami nincs (a böngészőben nem megvalósítható): menüsori ikon és ikonválasztás, indítás bejelentkezéskor, leválasztott/„mindig legfelül” ablak, kompakt nézet, Kilépés. A telepített (saját ablakos) alkalmazás maga a „leválasztott ablak”.

## Hova menti az adatot?
- **Adatmappa (ajánlott):** a Beállítások › *Adatmappa és mentés* részben egyszer kiválasztasz egy mappát (például Dokumentumok\OTS Munkajelentő Tracker). Innentől **minden változás automatikusan** kiíródik a `bejegyzesek.csv`, a `letszamjelentesek.csv` és a `beallitasok.json` fájlba. Ugyanez a három fájl van a natív app mappájában, azonos formátumban (pontosvessző, UTF-8 BOM, CRLF), ezért a skill és a Mac-alkalmazás is olvassa; a Mac-alkalmazásban ugyanezt a mappát kijelölve az adat közös.
- A mappa elérését a Chrome minden indításkor újra kérheti (a banneren „Engedélyezés”); addig a változások a böngészőben maradnak, és az engedély után kiíródnak.
- A mappában közben (Excelben, a skillel, a Mac-appban) módosított fájlt az app az ablakra visszalépéskor újra beolvassa. Hibás sornál figyelmeztet, kihagyja, és **mentés előtt másolatot készít** (`bejegyzesek.hibas-….csv`). Törlés előtt `bejegyzesek.torles-elotti.csv` készül.
- A böngésző tárhelye (localStorage) gyorsítótárként mindig megvan; adatmappa nélkül csak ez van, ezért ilyenkor érdemes rendszeresen CSV-t exportálni.
- **A Chrome nem enged** rendszermappát (AppData, Library) és a felhasználói mappát magát kijelölni: válassz almappát.
- A skill a mappa **teljes elérési útját** a `beallitasok.json`-ból tudja; a böngésző ezt nem látja, ezért a Beállításokban kézzel kell megadni (a mappa Ctrl+Shift+C másolt útvonala).

## Tesztek és fejlesztés
```bash
cd web && node --test test/*.test.js
for TZ in Europe/Budapest America/New_York Pacific/Auckland UTC; do TZ=$TZ node --test test/*.test.js; done
../scripts/dev-server.py        # helyi szerver gyorsítótár nélkül: http://localhost:8123
../scripts/sync-web-skill.py    # a skill sablonból újraépíti a web/skill/bundle.json csomagot
```
A közzététel: `./scripts/publish-web.sh "üzenet"` (a skill-csomagot is frissíti, lefuttatja a teszteket). Az `sw.js` `CACHE` nevét minden változásnál emeld, az új fájlokat vedd fel a `FILES` listába.

## Felépítés
Sima JavaScript, függőség nélkül (ES modulok). Logika: `src/dates.js` (védett dátumkezelés), `types.js` (típusok, saját kategóriák, színek), `csv.js`, `attendance.js`, `entries.js`, `insights.js`, `manual.js` (Kézi felvitel az OTS-be), `calendar.js`, `pomodoro.js`, `folder.js` (adatmappa), `store.js` (állapot és mentés), `skill.js` (skill kitöltése, ZIP). Felület: `src/app.js` és `src/ui/*` (fülek, naptár, beállítások, ablakok, varázsló). A szabályok megegyeznek a Mac-alkalmazáséval (lásd a projekt `CLAUDE.md` fájlját): a dátumszámítás nem omolhat össze (a napokat `ÉÉÉÉ-HH-NN` szövegként kezeljük), szám- és CSV-olvasás védett, jövőbeli bejegyzés nem rögzíthető, 1 fő/alkalom = 1 óra.

## Amit nem láttunk élesben
A Windowst, a Chrome valódi mappaválasztóját (és a tiltott mappákat), a Chrome engedély-újrakérését és a skill kiírását a `.claude`/`.agents` mappákba itt nem lehet kipróbálni; a logikát tesztek (hamis mappával), a valódi böngészős mappa-írást a beépített böngészőben a böngésző saját (OPFS) mappájával ellenőriztük.
