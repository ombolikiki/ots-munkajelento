# Naptári jelölések: hogyan vidd fel a tevékenységeidet a naptárba

Ez a leírás a **naptárintegráció** közös előírása: a natív Mac-alkalmazás (EventKit) és a webalkalmazás (Google és Outlook naptár) is ezek szerint értelmezi a naptáresemények címét, idejét és helyszínét. Két célja van: (1) a felhasználónak egyszerű, emberi jelölési szabály legyen, (2) a megvalósítóknak pontos értelmezési szabály.

> **Röviden:** egy esemény = egy bejegyzés. A **cím** így néz ki: `Típus: Mit csináltál`. A **helyszín** mező a munkahely (település). Az **időpont** a kezdés és a vég. Néhány típusnál a címbe kerül még egy mennyiség (`×3`) vagy egy útvonal.

## 1. Melyik naptárat használd?

- **Ajánlott: külön naptár** „OTS Munkajelentő” néven (Google Naptárban, Outlookban vagy a Mac Naptár-alkalmazásban). Az alkalmazás a személyes eseményeidet így sosem olvassa be.
- Az alkalmazásban kiválasztod, melyik naptár(ak)ból olvasson. Ha több naptárat választasz, csak a **felismerhető típussal kezdődő** című események kerülnek be (lásd lent). A többit nem veszi át.
- Csak a **már lezajlott** eseményeket veszi át (a jövőbelit nem, és a ma még nem lejárt eseményt sem).
- A **visszautasított** és a **törölt** eseményeket kihagyja. A „talán” (tentative) eseményt beveszi.
- **A naptár a mérvadó:** a naptárban utólag módosított esemény bejegyzése frissül, a naptárban törölt eseményhez tartozó, naptárból átvett bejegyzés az alkalmazásból is törlődik. A kézzel felvitt bejegyzést a szinkron soha nem érinti. Törlés előtt másolat készül az adatfájlról.

## 2. A cím szerkezete

```
Típus: Mit csináltál
```

- A **típus** a kettőspont előtti szó vagy szavak (kisbetű/nagybetű és ékezet nem számít). A kettőspont (`:`) után jön a **Tevékenység** (rövid leírás), ez a Mac-appban és a webappban a Tevékenység mező.
- A Tevékenység **opcionális**, kivéve az Utazásnál (ott kötelező, mert a Költségelszámolásba kerül).
- A típus és a leírás között `:` helyett ` - ` (szóköz-kötőjel-szóköz) is elfogadott.

### Elfogadott típusnevek

| Típus az OTS-ben | Ezt írd a cím elejére (bármelyik) | Mértékegység |
|---|---|---|
| Istentisztelet | `Istentisztelet` | alkalom |
| Látogatás (gyülekezet) | `Látogatás` | fő |
| Látogatás (misszió) | `Missziós látogatás` | fő |
| Ügyintézés | `Ügyintézés`, `Ügy` | óra |
| Értekezlet | `Értekezlet`, `Ért` | óra |
| Evangelizáció | `Evangelizáció`, `Evang` | alkalom |
| Bibliaóra | `Bibliaóra`, `Bibl` | alkalom |
| Továbbképzés – résztvevő | `Továbbképzés`, `Képzés` | óra |
| Továbbképzés – tartott | `Tartott képzés`, `Tartott továbbképzés` | óra |
| Adminisztráció | `Adminisztráció`, `Admin` | óra |
| Felkészülés | `Felkészülés`, `Felk` | óra |
| Utazás | `Utazás`, `Utaz` | óra |
| Szabadság | `Szabadság` | egész nap |
| Szabadnap | `Szabadnap` | egész nap |
| Munkaszüneti nap | `Munkaszüneti nap`, `Munkaszüneti` | egész nap |

A rövid alakok kényelmesek telefonon. A felismerés a cím **elején** történik: a leghosszabb egyező névvel, ezért a `Missziós látogatás` nem keveredik a `Látogatás`-sal.

## 3. A munkahely (település)

