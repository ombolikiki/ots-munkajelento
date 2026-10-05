# Havi munkajelentő

Minden hónapban regisztrálni kell az elmúlt hónap munkajelentőjét. Napi bontásban kell felvinni az elvégzett feladatokat kategóriák szerint, az adott kategória mértékegységében (alkalom, fő, óra). Az adatok forrása az **OTS Munkajelentő Tracker** nevű menüsori alkalmazás adatfájlja (lásd references/tracker-adatforras.md). Más forrásból (pl. időmérő webszolgáltatásból) nem dolgozunk.

## Menet

1. Olvasd ki a Határidők oldalt (lásd a SKILL.md "Határidők oldal" részét), és ellenőrizd, van-e Havi munkajelentő (TASK = 7) sor.
   - Ha nincs, ugord át a többi lépést. A feladat lezárult, írd ki a lezáró üzenetet (lásd lent).
   - Ha van, folytasd a 2. lépéssel.
2. Nyisd meg a feladatot (duplakattintás a soron).
3. Olvasd be a tracker adatfájljából az adott hónap bejegyzéseit (a sor időszaka szerinti hónap, lásd "Adatforrás"), és soronként vidd fel a napokat a leképezés és az alábbi szabályok szerint. Ha az adott hónapra nincs adat, ne találj ki semmit: szólj a felhasználónak.
4. Ha kész vagy, **állj meg**, és várd meg a felhasználó folytatás-megerősítését. Ilyenkor a felhasználó kitöltheti az üres mezőket, kiegészítheti, javíthatja a táblázatot. Ne nyúlj hozzá, amíg nem jelez.
5. A jelzés után, **a lezárás előtt ellenőrizd** a táblázatot (`$$('yo_Grid').serialize()`, mező: WORKPLACE):
   - minden sor **Munkahely** mezőjében van-e szöveg (egyetlen sor sem lehet üres), és
   - sehol nincs `!!!` előtag, és
   - a hónapban a `SZABADNAP` sorok száma és a `MUNKASZÜNETI NAP` sorok száma (külön-külön) legfeljebb annyi, ahány hétből áll a hónap (lásd lent: Heti korlát).
   Ha bármelyik feltétel nem teljesül, **jelezd a felhasználónak** (sorszám/nap szerint felsorolva, mi a hiba), és **ne menj tovább**: ne zárd le a lapot. Várd meg, hogy a felhasználó javítsa, majd jelezze, hogy folytathatod, és futtasd le az ellenőrzést újra.
6. Ha az ellenőrzés rendben van, zárd le a lapot a **"Hónap lezárása"** (vagy hasonló nevű) gombbal.
7. A felugró ablakon hagyd jóvá a lezárást.
8. Írd ki a lezáró üzenetet.

## Befejezés

Amikor a feladat lefutott (a hónap lezárva, vagy nem volt Havi munkajelentő határidő), írd ki jól láthatóan:

> ## ✅ A feladat befejeződött: Havi munkajelentő

Röviden foglald össze, mit végeztél el (melyik hónap). Ezután kérdezd meg a felhasználót, hogy mivel folytassuk.

## Napi kiegészítő szabályok (a sor kitöltése után, soronként)

1. **8-ra kiegészítés:** ha egy sorba beírt számok összege **kisebb, mint 8**, add hozzá az **Ügyintézés (óra)** mezőben lévő számhoz annyit, hogy a sor összege 8 legyen. Ha az összeg már **8 vagy több**, ne nyúlj hozzá.
2. **Jelölés:** ha így az Ügyintézés mezőben lévő szám **nagyobb, mint 4**, tegyél a **Munkahely** mező szövegének elejére egy `!!!` előtagot (a felhasználó ezt később maga szerkeszti).

3. **Kerekítés:** ha a napi összeg (óra) nem kerek egész óra, mindig **felfelé kerekítve** írd be a táblázatba (pl. 2,5 óra = 3, 1,25 óra = 2).
4. **Szombat kivétel:** az 1. és 2. szabály (8-ra kiegészítés és `!!!` jelölés) **szombaton nem érvényes**. A szombati sor lehet 8 óránál kevesebb, és az Ügyintézésből eredő `!!!` előtagot sem kell rátenni. A szombat azonosítása: a sor napja "Szo" (az OTS Nap oszlopában), vagy a dátum szombati.
5. **Maximum 8:** minden számmezőben (óra, alkalom és fő is) a beírt érték legfeljebb **8** lehet. Ha a tracker adatai alapján (a napi összegzés és a felfelé kerekítés után) 8-nál nagyobb szám jönne ki, csak **8**-at írj be. A felső korlátozást a 8-ra kiegészítés és a `!!!` jelölés számításánál is a már korlátozott értékekkel vedd figyelembe.

