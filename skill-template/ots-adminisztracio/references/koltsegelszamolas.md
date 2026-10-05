# Költségelszámolás

Havi útiköltség-elszámolás. A Határidők oldalon "Költségelszámolás" néven szerepel (TASK = 8, OPERATION = 1 Lezárás, felhasználó neve az érintett, pl. "2026. szeptember"). A Költségelszámolás oldal: Lelkész > Költségelszámolás. Az adatok forrása az **OTS Munkajelentő Tracker** adatfájlja: a hónap **Utazás** bejegyzései (`Típus kód = TRAVEL`), mindegyiknek van **Indulás**, **Munkahely(ek)** és **Érkezés** mezője (az adatfájl megtalálása és szerkezete: references/tracker-adatforras.md). A feladat nem igényli a Havi munkajelentő lap megnyitását.

## Menet

1. Olvasd ki a Határidők oldalt (lásd a SKILL.md "Határidők oldal" részét), és ellenőrizd, van-e Költségelszámolás (TASK = 8) sor.
   - Ha nincs, ugord át a többi lépést. A feladat lezárult, írd ki a lezáró üzenetet (lásd lent).
   - Ha van, folytasd a 2. lépéssel.
2. Nyisd meg a Költségelszámolás feladatot (duplakattintás a soron), és nézd meg, melyik **hónapra** vonatkozik a Költségelszámolás táblázat (az időszak).
3. Olvasd be a tracker adatfájljából az adott hónap **Utazás** bejegyzéseit (`Típus kód = TRAVEL`), időrendben (`Dátum`, `Kezdés`). Ha a hónapra nincs Utazás bejegyzés, ne találj ki útvonalat: szólj a felhasználónak.
4. **Az útvonal összeállítása** minden Utazás bejegyzésre: `Indulás - Munkahely1 - Munkahely2 - … - Érkezés`.
   - Az `Indulás` és az `Érkezés` az azonos nevű oszlopból jön. Ha valamelyik üres (régebbi bejegyzés), a székhely ({{SZEKHELY}}) az alapértelmezett.
   - A `Munkahely` oszlop vesszővel elválasztott településeket tartalmazhat. Az útvonalban **sorrendben** szerepeljenek.
   - Az egymás melletti azonos helyeket vond össze (pl. ha az Indulás megegyezik az első munkahellyel, ne szerepeljen kétszer).
   - Csak a **települést** használd (más szöveget, pl. épületnevet ne vegyél át).
   - **Bizonytalan esetben** (pl. nem egyértelmű településnév) tegyél a sor elejére `!!!` előtagot (az Útvonal mező elejére), hogy a felhasználó lássa és javítsa.
5. Írd az útvonalat a Költségelszámolás adott dátumhoz tartozó sorának **Útvonal** mezőjébe.
   - Ha egy napra **több** Utazás bejegyzés van, az útvonalakat ` ; `-vel elválasztva írd ugyanabba a sorba, és tegyél a sor elejére `!!!` előtagot, hogy a felhasználó ellenőrizze. A km a részútvonalak összege.
6. Amint jóváhagytad az Útvonal mezőt, az **Ind. km** mezőben megjelenik a kezdő kilométer (az előző hónap göngyölített értéke).
7. A **Google Maps** segítségével számold ki, hány kilométer az útvonal: a pontokat sorban add meg (Indulás, a munkahelyek sorrendben, Érkezés). Útvonaltípus: **autóval, a leggyorsabb út** (az autópálya használható; ha a felhasználó jelzi, hogy nincs autópálya-matricája, kerüld el).
8. **A legelső kitöltendő sornál, mielőtt a Google Mapsből kapott km-t hozzáadnád az Ind. km-hez, kérdezd meg a felhasználót** (a hónap többi sorára a választás érvényes marad, nem kell újra kérdezni):
   - **Maradjon a göngyölített km az előző hónapból?** Ha ezt választja, az automatikusan beírt Ind. km-hez add hozzá a Google Maps km-eit, és az összeget írd az Érk. km mezőbe.
   - **Van friss, leolvasott km az autó kilométerórájáról?** Ha ezt választja, kérd meg, hogy adja meg a friss kilométert. Ezt az értéket írd be az **Ind. km** mezőbe, ehhez add hozzá a Google Mapsből kiolvasott km-t, és az új összeget írd az **Érk. km** mezőbe.
9. Az Érk. km = Ind. km + a Google Maps km. Ha a Google Maps tizedes km-et ad (pl. 83,5), mindig **felfelé kerekíts** egész km-re.
10. **Tevékenység mező kitöltése a trackerből:** minden kitöltött Útvonal-sor dátumához írd a **Tevékenység** mezőbe **kizárólag az aznapi Utazás bejegyzések (`Típus kód = TRAVEL`) `Tevékenység` szövegét** (különböző szövegek, `; `-vel elválasztva, ismétlődés nélkül). **Más típusú bejegyzés (értekezlet, látogatás stb.) tevékenységét ne vedd át**, akkor sem, ha a munkahelye az útvonalon szerepel. Az Utazás bejegyzésnél a Tevékenység kötelező a trackerben, ezért általában ki van töltve; ha mégis üres, hagyd üresen a mezőt.
    Utána **állj meg**, **kérd meg a felhasználót, hogy nézze át és szükség esetén javítsa a Tevékenység mezőket**, és várd meg a visszaigazolását. Ne menj tovább.
