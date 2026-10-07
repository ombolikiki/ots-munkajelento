# OTS Munkajelentő Tracker – webalkalmazás (0.2, asztali)

Telepíthető webalkalmazás (PWA) **Windowsra (Chrome vagy Edge)**, a Mac-alkalmazás („OTS Munkajelentő Tracker”) funkcióival, ugyanúgy működve. Telefonos változat nincs: telefonon a naptárba írnak (lásd `TERV.md`).

Élő változat: https://ombolikiki.github.io/ots-munkajelento/

## Mit tud (a natív appal azonosan)
- **Négy rögzítési mód:** Időzítő, Kézi bevitel (időponttal vagy óraszámmal), Pomodoro (hangok, értesítés, a hátralévő idő a böngészőfül címében), Naptár (heti nézet, húzással kijelölt idősáv, beállítható munkanap-sáv).
- **Mezők:** Munkahely (mentett helyszínek menüje), típus, Utazásnál **Kiindulás** (egy hely) és **Cél** (egy vagy több hely, vesszővel; mindegyik `Település` vagy `Település, utca házszám`, pl. `Tata, Fő út 1., Mór`), a **Munkahely** választó (Kiindulás vagy Cél, alapból a Cél) és az **Oda-vissza** pipa (alapból bejelölt: Kiindulás - Cél(ek) - Kiindulás; kikapcsolva egyirányú). A CSV-ben az Indulás = a Kiindulás, a Munkahely = a Cél helyei, az Érkezés = oda-vissza útnál a Kiindulás, egyirányúnál a Cél utolsó helye. Az OTS-be mindig a település kerül, a pontos cím csak a Google Maps útvonalhoz. Az **Időzítő** indítás előtt és futás közben is kapott Kezdés mezőt (óó:pp, vagy −5/−10/−15/−30 perc; legfeljebb a mai nap elejéig, jövőbeli nem lehet), Mennyiség (fő/alkalom), Tevékenység (csak az Utazásnál kötelező).
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

## Naptár-értelmező és szinkron (a naptárintegráció logikája)
A `docs/NAPTAR_JELOLESEK.md` (közös, végleges előírás) szerint, a Mac-alkalmazás `CalendarParser`/`CalendarSync` logikájával egyezően:
- `src/calendarParser.js`: a cím, a helyszín és az idő értelmezése (típusnevek, `@Település`, `×n`, Utazás-útvonalak, pontos címek ` - ` elválasztóval, egész napos és éjfélen átnyúló események, kihagyás).
- `src/calendarSync.js`: a szinkron terve és végrehajtása. A naptár a mérvadó (módosítás frissít, törlés/lemondás töröl), a kézi bejegyzéshez és az ablaknál (alapból 60 nap) régebbi bejegyzéshez nem nyúl; a törlés előtt másolat készül (`bejegyzesek.naptar-elotti.csv`); védelem: ha a törlések száma > 5 és az ablakbeli naptáras bejegyzések fele, vagy a naptár üresnek látszik, megerősítést kér.
- **CSV:** a 15 oszlop változatlan, a végére hét új oszlop került (összesen 22), ebben a sorrendben: `Cím` (a pontos címek ` - `-vel), `Naptár azonosító` (`<azonosító>#ÉÉÉÉ-HH-NN`, ismétlődő példánynál `<azonosító>|<másodperc>#ÉÉÉÉ-HH-NN`), `Indulás cím`, `Érkezés cím` (Utazásnál a pontos címek, `Fő út 1., Tata` alakban; az `Indulás` és az `Érkezés` oszlop település marad), `Munkahely helye` (Utazásnál `indulás`, ha a Kiindulás volt a munkahely; üres = a Cél helyei; ilyenkor az OTS Munkahelye az Indulás), `Induló km`, `Érkező km` (Utazásnál a kilométeróra állása az út elején és végén; egész szám, 0 és 9 999 999 között, üres is lehet; hibás érték üresnek számít; oda-vissza útnál a körútra vonatkozik). A `Forrás` a naptárból átvettnél `calendar`. A régi fájlok olvashatók maradnak. Az éjfélen átnyúló esemény két bejegyzés (a nap végi vég `00:00:00`).
- Állapot: a logika és a CSV kész és tesztelt; **a Google/Outlook naptár-lekérdezés (OAuth) és a hozzá tartozó felület még nincs bekötve** (a regisztrációkhoz a te Google Cloud és Microsoft Entra azonosítóid kellenek, lásd `TERV.md`).

