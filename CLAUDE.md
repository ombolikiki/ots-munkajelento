# OTS Munkajelentő (webalkalmazás) – fejlesztési szabályok

Önálló forrás: ez a tár a webalkalmazás (Windows/Chrome, telepíthető PWA), a GitHub Pages innen szolgál ki (https://ombolikiki.github.io/ots-munkajelento/). A natív Mac-alkalmazás külön tárban van (`ots-munkajelento-mac`); a közös szabályokat (üzleti szabályok, CSV-formátum, naptár-jelölések) mindkettőben azonosan kell tartani. Magyarul kommunikálj a felhasználóval.

## Kötelező szabályok
1. **A dátumszámítás nem omolhat össze.** A napokat `ÉÉÉÉ-HH-NN` szövegként kezeljük, soha nem `new Date("ÉÉÉÉ-HH-NN")` (UTC-ként értelmeződne). Kezelni kell az évhatárt, a negyedévhatárt, a szökőnapot, a nyári időszámítást. Új dátum-alapú funkcióhoz teszt kell 2024–2035 között, minden negyedévre, **négy időzónában** futtatva: `for TZ in Europe/Budapest America/New_York Pacific/Auckland UTC; do TZ=$TZ node --test test/*.test.js; done`.
2. **Szám- és CSV-olvasás sosem omolhat össze** hibás bemenettől (`inf`, `1e99`); a hibás sort kihagyja, és mentés előtt másolat készül a fájlról. A CSV-formátum bájtra azonos a Mac-alkalmazáséval (pontosvessző, UTF-8 BOM, CRLF, 20 oszlop; az utolsó öt `Cím`, `Naptár azonosító`, `Indulás cím`, `Érkezés cím`, `Munkahely helye`); nem módosítható eltérően.
3. **Függőség nélküli** sima JavaScript (ES modulok). Személyes adat, token vagy titok nem kerülhet a (nyilvános) tárba; a client ID nem titok, a kliens titok (secret) nem kell és nem is használunk.
4. **A naptárba soha nem írunk** (csak olvasási jogosultság: Google `calendar.readonly`, Microsoft `Calendars.Read`).
5. Az `sw.js` `CACHE` nevét minden közzétett változásnál emeld, az új fájlokat vedd fel a `FILES` listába (a README-ben is szerepel). A közzététel: `./scripts/publish.sh "üzenet"`; utána várd meg, hogy az éles `sw.js` az új verziót adja (ha a GitHub Pages építése elakad: `gh api -X POST repos/ombolikiki/ots-munkajelento/pages/builds`).
6. Az űrlap gombjainak állapotát beíráskor is frissíteni kell (`refreshGate`), mert a gépelés nem rajzolja újra az oldalt; valódi billentyűeseményekkel is teszteld. A CSS-osztályok neve egyedi legyen (korábban a `.head`, `.big`, `.block` ütközött).
7. A skill (`skill-template/ots-adminisztracio`) az egyetlen közös forrás: itt kézzel karbantartott, a `scripts/sync-web-skill.py` állítja elő belőle a `skill/bundle.json` csomagot (a `check-skill-template.py` személyes adatot nem enged át). Skill-módosítás a sablonban történik.

## Üzleti szabályok (ne változtasd kérés nélkül)
- A Tevékenység csak az Utazásnál kötelező. Utazás: Kiindulás (egy hely) és Cél (egy vagy több hely), mindegyik település vagy település és pontos cím; az Oda-vissza alapból bejelölt (Kiindulás - Cél(ek) - Kiindulás); a Munkahely a Cél vagy a Kiindulás; az OTS-be a település kerül, a cím csak a Maps-hez. Időzítő: korábbi Kezdés (legfeljebb a mai nap elejéig). Hétvége (1.5.6): szombaton és vasárnap nincs napi óraszám (bármilyen bejegyzés elég), de az üres szombat és vasárnap jelez; az egész napos bejegyzés kitöltött nap. A skill nem egészít ki 8 órára; az üres napra (vasárnapra is) `!!!` kerül, a szabadnapot a Szabadnap bejegyzés jelöli. Havonta legfeljebb annyi SZABADNAP és annyi MUNKASZÜNETI NAP lehet, ahány hét van a hónapban (`weeksInMonth`), átlépéskor figyelmeztetés (nem akadályoz). 1 fő / 1 alkalom = 1 óra. Jövőbeli bejegyzés nem rögzíthető.
- A naptáresemények jelölése: `docs/NAPTAR_JELOLESEK.md` (végleges, közös a Mac-appal). Az értelmező és a szinkron: `src/calendarParser.js`, `src/calendarSync.js`.

## Kipróbálás
- Helyi szerver: `scripts/dev-server.py` (http://localhost:8123); a service worker-t fejlesztés közben töröld (különben a régi fájlokat adja).
- A Windowst, a valódi Chrome mappaválasztót és a valódi Google/Microsoft bejelentkezést innen nem lehet kipróbálni: logikát tesztek (hamis mappával, hamis naptár-forrással), felületet a beépített böngészőpanel igazol; mondd ki, mit nem láttál élesben.