11. A visszaigazolás után, **a lezárás előtt** ellenőrizd (a) van-e a Költségelszámolás táblázatban `!!!` előtag (bármelyik sor bármelyik mezőjében), és (b) minden Útvonallal rendelkező sor **Tevékenység** mezőjében van-e szöveg. Ha bármelyik hibás, **akaszd meg a munkát**, jelezd a felhasználónak (melyik sor, mi a probléma), hogy javítsa, és ne zárd le a lapot. A javítás és az újabb jelzés után futtasd le az ellenőrzést újra.
12. Ha nincs `!!!`, zárd le a lapot a **"Hónap lezárása"** (vagy hasonló nevű) gombbal.
13. A felugró ablakon hagyd jóvá a lezárást.
14. Írd ki a lezáró üzenetet.

## Szabályok

- Az útvonalat mindig az Utazás bejegyzés Indulás, Munkahely(ek), Érkezés mezői adják; ne következtess útvonalat más bejegyzésekből.
- **Oda-vissza út:** a trackerben bejelölt „Oda-vissza” esetén az Érkezés megegyezik az Indulással (`A - B - A`); az útvonalat így kell használni, a Google Maps a teljes oda-vissza távolságot számolja (az `A` pontok nem szomszédosak, ezért nem vonódnak össze).
- Minden Utazás bejegyzés a saját útvonalát kapja. Többnapos kiszállásnál (pl. oda- és visszaút külön napon) két külön bejegyzés és két külön útvonal van, a fél-fél távolság szabály már nem érvényes.
- A `!!!` előtagot ne értelmezd településként.

## Lezárás előtti ellenőrzés (Tevékenység mező)

- **Emlékeztesd a felhasználót**, hogy a lezárás előtt minden kitöltött sor **Tevékenység** mezőjébe írnia kell valamit (ezt a felhasználó tölti ki).
- Az utolsó ellenőrzéskor (a `!!!` ellenőrzés mellett) **ellenőrizd**, hogy minden Útvonallal rendelkező sor Tevékenység mezőjében van-e szöveg. Ha valamelyik üres, akaszd meg a munkát, jelezd, melyik sor, és ne zárd le a lapot.

## Megerősített döntések

- A hónapot a Költségelszámolás táblázatból kell kiolvasni, és ahhoz a hónaphoz tartozó Utazás bejegyzéseket kell használni.
- Több település egy útvonalban: sorrendben, a Google Maps többpontos útvonalával.
- Bizonytalan esetben `!!!` az Útvonal mező elején.
- Google Maps: autóval, a leggyorsabb út.
- A Tevékenység mezőt a skill előtölti az **Utazás bejegyzések** `Tevékenység` szövegéből (más kategóriából nem), a felhasználó átnézi és javítja. A **Típus** mezőt csak különleges esetekben kell megadni, ezt a felhasználó tölti ki; üresen hagyható, és a lezárás előtti ellenőrzésnek nem tárgya.

## Befejezés

Amikor a feladat lefutott (a lap lezárva, vagy nem volt Költségelszámolás határidő), írd ki jól láthatóan:

> ## ✅ A feladat befejeződött: Költségelszámolás

Röviden foglald össze, mit végeztél el (melyik hónap). Ezután kérdezd meg a felhasználót, hogy mivel folytassuk.

## Technikai tapasztalat (teszt 2026-10-02)

- A Költségelszámolás oldal grid-je: `document.querySelector('iframe').contentWindow.$$('yo_Grid')`. Mezők: ROUTE (Útvonal), ACTIVITY (Tevékenység), TRAVEL_TYPE_ID (Típus, combo), START_KM (Ind. km), END_KM (Érk. km), DIFF (Megtett km, számolt), COST_CALC (Költség, számolt). Fülek: Főkönyv, Egyéb költségek, és az autó (pl. "NFH397 Ford Mondeo", ezen a fülön van az Útvonal tábla).
- Bevitel ugyanúgy, mint a munkajelentőnél: `g.editCell(id,'ROUTE'); g.getEditor().getInputNode().value='...'; g.editStop();`. Az Útvonal rögzítése után kb. 1-2 mp múlva az `START_KM` automatikusan kitöltődik (a sor elmentésekor). Az `END_KM` megadása után a `DIFF` és a `COST_CALC` magától kiszámolódik.
- Az `END_KM` = `START_KM` + a Google Maps km-ek.
- Google Maps: `https://www.google.com/maps/dir/<Indulás>/<Munkahely1>/<Munkahely2>/<Érkezés>/` (autó az alapértelmezett, a lista tetején a leggyorsabb út, a "km" értéke az egész útra vonatkozik). Az első betöltéskor süti-elfogadó oldal jön: a "Az összes elutasítása" gombot kell választani.
- Egy sor mentése után a sor `id`-ja megváltozik (átmeneti azonosítóról szerverazonosítóra), ezért **minden szerkesztés előtt újra olvasd ki az id-t** (`g.serialize()[nap-1].id`), ne tárold el.
- Az `START_KM` az előző kitöltött sor `END_KM`-je lesz, ezért a sorokat **időrendben** töltsd ki. Ha a Google Maps tizedes km-et ad (pl. 83,5 vagy 40,7), mindig **felfelé kerekíts** egész km-re (84, illetve 41). (Felhasználó megerősítette.)
- Ha egy fül (tab) új oldalra lép, ellenőrizd az oldal címét és az `ROUTE` oszlop meglétét, mielőtt írsz.
- Lezárás: a **Hónap lezárása** gomb (a felső sorban, a fogaskerék mellett) megerősítő ablakot nyit ("Biztos, hogy lezárod?", Nem / Igen). Az **Igen** gombra kattintva a gomb pirosra vált, és felirata **"Lezárt hónap!"** lesz: ez jelzi a sikeres lezárást.