## Tesztek és fejlesztés
```bash
node --test test/*.test.js
for TZ in Europe/Budapest America/New_York Pacific/Auckland UTC; do TZ=$TZ node --test test/*.test.js; done
scripts/dev-server.py           # helyi szerver gyorsítótár nélkül: http://localhost:8123
scripts/sync-web-skill.py       # a skill-template mappából újraépíti a skill/bundle.json csomagot
```
A közzététel: `./scripts/publish.sh "üzenet"` (a skill-csomagot is frissíti, négy időzónában lefuttatja a teszteket, commitol és pushol ebben a tárban). Az `sw.js` `CACHE` nevét minden változásnál emeld, az új fájlokat vedd fel a `FILES` listába.

## Felépítés
Sima JavaScript, függőség nélkül (ES modulok). Logika: `src/dates.js` (védett dátumkezelés), `types.js` (típusok, saját kategóriák, színek), `csv.js`, `attendance.js`, `entries.js`, `insights.js`, `manual.js` (Kézi felvitel az OTS-be), `calendar.js`, `pomodoro.js`, `folder.js` (adatmappa), `store.js` (állapot és mentés), `skill.js` (skill kitöltése, ZIP). Felület: `src/app.js` és `src/ui/*` (fülek, naptár, beállítások, ablakok, varázsló). A szabályok megegyeznek a Mac-alkalmazáséval (lásd a `CLAUDE.md` fájlt): a dátumszámítás nem omolhat össze (a napokat `ÉÉÉÉ-HH-NN` szövegként kezeljük), szám- és CSV-olvasás védett, jövőbeli bejegyzés nem rögzíthető, 1 fő/alkalom = 1 óra.

## Amit nem láttunk élesben
A Windowst, a Chrome valódi mappaválasztóját (és a tiltott mappákat), a Chrome engedély-újrakérését és a skill kiírását a `.claude`/`.agents` mappákba itt nem lehet kipróbálni; a logikát tesztek (hamis mappával), a valódi böngészős mappa-írást a beépített böngészőben a böngésző saját (OPFS) mappájával ellenőriztük.

## Mac 1.5.1–1.5.6 átvezetése
- **Hétvége és üres napok:** szombaton és vasárnap nincs napi óraszám, de az üres hétvégi nap jelez (piros pont, kitöltetlen napok). A Havi munkajelentő az üres napra (vasárnapra is) `!!!`-t ad (kapcsoló: „Üres napok jelölése (!!!)”), nincs 8-ra kiegészítés. A skill-csomag (`skill/bundle.json`) ennek megfelelően frissült.
- **Havi korlát:** legfeljebb annyi szabadnap és annyi munkaszüneti nap lehet egy hónapban, ahány hétből áll a hónap; átlépéskor figyelmeztetés (a rögzítést nem akadályozza).
- **Szabadnap egy kattintással:** a kitöltetlen napok listájában a nap mellett a hold gomb, a fejlécben a „Vasárnapok → szabadnap” gomb; csak üres, múltbeli napot jelöl.
- **Javaslatok gépelés közben** (Beállítások › Székhely és helyszínek, alapból bekapcsolt): Munkahely, Kiindulás, Cél, Tevékenység típusa, Tevékenység. Fel/Le lépked, Enter a kijelöltet fogadja el, Tab a kijelöltet vagy az elsőt, Esc bezár. A típusmező nyila a teljes csoportosított listát nyitja.
- **Skill-frissítés jelzése:** a webes telepítő a jelölőfájlba (`.ots-tracker-install.json`) ugyanúgy beleírja a lenyomatot (`fingerprint`), de a böngésző nem látja a telepített skillt, ezért a jelzés a Mac-appban van; a webes telepítő új csomagot ír fel.