- **Az esemény Helyszín mezője** a Munkahely. Elég a település neve (például `Győr`).
- Ha a Helyszín egy teljes cím (például `Fő utca 3., Győr`), a települést a lenti „Pontos cím megadása” szabály szerint állapítja meg (a mentett helyszínlistát nem használja). Ha nem talál települést, az eseményt a „Hiányos” listára teszi, ahol egy érintéssel megadhatod.
- **Gyors alternatíva a címben:** `@Település`, például `Értekezlet @Győr: Heti megbeszélés`. Ha a Helyszín mező és a `@` is meg van adva, a `@` az erősebb.
- Ha egyik sincs megadva, az esemény a „Hiányos” listára kerül (a Munkahely kötelező mező, kivéve az egész napos típusoknál).

### Pontos cím megadása

- A Helyszín mezőbe **teljes cím** is írható: `Fő utca 3., Győr`. A **település** a cím **utolsó vessző utáni része** (irányítószám nélkül); ez lesz a Munkahely. Ha nincs vessző (például `Győr`), az egész szöveg a település, és ez nem számít pontos címnek.
- **Több címet kötelezően ` - `-vel** (szóköz-kötőjel-szóköz) kell elválasztani: `Fő utca 3., Győr - Mór u. 5., Mór` két külön cím. A címen belüli kötőjel (`Győr-Moson`, `Szent-Györgyi u.`) nem választ el, csak a szóközzel körülvett.
- A település keresésekor az irányítószám és a záró „Magyarország” elmarad; ha az utolsó rész házszámos, a megelőző, szám nélküli részt nézi (így a `Győr, Fő utca 3.` és a `Fő utca 3., 9021 Győr, Magyarország` is Győrt adja). Az elválasztó a telefonok „–” és „—” jelét is elfogadja.
- Utazásnál a címek a Munkahelyek sorrendjét adják. Nem Utazásnál több cím esetén az első a Munkahely, az esemény pedig a „Hiányos” listára kerül.
- A pontos címek külön CSV-oszlopba (`Cím`, ` - `-vel elválasztva) kerülnek; a Munkahely mező marad település (az OTS miatt). A Google Maps útvonalba a pontos cím megy; ha a cím nem található, a település. (A Mac-app ehhez az Apple geokódolóját használja ellenőrzésre; a webapp a saját módszerét választja.)

## 4. Mennyiség: fő és alkalom

Az `alkalom` és `fő` típusoknál (Istentisztelet, Látogatás, Evangelizáció, Bibliaóra) a mennyiséget a címben add meg:

- `×3`, `x3`, `3 fő` vagy `3 alkalom` bárhol a típus után (a kettőspont előtt vagy a leírásban).
- Ha nincs megadva: **1**.
- Ennél a négy típusnál az esemény időtartama csak tájékoztató (az OTS-ben a mennyiség számít; az összesítésben 1 fő vagy 1 alkalom 1 óra).

## 5. Utazás

Az Utazásnál az **útvonal** és a **cél** is kell:

```
Utazás: Győr → Tata, Mór → Győr | Kiszállás a környékre
Utazás: Győr ⇄ Tata, Mór | Kiszállás a környékre
```

- Az útvonal az első `→` előtti rész (**Indulás**), a `→` jelek között lévő, vesszővel elválasztott rész (**Munkahely(ek)**, sorrendben), és az utolsó `→` utáni rész (**Érkezés**).
- A **`⇄`** (vagy az `oda-vissza` szó) **oda-vissza utat** jelent: az Érkezés az Indulás. Ilyenkor elég az `Indulás ⇄ Munkahely(ek)` forma.
- A `→` helyett `->` is elfogadott, a `⇄` helyett `<->`.
- A **cél** (Tevékenység) a `|` jel után áll, vagy az esemény **Leírás** mezőjének első sora. **Utazásnál kötelező.**
- Ha az útvonalban nincs megadva Indulás vagy Érkezés, a székhely az alapérték.

## 6. Egész napos események

Egész napos eseményként (a naptárban „egész nap” jelölővel) a cím `Szabadság`, `Szabadnap` vagy `Munkaszüneti nap`. Többnapos egész napos esemény **naponta egy bejegyzést** ad (a lezajlott napokra). Más típus egész naposként nem értelmezett.

## 7. Példák