Az alábbi értelmezéseket a felhasználó megerősítette:
- A sor összegébe az összes beírt szám beletartozik (óra, alkalom és fő mezők is, egységtől függetlenül).
- A szabályt csak olyan sorokra alkalmazom, amelyekhez a trackerben tényleg van bejegyzés. **Nem** alkalmazom az üres napokra, a SZABADNAP, SZABADSÁG és MUNKASZÜNETI NAP sorokra (ezeknek a többi mezője üres marad).
- Ha a Munkahely mező üres, az előtag egyedül `!!!` lesz.

## Az OTS lap (Határidők > Havi munkajelentő sor duplán kattintva, vagy Lelkész > Havi munkajelentő)

- Gyülekezet-legördülő és a hónap a felső sávban (pl. "2026. szeptember 5."). A lap a hónap minden napját egy-egy sorban mutatja.
- Gombok: **Exportálás Excelbe**, **Hónap lezárása**. A lap tetején szabadságkeret-összesítő látszik (összes, kivett, maradék). Alul "Összesen" sor van.
- Webix grid: `document.querySelector('iframe').contentWindow.$$('yo_Grid')`. A mezők azonosítói és az oszlopok:

| Mező (id) | Csoport | Oszlop | Egység |
|---|---|---|---|
| WORKPLACE | | Munkahely | szöveg |
| HOLIDAY | | Szabadság? | jelölőnégyzet |
| PREACHING | Gyülekezet | Istentisztelet | alkalom |
| VISITING | Gyülekezet | Látogatás | fő |
| OFFICE_WORK | Gyülekezet | Ügyintézés | óra |
| MEETING | Gyülekezet | Értekezlet | óra |
| EVANGELISATION | Misszió | Evangelizáció | alkalom |
| BIBLE_HOUR | Misszió | Bibliaóra | alkalom |
| MISSION_VISITING | Misszió | Látogatás | fő |
| TRAINING | Továbbképzés | Résztvevő | óra |
| HELD_TRAINING | Továbbképzés | Tartott | óra |
| ADMINISTRATION | Hivatal | Adminisztráció | óra |
| PREPARING | Hivatal | Felkészülés | óra |
| TRAVEL | | Utazás | óra |

A "Látogatás" kétszer szerepel: a Gyülekezet csoportban (VISITING) és a Misszió csoportban (MISSION_VISITING). Ha nem derül ki, melyik kell, kérdezz rá.

## Adatforrás: OTS Munkajelentő Tracker

Az adatok a felhasználó **OTS Munkajelentő Tracker** alkalmazásának adatfájljából jönnek. Az adatfájl megkeresését és az oszlopok jelentését lásd: **references/tracker-adatforras.md** (olvasd el, mielőtt adatot olvasol). Ez a Havi munkajelentő **egyetlen adatforrása**.

**Leképezés az OTS táblázatra** (a napi szabályok, kerekítés, 8-ra kiegészítés, `!!!`, szombat stb. változatlanul érvényesek, lásd lent):
- `Egység = ora`: a nap azonos `Típus kód` értékű bejegyzéseinek időtartam-összege (lásd fent) / 3600, majd felfelé kerekítve (a kerekítés a napi összegre vonatkozik).
- **Pomodoro-bejegyzések** (`Forrás = pomodoro`): egy nap azonos `Típus kód` alá eső pomóinak (és az ugyanide tartozó időzítős/kézi bejegyzéseknek) az időtartamát **először add össze másodpercben**, és **csak az így kapott napi összeget kerekítsd felfelé egész órára**, közvetlenül az OTS-be írás előtt. A pomókat külön-külön **soha ne kerekítsd** (25 perc/pomo ≠ 1 óra/pomo). Példa: 4 pomo × 25 perc = 100 perc = 1,67 óra, amit 2 órára kerekítesz, nem 4-re.
- Az alkalom és a fő is 1 órának számít a sor összegében (a 8-ra kiegészítésnél és a 8 órás korlátnál), a tracker napi összesítője is így számol.
- `Egység = alkalom` vagy `fo`: a nap azonos `Típus kód` értékű bejegyzéseinek `Mennyiség` összege (nincs kerekítés, nincs időből számolás).
- `DAY_OFF` (`Típus kód`): Munkahely = `SZABADNAP`, a sor többi része üres. `PUBLIC_HOLIDAY`: Munkahely = `MUNKASZÜNETI NAP`, a többi üres. `HOLIDAY`: a **Szabadság?** jelölőnégyzetet pipáld ki, semmi mást ne írj a sorba.
- **Munkahely mező:** a nap bejegyzéseinek (az egész napos és az `EGYEDI_` kódú bejegyzések nélkül) különböző `Munkahely` értékei (utazásnál a Munkahely(ek) elemei; az `Indulás` és az `Érkezés` nem kerül ide), időrendben, vesszővel elválasztva (pl. `Település1, Település2`). A `!!!` szabályok (üres nap stb.) változatlanok. A tracker kötelezővé teszi a Munkahely mezőt, ezért itt nem kell településnevet keresni a leírásban.
- Ha egy napnak nincs bejegyzése, a korábbi üres-nap szabályok érvényesek (hétköznap és szombat: `!!!`, vasárnap: `SZABADNAP`).

