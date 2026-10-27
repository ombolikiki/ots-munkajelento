# Bejegyzések felvitele szabad szövegből

A felhasználó szabadon leírja, mit csinált (például: „Ma 9–10 között adminisztráltam. Tegnapelőtt volt egy két órás megbeszélésem.”), te pedig **bejegyzéseket készítesz belőle az OTS Munkajelentő Tracker számára**. Ehhez **nem kell megnyitni az OTS-t** és böngészőt sem, ez a feladat nem érinti az OTS-t. Az adatfájl és az oszlopok leírása: references/tracker-adatforras.md.

## A legfontosabb szabályok

1. **Az éles adatfájlhoz (`bejegyzesek.csv`) soha ne nyúlj.** A bejegyzéseket a vele **egy mappában lévő `bejegyzesek-import.csv`** fájlba írd. Az alkalmazás ezt áttekintésre mutatja (a fejlécben megjelenik egy ikon, és értesítést küld), és csak a felhasználó jóváhagyása után kerülnek az adatok közé.
2. **Ha valami nem egyértelmű, KÉRDEZZ.** Nincs alapértelmezés: ne tippelj típust, munkahelyet, időpontot, dátumot, mennyiséget. Egyetlen kérdésben kérdezd meg az összes hiányzót.
3. **Írás előtt mutasd meg** a felhasználónak a feldolgozott bejegyzéseket táblázatban (dátum, kezdés–vég vagy időtartam, típus, munkahely, tevékenység, mennyiség), és csak a visszaigazolás után írd a fájlba. Ha a felhasználó javít, javíts, és mutasd újra.
4. **Nincs jövőbeli bejegyzés.** A mai dátumot a rendszeróráról vedd (`date`), ne a memóriádból. Jövőbeli időpontot ne rögzíts: szólj.
5. A kitalált adat tilos: csak azt vidd fel, amit a felhasználó mondott. Ami a szövegből egyértelműen következik (például „tegnapelőtt” = a mai nap − 2 nap), azt felhasználhatod, de a táblázatban mutasd meg.

## Mit kell kinyerni a szövegből

- **Dátum:** abszolút (`október 23.`, `2026-10-20`) vagy relatív (`ma`, `tegnap`, `tegnapelőtt`, `múlt kedden`, `hétfőn`). Ha a relatív kifejezés nem egyértelmű (például „múlt héten”, „a hétvégén”), kérdezz.
- **Idő:** `9–10 között`, `9:00–10:30`, `fél 3-tól 4-ig` → `Kezdés` és `Vége` (helyi idő, `HH:MM:SS`). Ha csak időtartam van (`két órás`, `másfél óra`), a `Kezdés` és a `Vége` **maradjon üres**, az `Időtartam (mp)` kapja az értéket (óra jellegű típusnál; ez megfelel a Kézi bevitel „Óraszám” módjának). Alkalom és fő típusnál nincs időtartam, csak mennyiség.
- **Típus:** a leírás alapján a következők egyike (a `Típus kód` az OTS rácsának azonosítója):

| Mit mond a felhasználó | Típus kód | Egység |
|---|---|---|
| istentisztelet, prédikáció tartása | `PREACHING` | alkalom |
| látogatás (gyülekezet) | `VISITING` | fő |
| missziós látogatás | `MISSION_VISITING` | fő |
| ügyintézés | `OFFICE_WORK` | óra |
| értekezlet, megbeszélés | `MEETING` | óra |
| evangelizáció | `EVANGELISATION` | alkalom |
| bibliaóra | `BIBLE_HOUR` | alkalom |
| továbbképzésen részt vett | `TRAINING` | óra |
| továbbképzést tartott | `HELD_TRAINING` | óra |
| adminisztráció | `ADMINISTRATION` | óra |
| felkészülés | `PREPARING` | óra |
| utazás | `TRAVEL` | óra |
| szabadság | `HOLIDAY` | egesz_nap |
| szabadnap | `DAY_OFF` | egesz_nap |
| munkaszüneti nap | `PUBLIC_HOLIDAY` | egesz_nap |
| ünnepnap | `FEAST_DAY` | egesz_nap |
| pihenőnap | `REST_DAY` | egesz_nap |

  Ha a leírás **több típusra is illik** (például „adminisztráltam” lehet `ADMINISTRATION` vagy `OFFICE_WORK`; „látogatás” lehet `VISITING` vagy `MISSION_VISITING`), **kérdezz**.