| Naptáresemény | Értelmezés |
|---|---|
| `Értekezlet: Heti munkatársi megbeszélés`, 9:00–10:30, helyszín: Győr | Értekezlet, 1:30 óra, Győr, tevékenység: Heti munkatársi megbeszélés |
| `Felkészülés @Mór: Prédikáció`, 11:00–13:00 | Felkészülés, 2 óra, Mór |
| `Látogatás ×3: Idősek otthona`, 14:00–15:00, helyszín: Mór | Látogatás (gyülekezet), 3 fő, Mór |
| `Istentisztelet`, 10:00–12:00, helyszín: Tata | Istentisztelet, 1 alkalom, Tata |
| `Utazás: Győr ⇄ Tata, Mór \| Kiszállás`, 7:30–8:15 | Utazás, 0:45, Indulás és Érkezés: Győr, Munkahelyek: Tata, Mór, Tevékenység: Kiszállás |
| `Szabadság` (egész napos, 3 napos) | 3 nap Szabadság |
| `Bibl: Fiatalok`, 18:00–19:30, `@Bicske` | Bibliaóra, 1 alkalom, Bicske |

## 8. Nem felismert események

- Azt az eseményt, amelynek a címe nem ismert típussal kezdődik, az alkalmazás **nem veszi át**, de egy **„Nem felismert események”** listában megmutatja, hogy miért. Innen egy érintéssel típust rendelhetsz hozzá (és szabály helyett egyszeri döntésként beveszi).
- Az átvett események **egyszer** kerülnek be: az alkalmazás megjegyzi az esemény azonosítóját, ezért ugyanaz az esemény nem duplázódik.

## 9. Tippek a kényelmes használathoz

- **Telefonon:** az eseményt egyszer hozd létre mintaként (például `Értekezlet: `), és másold. A Google Naptár és az Outlook is tud eseményt duplikálni.
- **Gyorsítás:** a ritkán használt típusokhoz használd a rövid neveket (`Ért`, `Felk`, `Ügy`).
- **Ellenőrzés:** a naptár beolvasása után az alkalmazás megmutatja, mit vett át, és mit hagyott ki. Nézd át a „Hiányos” és a „Nem felismert” listát.

## Megvalósítóknak: pontos értelmezési szabályok