## Nem munkaidős bejegyzések

A tracker `Típus kód` alapján (lásd a leképezésnél fent):
- **PUBLIC_HOLIDAY**: a Munkahely mezőbe írd be: `MUNKASZÜNETI NAP`. A sor többi mezője üres marad.
- **DAY_OFF**: a Munkahely mezőbe írd be: `SZABADNAP`. A sor többi mezője üres marad. A Szabadság? jelölőnégyzetet ilyenkor NEM pipáld be.
- **HOLIDAY**: pipáld ki a **Szabadság?** jelölőnégyzetet. A táblázat többi részébe (Munkahelyet is beleértve) semmit nem kell írni.

## Munkahely mező

Az adott nap bejegyzéseinek (az egész napos és az `EGYEDI_` kódú bejegyzések nélkül) `Munkahely` értékei (különböző értékek, időrendben, vesszővel elválasztva). A tracker kötelezővé teszi a megadásukat, ezért nem kell településnevet keresni a leírásban.

## Üres napok

Ha egy napra nincs bejegyzés a trackerben, a sor többi mezőjét hagyd üresen, a **Munkahely** mezőbe pedig írj egy `!!!` előtagot (egyedül `!!!`). A felhasználó tölti ki a sort. A 8-ra kiegészítés az ilyen napokra nem vonatkozik. (Mivel a lezárás előtti ellenőrzés a `!!!`-t hibának tekinti, a lezárás addig nem lehetséges, amíg a felhasználó ezeket ki nem javítja.)

## Bevitel az OTS táblázatba (tapasztalat)

- Cella szerkesztése: duplakattintás a cellán, gépelés, Return. Külön Mentés gomb nincs, a sor azonnal mentődik (az adatsor `id`-ja a mentés után szerverazonosítóra változik, pl. "95058"). Után ellenőrizd a `$$('yo_Grid').serialize()` értékeit.
- A Munkahely oszlop keskeny a képernyőn, és a Szabadság? jelölőnégyzet mellette van. A Return után a fókusz átugorhat a szomszéd cellára (zöld keret), ez nem jelenti, hogy a jelölőnégyzet kipipálódott. Ellenőrizd a HOLIDAY értékét.
- **Figyelem, az oszlopok helye eltolódhat** (pl. az oldalsáv összecsukódik), ezért a koordináta alapú duplakattintás rossz cellába írhat. Ez egyszer megtörtént: a `!!!` az Istentisztelet mezőbe került. A bevitel megbízhatóbb módja a grid API-n át: `g.editCell(id,'WORKPLACE'); const n=g.getEditor().getInputNode(); n.value='...'; g.editStop();` (`id` = `g.serialize()[sorindex].id`). Minden bevitel után ellenőrizd az egész sort (`serialize()`), hogy más mezőbe nem került-e érték.
- A `<` és `>` jelet tartalmazó szöveg a lapon HTML-ként értelmeződik és láthatatlan lehet. Ezért használunk `!!!` előtagot.

## Megerősített kiegészítések (kerekítés, üres szombat, vasárnap)

- A kerekítést mezőnként, a **napi összegre** alkalmazd (pl. ugyanazon a napon két Felkészülés bejegyzést előbb add össze, majd az összeget kerekítsd felfelé), nem bejegyzésenként. (Felhasználó megerősítette.)
- **Üres szombat** (nincs bejegyzés): a Munkahely mezőbe `!!!` kerül, mint bármely más üres napon. (Felhasználó megerősítette.)
- **Vasárnap:** ha nincs semmi bejegyzés, a Munkahely mezőbe `SZABADNAP` kerül, a sor többi mezője üres marad (nem `!!!`). Ha van bejegyzés, a hétköznapi szabályok érvényesek. (Felhasználó megerősítette.)

## Heti korlát (lezárás előtti ellenőrzés)

Minden hónapban összesen legfeljebb annyi **SZABADNAP** és annyi **MUNKASZÜNETI NAP** lehet, ahány hétből áll a hónap. Ha ez nem így van, a lezárás előtti ellenőrzéskor jelezd a felhasználónak (és ne zárd le a lapot, mint a többi ellenőrzési hibánál).

Az alábbi értelmezéseket a felhasználó megerősítette:
- A két korlát külön-külön érvényes: legfeljebb N darab SZABADNAP **és** legfeljebb N darab MUNKASZÜNETI NAP (nem együtt N).
- A hét számát a hónap napjainak 7-tel való osztásából számolom, felfelé kerekítve (pl. 30 nap = 4,29 hét = **5**; 28 nap = 4; 31 nap = 5).
- A sorokat a Munkahely mező pontos szövege alapján számolom (`SZABADNAP`, `MUNKASZÜNETI NAP`).
