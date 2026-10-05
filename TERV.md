# Webalkalmazás – következő változat (Windows, Chrome)

Állapot (2026-10-05): a **0.2** megvalósult: nincs mobil nézet, a felület a natív app méretű, szebb asztali panelje; a natív app összes funkciója (Pomodoro, Naptár, létszámjelentő, Kézi felvitel az OTS-be, kategóriák és színek, beállítások); **automatikus mentés az adatmappába** (`bejegyzesek.csv`, `letszamjelentesek.csv`, `beallitasok.json`); **skill-telepítő varázsló** (ZIP, parancsok, kiírás mappába). Lásd `web/README.md`. Kész a végleges `NAPTAR_JELOLESEK.md` szerinti **naptár-értelmező, szinkron-terv és CSV** (`Cím`, `Naptár azonosító` oszlopok; `src/calendarParser.js`, `calendarSync.js`, tesztekkel). Hátra van: a Google/Outlook lekérdezés (OAuth) és a felület (1. feladat), a Windowson való éles kipróbálás és az ebből adódó javítások.
Ez a fájl a következő változat döntéseit és feladatait gyűjti. A munkát az „OTS Webapp” beszélgetésben folytatjuk.

## Döntések (a felhasználótól, 2026-10-05)
- **A webapp elsődleges célja a Windows** (Chrome a megszokott böngésző; Edge is ok). **Telefonos alkalmazás nem kell**: a telefonon a naptárba írnak, a naptárat a webapp (Windowson) vagy a Mac-alkalmazás (Macen) olvassa.
- **Naptárintegráció mindkét naptárra: Google Naptár és Outlook/Microsoft 365 Naptár.** Az iCloud nem kell a webappban.
- Mindenki a **saját naptárát** használja (kevesebb, mint 100 felhasználó). A naptár hozzáférés felhasználónként saját engedélyezéssel megy.
- A webappban legyen **részletes leírás a skill telepítésére** (Claude, ChatGPT Codex, Antigravity CLI), Windowsra szabva.
- A naptáresemények jelölése: **`docs/NAPTAR_JELOLESEK.md`** (közös a Mac-alkalmazással). A felhasználói részt a webappban is el kell helyezni (például „Naptár jelölések” lap vagy súgó a Naptár beállításnál), az értelmezést pedig kódban és tesztekkel meg kell valósítani.
- A webapp **írjon a számítógépre a megfelelő CSV-fájlba** (File System Access API: Chrome/Edge), hogy a skill ezt olvassa.

## Naptár-regisztráció: hogyan működik (a felhasználó teendője is)
A „regisztrálás” kétféle lehet, ezért tisztázni kell:
- **Alkalmazás-regisztráció (egyszer, a fejlesztő/felhasználó végzi):** egy **Google Cloud OAuth-ügyfél** (Web application, a GitHub Pages cím mint engedélyezett eredet; jogosultság: `calendar.events.readonly` vagy `calendar.readonly`) és egy **Microsoft Entra (Azure) alkalmazás-regisztráció** (Single-page application, átirányítási cím a webapp címe, „bármely szervezeti címtár és személyes Microsoft-fiók”, delegált jogosultság: `Calendars.Read`). Ezt a felhasználónak kell létrehoznia a saját fiókjával; az ügyfélazonosítókat (client ID, nem titok) a webapp kódba kell tenni.
- **Felhasználónkénti engedélyezés (minden kolléga):** a webappban a „Naptár összekapcsolása” gomb → Google/Microsoft bejelentkezés és hozzájárulás. Nem kell külön Cloud-projektet létrehozniuk.
- **Google:** a naptár jogosultság „érzékeny”. Ellenőrzés nélkül „nem ellenőrzött alkalmazás” figyelmeztetés jelenik meg (Haladó › Tovább), és legfeljebb 100 felhasználó engedélyezhető. Tesztelési módban a hozzáférési token 7 naponta lejár, ezért „Production” (éles) módban, ellenőrzés nélkül ajánlott használni. Ennek pontos feltételeit a megvalósításkor a Google aktuális dokumentációjában ellenőrizni kell.
- **Microsoft:** szervezeti (munkahelyi) fiókoknál a szervezet letilthatja a felhasználói hozzájárulást, ilyenkor rendszergazdai jóváhagyás kell. Személyes Microsoft-fiókkal (outlook.com) ez nem akadály. A leírásnak ezt is tartalmaznia kell.
- Tokenek: PKCE-folyam (kliens titok nincs), a token a böngészőben (IndexedDB/localStorage) marad. A webapp csak olvas.

## Feladatok
1. **Naptárolvasás Google és Outlook naptárból**, a jelölési szabály szerint (`NAPTAR_JELOLESEK.md`): értelmező modul (`calendarParser.js`), tesztek (minden típus, elválasztó, hibás bemenet, éjfélen átnyúló, többnapos egész napos, négy időzóna), „Átvett / Hiányos / Nem felismert” lista, duplázás elleni azonosító (új CSV-oszlop `Naptár azonosító`; a Mac-alkalmazással közös formátum, a régi fájlok maradjanak olvashatók). Csak lezajlott események.
2. ~~**Helyi CSV-írás (File System Access API):**~~ (kész a 0.2-ben; a Windowson való kipróbálás hátra van) a felhasználó egyszer kiválaszt egy mappát/fájlt, a webapp minden változtatáskor frissíti a `bejegyzesek.csv`-t (UTF-8 BOM, pontosvessző, CRLF, a Mac-formátummal azonos). Engedély újraadás kezelése, a fájlkezelő megnyitása, hibakezelés (nem támogatott böngésző: letöltés tartalékként). Ellenőrizni: mely mappákat tiltja le a Chrome (például AppData).
3. ~~**Részletes leírás a skill telepítéséhez**~~ (kész a 0.2-ben: 6 lépéses varázsló, ZIP, parancsok, kiírás mappába) a webappban (külön lap, lépésről lépésre): Windowson hova kerül a skill (`%USERPROFILE%\.claude\skills`, `%USERPROFILE%\.agents\skills` Codex és Antigravity CLI), a skill beszerzése (a webapp kitöltött csomagot generál a név, székhely, gyülekezetek, DET/TET alapján, letölthető ZIP-ként, esetleg kiválasztott mappába írva), az `agy` telepítése Windowson (`irm https://antigravity.google/cli/install.ps1 | iex`), a Codex és a Claude elérése, a `beallitasok.json`/adatfájl-útvonal megadása, a bejelentkezés az OTS-be, a használat. A skill sablon és a Windows-eltérések: `skill-template/ots-adminisztracio/` és `docs/WINDOWS_PROMPT.md`.
4. ~~**Asztali funkciók pótlása** a Mac-alkalmazásból~~ (kész a 0.2-ben; a menüsori/tálcaikon, az indítás bejelentkezéskor és a leválasztott ablak a böngészőben nem megvalósítható, a hátralévő idő a böngészőfül címében látszik)
5. Dokumentáció: `web/README.md`, a Windows-leírás, változásnapló; közzététel: `./scripts/publish-web.sh "üzenet"`.

## Kockázatok
- A skill-telepítés böngészőből korlátozott (rendszermappák tiltása), ezért kell a részletes kézi leírás és a letölthető csomag.
- A Google/Microsoft OAuth viselkedése változhat; a megvalósításkor a hivatalos dokumentációt kell követni.
- A böngészőt innen nem lehet Windowson kipróbálni: a felhasználónak kell Windowson tesztelnie; a logikát tesztek, a felületet renderelés igazolja.