- **Munkahely** (kötelező minden nem egész napos, nem Utazás bejegyzésnél): ha a szövegből nem derül ki, kérdezd meg. Az egész napos típusoknál nem kell.
- **Mennyiség** (alkalom és fő típusnál): ha nincs megadva, kérdezd meg.
- **Tevékenység:** a felhasználó leírása röviden (nem kötelező, kivéve Utazásnál). Ünnepnapnál az ünnep neve, pihenőnapnál a rövid leírás (ezekből lesz az OTS Munkahely szövege: `ÜNNEPNAP - <NÉV>` / `PIHENŐNAP - <LEÍRÁS>`, a skill a Havi munkajelentőnél nagybetűvel írja).
- **Utazás:** kötelező a `Indulás` (a Kiindulás település), a `Munkahely` (a Cél településeinek vesszős listája), az `Érkezés`, és a `Tevékenység` (az út célja). Hogy oda-vissza volt-e az út, ha nem derül ki, **kérdezd meg**: oda-vissza útnál az `Érkezés` = az `Indulás`; egyirányú útnál az `Érkezés` = a Cél utolsó helye. Pontos cím esetén a `Cím`, `Indulás cím`, `Érkezés cím` oszlop is kitölthető (lásd references/tracker-adatforras.md). A kilométeróra állása (`Induló km`, `Érkező km`) opcionális.

## A fájl írása

- **Formátum:** a bejegyzések fájljával megegyező: 22 oszlop, pontosvessző, UTF-8, CRLF sorvég, a fejléc (és a BOM) csak új fájlnál. Ha az importfájl már létezik (korábbi, még el nem fogadott bejegyzések), **fűzd hozzá** az újakat, a meglévőt ne írd felül.
- Minden bejegyzésnek **új, egyedi `Azonosító`** (UUID) kell. **`Forrás` = `ai`** (az alkalmazás ebből tudja, honnan jött).
- Az oszlopok sorrendje és neve: `Azonosító; Dátum; Kezdés; Vége; Időtartam (mp); Időtartam (óó:pp); Indulás; Munkahely; Érkezés; Típus kód; Típus; Egység; Mennyiség; Tevékenység; Forrás; Cím; Naptár azonosító; Indulás cím; Érkezés cím; Munkahely helye; Induló km; Érkező km`. A `Típus` a típus magyar neve (például `Adminisztráció`), az `Időtartam (óó:pp)` a `Időtartam (mp)` értékéből számolt (`H:MM`). A nem használt oszlopok üresek.

Használd ezt a Python-kódot (a `ROWS` listát töltsd ki, a többit ne módosítsd; az útvonalat a `beallitasok.json` `dataFile` mezőjéből vedd, lásd references/tracker-adatforras.md):

```python
import csv, os, uuid, json

settings = os.path.expanduser("~/Library/Application Support/OTS Munkajelentő Tracker/beallitasok.json")
data_file = json.load(open(settings, encoding="utf-8")).get("dataFile") if os.path.exists(settings) else None
data_file = data_file or os.path.expanduser("~/Library/Application Support/OTS Munkajelentő Tracker/bejegyzesek.csv")
path = os.path.join(os.path.dirname(data_file), "bejegyzesek-import.csv")

HEADER = ["Azonosító", "Dátum", "Kezdés", "Vége", "Időtartam (mp)", "Időtartam (óó:pp)", "Indulás", "Munkahely", "Érkezés",
          "Típus kód", "Típus", "Egység", "Mennyiség", "Tevékenység", "Forrás", "Cím", "Naptár azonosító", "Indulás cím",
          "Érkezés cím", "Munkahely helye", "Induló km", "Érkező km"]

# Minden elem: szótár a fejléc nevei szerint (ami hiányzik, az üres). Példa:
ROWS = [
    {"Dátum": "2026-10-27", "Kezdés": "09:00:00", "Vége": "10:00:00", "Időtartam (mp)": 3600, "Időtartam (óó:pp)": "1:00",
     "Munkahely": "Székesfehérvár", "Típus kód": "ADMINISTRATION", "Típus": "Adminisztráció", "Egység": "ora",
     "Tevékenység": "Levelezés"},
]

new_file = not os.path.exists(path)
with open(path, "a", encoding="utf-8-sig" if new_file else "utf-8", newline="") as f:
    w = csv.writer(f, delimiter=";", lineterminator="\r\n")
    if new_file:
        w.writerow(HEADER)
    for r in ROWS:
        r = dict(r, **{"Azonosító": str(uuid.uuid4()).upper(), "Forrás": "ai"})
        w.writerow([r.get(h, "") for h in HEADER])
print("Írva:", path, len(ROWS), "bejegyzés")
```

## Lezárás

Miután megírtad a fájlt, mondd meg a felhasználónak, hogy **nyissa meg az OTS Munkajelentő Tracker alkalmazást**: a fejlécben megjelenik egy áttekintés ikon (és értesítés), ott elfogadhatja, elvetheti vagy javíttathatja a bejegyzéseket (a Beállítások › OTS fülön is megnyitható). Az alkalmazás jelzi, ha egy bejegyzés nem fogadható el (például hiányzó kötelező mező, jövőbeli időpont), vagy ha már van ilyen bejegyzés: ilyenkor javítsd ki a bejegyzést, és írd át az importfájlt (csak az importfájlt!).
