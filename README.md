# PassMed-Mures
Allamvizsga

## Megvalósított funkciók

- A kérdések vizsgatárgyhoz és több témakörhöz rendelhetők; témakör alapján
  gyakorló teszt készíthető.
- A kérdésimport felismeri a már létező kérdéseket, nem hoz létre belőlük
  ismétlődő példányt, de azokat az új teszthez és témakörökhöz is hozzá tudja
  kapcsolni.
- A tanár a teszt létrehozásakor próba- vagy vizsgamódot, időkorlátot és
  szünetlehetőséget állíthat be. Vizsgamódban letiltható a lapváltás.
- A tanár csoportot hozhat létre, diákokat hívhat meg, és tesztet oszthat meg a
  csoporttal. A tanulók csoporthoz rendelt teszteredményei és válaszai a tanári
  felületen követhetők.
- A diák hibás tesztet, illetve kérdést jelenthet. A tanár a hozzá tartozó
  nyitott hibajelzéseket megtekintheti és lezárhatja.
- A tanuló saját, témakörök alapján összeállított gyakorló tesztje privát; a
  testtérkép csak ennél a tesztkészítésnél jelenik meg, és a kiválasztott
  témakörökhöz rendelt testrészeket emeli ki.
- Témakörhöz PPT, PPTX vagy PDF tananyag tölthető fel, amelyet a diák a
  témakörnél érhet el.

## Adatbázis

A futásidejű Drizzle-séma a `backend/src/db_drizzle/` mappában van; a
`backend/drizzle/` a sémaváltozásokat rögzítő, generált migrációkat tartalmazza.
Migráció létrehozása a projekt gyökérmappájából: `npm --prefix backend run db:generate`.
Alkalmazása külön lépés: `npm --prefix backend run db:migrate`. A migrációkat
az adatbázisra külön kell alkalmazni; a generálás önmagában nem módosítja azt.

A papíralapú válaszlapok adatmodellje már elő van készítve (`attempts.mode`,
`paper_answer_sheets`, `paper_answers`, `paper_answer_options`), de a lapgenerálás,
a képfeldolgozás és a tanári ellenőrző felület még nincs megvalósítva. A tesztlap
felismeréséhez szükséges előnézeti adatmodell (`test_scan_imports`,
`test_scan_questions`, `test_scan_options`) rendelkezésre áll, de az OCR és a
scan-importáló felület még nincs bekötve.

### Kezdőadatok

A seed (`backend/src/seed.mjs`) idempotensen létrehozza a fejlesztői tanár- és
diákfiókot, a Biológia és Kémia vizsgatárgy-kategóriát, a 23 megadott
biológiai témakört (mind a Biológia kategóriához rendelve), valamint a
testtérkép alap régióit. Nem hoz létre kérdéseket vagy teszteket; azokat a tanár
viszi fel. A fejlesztői fiókok: `tanar@passmed.hu` és `diak@passmed.hu`,
jelszavuk `jelszo123`; éles környezetben ezeket ne használd.

A kérdések, válaszlehetőségek, tesztek, csoportok, meghívók, tanulói próbálkozások,
hibajelzések és tananyagok tábláinak kezdetben nem kell rekordot tartalmazniuk.
Ezek a táblák a használat során töltődnek fel; ürességük önmagában nem adatbázishiba.
Új adatbázis esetén előbb migráld a sémát, utána futtasd a seedet:
`npm --prefix backend run db:migrate`, majd `npm --prefix backend run seed`.
