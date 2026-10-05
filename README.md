# OTS Munkajelentő – mobilos webalkalmazás (0.1, helyben tároló)

Telepíthető webalkalmazás (PWA) iPhone-ra és Androidra, az OTS Munkajelentő Tracker Mac-alkalmazás társa. **Az adatok csak a készüléken, a böngésző tárhelyén maradnak**, szerver nincs. A CSV-formátum bájtra azonos a Mac-alkalmazáséval, így a Macen beolvasható, és a skill használni tudja.

## Mit tud (0.1)
- **Időzítő:** típus, munkahely, tevékenység (Utazásnál kötelező, Indulás/Érkezés és Oda-vissza jelölő), Start/Stop. A kezdési időből számol, ezért az újratöltést és a háttérbe kerülést is túléli.
- **Bevitel:** kézi felvitel tól–ig időponttal vagy óraszámmal, mennyiség (fő/alkalom), egész napos típusok. Jövőbeli nap és időpont nem rögzíthető.
- **Napok:** napi lista kategóriaszínekkel, napi összesítő a 8 órás jelzéssel, kitöltetlen napok az aktuális hónapban.
- **Adatok:** székhely, napi óraszám, helyszínek, **CSV exportálás** (iPhone-on a megosztás menün át, Fájlokba/iCloud Drive-ba menthető) és **importálás** (összefésülés azonosító szerint), mentési emlékeztető, törlés.
- Hiányzik még (a Mac-alkalmazásban megvan): Pomodoro, naptár-nézet, létszámjelentő, Kézi felvitel az OTS-be nézet, saját kategóriák és színek.

## Kipróbálás
Tesztek (Node 20+, nincs függőség):

```bash
cd web && node --test test/*.test.js
for TZ in Europe/Budapest America/New_York Pacific/Auckland UTC; do TZ=$TZ node --test test/*.test.js; done
```

Futtatás a gépen: `cd web && python3 -m http.server 8080`, majd a böngészőben: http://localhost:8080

Telefonon a helyi hálózaton ugyanez a Mac IP-címén (`ipconfig getifaddr en0`) megnyitható, **de a főképernyőre telepítéshez és az offline működéshez HTTPS kell** (a böngészők csak titkosított címen engedik a service workert). Ehhez a `web/` mappa tartalma feltölthető bármelyik statikus tárhelyre (pl. Cloudflare Pages, GitHub Pages, Netlify).

## Telepítés a telefonra
- **iPhone (Safari):** Megosztás › „Főképernyőhöz adás”.
- **Android (Chrome):** ⋮ menü › „Alkalmazás telepítése”.

## Ismert korlátok
- A böngésző a háttérben leállítja az oldalt, ezért nincs zárolt képernyős értesítés/Live Activity, és a Pomodoro-végi hang csak nyitott alkalmazásnál szólalna meg (a Pomodoro még nincs benne).
- iPhone-on a Safari ritkán használt oldalaktól törölheti a tárhelyet, ezért érdemes időnként CSV-t exportálni (az alkalmazás emlékeztet).
- A telefon és a Mac között nincs automatikus szinkron: az átvitel CSV-vel történik (export a telefonról, import a Macen, vagy fordítva).

## Felépítés
`src/dates.js` (védett dátumkezelés), `types.js` (OTS-típusok), `csv.js` (a Mac-formátum), `insights.js` (összesítések), `entries.js` (űrlap- és bejegyzésszabályok), `store.js` (helyi tárolás), `app.js` (felület), `sw.js` (offline gyorsítótár). A szabályok (dátum nem omolhat össze; Tevékenység csak az Utazásnál kötelező; oda-vissza út; 1 fő/alkalom = 1 óra; a saját kategória nem számít az OTS-be) megegyeznek a Mac-alkalmazáséval, lásd a projekt `CLAUDE.md` fájlját.