## Mac 1.6.0 átvezetése: kilométeróra és útonkénti Költségelszámolás
- **Km-óra az Utazásnál:** az űrlap alján mindig látszik az „induló km → érkező km” (egyik sem kötelező). Az induló km az utolsó rögzített érkező km-mel töltődik elő. Hibánál (nem szám, érkező ≤ induló, az induló kisebb az előző út érkezőjénél) az űrlap jelzi, és nem engedi a rögzítést.
- **Km-javítás:** a napi lista Utazás soraiban ceruza ikon; a sor alatt javítható az induló és az érkező km (üresen törlődik). A sorban „km-óra: 1000 → 1060 (60 km)”.
- **Havi összes km:** Beállítások › Kilométeróra › „Minden úthoz megadom a km-órát is”; bekapcsolva az ablak alján látszik a hónap km-összege.
- **Költségelszámolás:** minden Utazás külön sor („2. út”), km-óra oszloppal; a Google Maps gomb csak ott marad, ahol nincs teljes km-állás. A „felvittem” jelölés útonként van (nap + sorszám), az aláírásba a km is beleszámít. A skill-csomag az új szabályokkal frissült.

## Mac 1.7.0 átvezetése: Pomodoro-munkamenet
- **Munkamenet:** az első pomo indításától a végéig a pomók és a szünetek együtt egyetlen bejegyzést adnak (Kezdés = az első pomo indítása, Vége = a munkamenet vége, Forrás = `pomodoro`, óra egység). A szünet is munkaidő. Az új fázis az előző tervezett végétől indul, így az idő nem csúszik. A CSV nem változik.
- **A munkamenet vége:** a Leállítás (pomo és szünet közben is; az űrlap kiürül), a hosszú szünet vége (az automatikus indítás ekkor is megáll), a szünet vége automatikus indítás nélkül (ez az alapérték), a pomo vége, ha az automatikus szünet ki van kapcsolva, és az altatás. A szünet kihagyása és az elvetés a Mac szabályai szerint. A 30 másodpercnél rövidebb munkamenet nem rögzül. Éjfélen átnyúlva több bejegyzés (az első 24:00-ig, a CSV-ben a Vége `00:00:00`).
- **Mezők:** a bejegyzés a munkamenet elején megadott mezőket kapja; futás közben a mezők zároltak. A pomo-számláló mellett látszik a munkamenet eddigi ideje.
- **Altatás:** a böngészőben nem érzékelhető közvetlenül; ha két másodpercenkénti ütem között (falióra szerint) 120 másodpercnél nagyobb az ugrás, a munkamenet a legutóbbi ütemnél zárul és rögzül (a mezők megmaradnak, új pomo indítható). A számlálás falióra szerinti, a háttérfül időzítőjének lassulása nem vág le munkamenetet. Ez közelítés: ha a böngésző felfüggeszti a lapot (például memóriatakarékos mód), a munkamenet a legutóbbi életjelnél ér véget.
- **Folyamatos mentés és helyreállítás:** a futó munkamenet (a bejegyzés-sablon, a kezdés, a legutóbbi életjel) kb. 10 másodpercenként és minden fázisváltáskor mentődik a böngésző tárába; induláskor (a fül bezárása, újratöltés, összeomlás után) a kezdéstől az utolsó életjelig rögzül, majd a mentés törlődik. Újratöltés tehát lezárja a munkamenetet.
- **Beállítás:** Pomodoro beállítások › „A szünet is munkaidő, és a munkamenet egy bejegyzésben rögzül” (alapból bekapcsolt). Kikapcsolva a régi működés: minden lejárt pomo külön bejegyzés, a szünet nem rögzül, nincs mezőzárolás; az altatás ilyenkor is menti a futó pomót. A régebbi külön pomo-bejegyzések érintetlenek.