1. **Normalizálás:** a cím elején lévő felesleges szóközök törlődnek; összehasonlításkor kisbetű és ékezet nélküli forma.
2. **Típus felismerése:** a címből levesszük az első `:` vagy ` - ` előtti részt (a `@…` és `×…` jelölések és a mennyiség előtt/után). A fennmaradó szöveg elejét a típusnevek (a táblázat összes alakja) közül a **leghosszabb egyező előtaggal** párosítjuk. Ha nincs egyezés → „Nem felismert”.
3. **Szétválasztás:** `Típus [@Település] [×n | n fő | n alkalom] [: vagy - Tevékenység]`, ahol a `@…` és a mennyiség sorrendje tetszőleges, és a kettőspont előtt vagy a Tevékenységben is állhat. Utazásnál a kettőspont után az útvonal, majd `|` és a cél.
4. **Utazás:** az útvonal elválasztói `→`, `->`; oda-vissza jelölés `⇄`, `<->`, `oda-vissza`. Az Indulás az első elem; ha `→` van, az Érkezés az utolsó, a közbülsők a Munkahely(ek). Ha `⇄`: az Indulás az első elem, a többi Munkahely, az Érkezés = Indulás. A Tevékenység a `|` utáni szöveg, különben a Leírás mező első sora; Utazásnál üresen a bejegyzés „Hiányos”. Ha az útvonalban csak egy nyíl van (`A → B`), az Érkezés B, a Munkahely hiányzik, ezért a bejegyzés „Hiányos” (nem tippelünk). Útvonal nélkül (`Utazás: cél`) az Indulás és az Érkezés a székhely; ha nincs székhely megadva, „Hiányos”. A `|` előtt útvonal nélkül álló szöveg a Munkahely(ek) listája.
5. **Munkahely:** `@Település`, különben a Helyszín mező (a „Pontos cím megadása” és a 11. pont szerint), különben „Hiányos” (kivéve egész napos típust).
6. **Idő:** időzített eseménynél a helyi idő szerinti kezdés/vég; az **éjfélen átnyúló esemény két bejegyzésre bomlik**: az első a kezdés napján 24:00-ig, a második a következő napon 0:00-tól tart; mindkét nap saját óraszámot kap (a napi 8 órás jelzésben is így számít). **Kivétel:** az alkalom és fő típusoknál (Istentisztelet, Látogatás, Evangelizáció, Bibliaóra) nem bomlik: az időtartam ott csak tájékoztató, és a mennyiség nem duplázódhat; a bejegyzés a kezdés napjára kerül. Az időtartam = vég − kezdés; alkalom/fő típusnál a mennyiség számít (a CSV-ben az idők is megmaradnak).
7. **Egész napos:** csak Szabadság, Szabadnap, Munkaszüneti nap; többnaposnál naponta egy bejegyzés, kizárólag a mai napnál korábbi napokra.
8. **Kihagyás:** jövőbeli (vagy ma még nem lejárt) esemény, visszautasított, törölt; az ismétlődő eseményt példányonként kezeljük.
9. **Azonosító:** az átvett bejegyzés `Forrás` mezője `calendar` (a Mac-app így tárolja; ez az érték a Mac-app saját Naptár nézetében húzással felvett bejegyzésnél is előfordul, ezért a naptárból átvett bejegyzést nem a `Forrás`, hanem a nem üres `Naptár azonosító` jelzi), és a `Naptár azonosító` CSV-oszlop tartalmazza az azonosítót: `<esemény azonosító>#YYYY-MM-DD`, vagyis minden nap külön azonosítót kap (egynapos eseménynél is). Ismétlődő vagy kivételes (leválasztott) példánynál az esemény azonosítója után `|` és a példány eredeti kezdete (UNIX másodperc) áll: `<azonosító>|<másodperc>#YYYY-MM-DD`. Az azonosító alapja a `#YYYY-MM-DD` utótag (pontosan 10 karakter, érvényes dátum) levágásával adódik. Ugyanazt az eseményt nem vesszük át újra.
10. **Változás utólag (eldöntve):** a naptár a mérvadó. A módosított esemény bejegyzése frissül (akkor is, ha az átvett bejegyzést kézzel szerkesztették; ezt az alkalmazás jelzi), a naptárban törölt eseményhez tartozó, naptárból átvett bejegyzés törlődik. Kézzel felvitt bejegyzést a szinkron nem érint. Törlés/felülírás előtt másolat készül az adatfájlról. **Védelem:** a szinkron nem töröl magától, ha a törlések száma nagyobb, mint 5 és az ablakbeli naptáras bejegyzések fele, vagy ha a naptár üresnek látszik: ilyenkor megerősítést kér. A naptár kijelölésének megszüntetése nem töröl (csak az, ha az esemény egyik naptárban sincs meg). Az ablaknál (alapból 60 nap) régebbi bejegyzéshez a szinkron nem nyúl; a lemondott és visszautasított esemény bejegyzése törlődik.
11. **Címek:** a Helyszín mezőben a több címet ` - ` (szóközzel körülvett kötőjel) választja el. A település az egyes címek utolsó vessző utáni, számjegyet nem tartalmazó része, az irányítószám és a záró „Magyarország”/„Hungary” nélkül (ha az utolsó rész házszámos, a megelőző szám nélküli rész: `Győr, Fő utca 3.` → Győr); vessző nélkül, számjegy nélkül az egész szöveg település, és a `Cím` üres. Pontos cím (a `Cím` oszlopba) csak az, amelyben van vessző. Az elválasztó a „ – ” és „ — ” jelet is elfogadja. Nem Utazásnál több cím esetén az első a Munkahely, és az esemény „Hiányos”; Utazásnál a címek települései adják a Munkahelyeket (ha sem az útvonal, sem a `@` nem ad meg munkahelyet), a `Cím` mindig az összes pontos címet tartalmazza ` - `-vel. A Munkahely település marad, a pontos címek a `Cím` CSV-oszlopba kerülnek ` - `-vel elválasztva (régi fájlok olvashatók maradnak).
