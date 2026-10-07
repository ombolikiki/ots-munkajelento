# Az OTS Munkajelentő Tracker adatai

Közös leírás azokhoz a feladatokhoz, amelyek a felhasználó **OTS Munkajelentő Tracker** nevű menüsori alkalmazásának adatait olvassák (Havi munkajelentő, Költségelszámolás, Gyülekezeti látogatottság).

## Adatforrás

A felhasználó menüsori appja (Mac) rögzíti az időt és a létszámokat. Az itt felsorolt feladatok **egyetlen adatforrása** ez az alkalmazás.

**Az adatfájl megkeresése:**
1. Olvasd be a `~/Library/Application Support/OTS Munkajelentő Tracker/beallitasok.json` fájlt, a `dataFile` mező a bejegyzések fájljának útvonala.
2. Ha a beállításfájl nincs meg, az alapértelmezett hely: `~/Library/Application Support/OTS Munkajelentő Tracker/bejegyzesek.csv`.
3. Ha egyik sincs meg, vagy az adott hónapra nincs bejegyzés, szólj a felhasználónak (lehet, hogy az app nincs elindítva, vagy más adatmappát használ), és várj. Ne találj ki adatot.
4. Régebbi verziók `bejegyzesek.json` fájlt írtak: ha csak ilyen van, az app a következő indításkor CSV-re alakítja. Kérd meg a felhasználót, hogy indítsa el az appot.

**Formátum:** CSV, **pontosvesszővel (`;`) tagolt**, UTF-8 (elején BOM lehet, a Pythonban `encoding="utf-8-sig"`), az első sor a fejléc. Az idézőjeles mezőkben lehet pontosvessző és sortörés (`csv.reader(f, delimiter=";")`). A felhasználó táblázatkezelőben szerkesztheti, ezért a fájl mindig friss állapotát olvasd be, és légy toleráns (üres sorok, szóközök). Oszlopok:
- `Dátum`: a kezdés helyi napja (`YYYY-MM-DD`; ha a táblázatkezelő átírta, `2026. 10. 03.` formátumú is lehet). **Ezzel csoportosíts napra.** Éjfélen átnyúló bejegyzésnél a kezdés napja.
- `Kezdés`, `Vége`: helyi idő (`HH:mm:ss`). **Üres** az egész napos típusoknál és a csak óraszámmal vagy csak mennyiséggel rögzített bejegyzéseknél.
- `Időtartam (mp)`: időtartam másodpercben. Óra jellegű bejegyzésnél ez az érték számít. **Ha a `Kezdés` és a `Vége` is ki van töltve, az időtartam = `Vége` − `Kezdés`** (ha a `Vége` korábbi, mint a `Kezdés`, másnapra esik), mert a felhasználó a táblázatban átírhatta az időpontokat. Az `Időtartam (óó:pp)` oszlop csak tájékoztató, ne használd.
- `Munkahely`: szabad szöveg, jellemzően településnév. **Utazás** típusnál (`TRAVEL`) a Munkahely(ek) listája, vesszővel elválasztva, sorrendben.
- `Indulás`, `Érkezés`: csak Utazás típusnál töltött (honnan indult, hová érkezett). Más típusnál üres. Régebbi sorokban (és régebbi fájlokban) az oszlopok hiányozhatnak vagy üresek.
- `Munkahely helye` (opcionális, a fájl végén; régebbi fájlokban hiányozhat): Utazásnál `indulás`, ha a felhasználó a Kiindulást jelölte munkahelynek. Ilyenkor az OTS **Munkahely** mezőjébe az `Indulás` oszlop értéke kerül (nem a `Munkahely` oszlopé), a `Munkahely` oszlop pedig csak az útvonal köztes helyeit adja (a Költségelszámoláshoz). Üres vagy hiányzó érték: a `Munkahely` oszlop helyei a munkahelyek. Az `Indulás cím`, `Érkezés cím`, `Cím` oszlopok pontos címeket tartalmaznak; ezeket **ne** használd, az OTS-be mindig a település kerül.
- `Induló km`, `Érkező km` (opcionális, a fájl végén; régebbi fájlokban hiányozhatnak): Utazásnál a kilométeróra állása az út elején és végén (egész szám, üres is lehet; az `Érkező km` mindig nagyobb az `Induló km`-nél). Oda-vissza útnál az egész körútra vonatkoznak (a visszaút is benne van). A Költségelszámolás **Ind. km** és **Érk. km** mezőjéhez használhatók (lásd references/koltsegelszamolas.md).
- `Típus kód`: **az OTS grid mezőazonosítója**, közvetlenül ezt kell használni: `PREACHING`, `VISITING`, `OFFICE_WORK`, `MEETING`, `EVANGELISATION`, `BIBLE_HOUR`, `MISSION_VISITING`, `TRAINING`, `HELD_TRAINING`, `ADMINISTRATION`, `PREPARING`, `TRAVEL`, valamint a nem munkaidős `HOLIDAY`, `DAY_OFF`, `PUBLIC_HOLIDAY`. A `Típus` oszlop ennek olvasható neve (ha a kód üres, abból azonosítható). **Az `EGYEDI_` kezdetű kódok a felhasználó saját, személyes kategóriái (pl. önképzés), nincs OTS-megfelelőjük: ezeket a Havi munkajelentőbe ne vidd át, a napi összegbe se számítsd bele.** Ha egy napon csak ilyen bejegyzés van, a nap OTS szempontból üresnek számít.
- `Egység`: `ora` | `alkalom` | `fo` | `egesz_nap`. `Mennyiség`: alkalom vagy fő (csak `alkalom` és `fo` egységnél van).
- `Tevékenység`: szabad szöveg; csak az Utazásnál kötelező (a Költségelszámolásba csak az Utazás bejegyzések Tevékenysége kerül), máshol opcionális, referencia, lehet üres. `Forrás`: `timer` | `pomodoro` | `manual` | `calendar` (csak tájékoztató). `Azonosító`: egyedi azonosító.

**Létszámjelentések:** a `beallitasok.json` `attendanceFile` mezője a létszámjelentések fájlját adja meg (alapból a bejegyzések mellett a `letszamjelentesek.csv`). Ha az `attendanceFile` mező hiányzik (régebbi beállításfájl), a `dataFile` mappájában keresd a `letszamjelentesek.csv` fájlt; a szerkezetét lásd references/latogatottsag.md.
