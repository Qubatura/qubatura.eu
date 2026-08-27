// zmierz-lab.cjs — POMIAR sekcji Lab na ŻYWEJ stronie, nie na makiecie.
//
// Po co: makieta z `poligon/` ma inny mechanizm układu (grid) niż strona (blok
// absolutny w `#page`). Liczby z poligonu NIE przenoszą się. Ten skrypt mierzy tam,
// gdzie warunek naprawdę zachodzi — na `src/index.html`, z routerem, GSAP-em i sceną.
//
// ⚠️ Headless Chrome na MSI nie działa od 07-14 — dlatego Electron (ten sam patent
//    co `zrzut-mockupy.cjs`). Electron bierzemy z Qplayera, nie instalujemy drugi raz.
// ⚠️ Serwer MUSI stać na katalogu repo, bo strona woła `../assets/…`:
//       python -m http.server 8778
//    a adres to wtedy http://127.0.0.1:8778/src/index.html
//
// Uruchomienie:
//   LAB_SZER=390 LAB_WYS=844 LAB_WY=.zrzuty/telefon \n//   "…/Qplayer/node_modules/electron/dist/electron.exe" tools/zmierz-lab.cjs
//
// ⚠️ Szerokość okna zmienia WSZYSTKO (patrz pamięć „osiem sposobów, na jakie zrzut kłamie").
//    Desktop i telefon mierzymy osobno — 390 px to iPhone, tam wchodzi breakpoint mobilny.

const { app, BrowserWindow, session } = require('electron');
const path = require('path');
const fs = require('fs');

// ⚠️ Konfiguracja przez ZMIENNE ŚRODOWISKOWE, nie argumenty. Electron zjada argumenty
//    pozycyjne (bierze je za własne przełączniki Chromium) — przy `... skrypt.js <url> 390 844`
//    proces kończył się cicho kodem 127, bez jednej linijki błędu.
const ADRES = process.env.LAB_ADRES || 'http://127.0.0.1:8778/src/index.html';
const WY = process.env.LAB_WY || path.join(__dirname, '..', '.zrzuty');

const SZER = +(process.env.LAB_SZER || 1600), WYS = +(process.env.LAB_WYS || 1000);

app.disableHardwareAcceleration();

const czekaj = ms => new Promise(r => setTimeout(r, ms));

app.whenReady().then(async () => {
  fs.mkdirSync(WY, { recursive: true });
  const win = new BrowserWindow({
    width: SZER, height: WYS, show: true,
    webPreferences: { offscreen: false }
  });

  // ⚠️ CACHE ELECTRONA KŁAMIE. `index.html` potrafi przyjść świeży, a `lab.js` ze starej
  //    kopii, bo ma stały `?v=` — i wtedy mierzy się ZESZŁĄ wersję kodu, nie tę na dysku.
  //    (Raz już mnie to zmyliło: guzik QRenta otwierał kartę Qplayera.)
  await session.defaultSession.clearCache();
  await session.defaultSession.clearStorageData({ storages: ['cachestorage'] });

  await win.loadURL(ADRES);
  await win.webContents.executeJavaScript('document.fonts.ready.then(() => true)');

  // Loader + intro. Nie skracać: przy krótszym czekaniu mierzy się stan PRZED
  // ustawieniem sceny i wychodzą liczby, których użytkownik nigdy nie zobaczy.
  await czekaj(6000);

  // Wejście na Lab przez ten sam element, w który klika człowiek — nie przez
  // ustawianie atrybutów z boku. Inaczej pomijamy router i GSAP-owy transform.
  await win.webContents.executeJavaScript(`
    (() => { const n = document.querySelector('#nav-lab'); if (n) n.click(); return !!n; })()
  `);
  await czekaj(3500);

  const wynik = await win.webContents.executeJavaScript(`
    (() => {
      const q = s => document.querySelector(s);
      const r = el => el ? el.getBoundingClientRect() : null;
      const h1   = r(q('#page-lab .page-title'));
      const cta  = r(q('#page-lab .page-cta'));
      const head = r(q('.lab-software .pl-head'));
      const asc  = r(q('.lab-software .asc-btn'));
      const sekcja = r(q('.lab-software'));
      const karty = [...document.querySelectorAll('.lab-card')].map(k => {
        const b = k.getBoundingClientRect();
        return { w: Math.round(b.width), h: Math.round(b.height) };
      });
      const ikony = [...document.querySelectorAll('.lab-card .pl-ikona')]
        .map(i => ({ src: i.getAttribute('src'), ok: i.complete && i.naturalWidth > 0 }));
      return {
        dywizja: q('#page') ? q('#page').dataset.division : null,
        widoczna: head ? getComputedStyle(q('.lab-software')).display : 'brak',
        hero_top: h1 && Math.round(h1.top),
        head_top: head && Math.round(head.top),
        roznica_naglowek: (h1 && head) ? Math.round(head.top - h1.top) : null,
        cta_bottom: cta && Math.round(cta.bottom),
        asc_bottom: asc && Math.round(asc.bottom),
        roznica_asc: (cta && asc) ? Math.round(asc.bottom - cta.bottom) : null,
        sekcja: sekcja && { top: Math.round(sekcja.top), bottom: Math.round(sekcja.bottom),
                            h: Math.round(sekcja.height) },
        okno: { w: innerWidth, h: innerHeight },
        wychodzi_poza_okno: sekcja ? (sekcja.top < 0 || sekcja.bottom > innerHeight) : null,
        karty, ikony,
        bledy_konsoli: window.__bledy || []
      };
    })()
  `);

  console.log(JSON.stringify(wynik, null, 2));

  // Kolor produktu na kaflach — sprawdzany ODCZYTEM ze stylu wyliczonego, nie okiem.
  const kolory = await win.webContents.executeJavaScript(`
    [...document.querySelectorAll('.lab-card')].map(k => ({
      produkt: k.dataset.produkt,
      Q: getComputedStyle(k.querySelector('.q-mark')).color,
      guzik: getComputedStyle(k.querySelector('.pl-cta')).color
    }))
  `);
  console.log('KOLORY KAFLI:', JSON.stringify(kolory));

  const kafle = await win.webContents.capturePage();
  fs.writeFileSync(path.join(WY, 'lab-kafelki.png'), kafle.toPNG());
  console.log('zrzut:', path.join(WY, 'lab-kafelki.png'));

  // Karta QRenta — klikamy guzik na kaflu i sprawdzamy, czy naprawdę się otworzyła.
  // ⚠️ „Nie ma błędu w konsoli" NIE znaczy „działa" — sprawdzamy stan, adres i zawartość.
  const karta = await win.webContents.executeJavaScript(`
    (() => {
      const g = document.querySelector('.lab-card[data-produkt="qrent"] .pl-cta');
      if (!g) return { blad: 'brak guzika QRent na kaflu',
                       kafle: [...document.querySelectorAll('.lab-card')].map(k => k.outerHTML.slice(0, 120)) };
      const przed = location.pathname;
      let wyjatek = null;
      try { g.click(); } catch (err) { wyjatek = String(err); }
      const diag = { guzik: g.outerHTML.slice(0, 160), przed, wyjatek,
                     istnieje_overlay: !!document.getElementById('qrent-overlay') };
      const el = document.getElementById('qrent-overlay');
      return {
        diag,
        otwarta: !!el && el.classList.contains('is-open'),
        adres: location.pathname,
        aria: el && el.getAttribute('aria-hidden'),
        zrzuty_zaladowane: [...(el ? el.querySelectorAll('.qr-fig img') : [])]
          .map(i => ({ src: i.getAttribute('src'), ok: i.complete && i.naturalWidth > 0 })),
        ikona_ok: (() => { const i = el && el.querySelector('.qr-ikona'); return !!i && i.complete && i.naturalWidth > 0; })(),
        makieta_telefonu: !!(el && el.querySelector('.qr-tel-ekran')),
        cta_kontakt: !!(el && el.querySelector('[data-contact]'))
      };
    })()
  `);
  await czekaj(1200);
  console.log('KARTA QRENT:', JSON.stringify(karta, null, 2));

  const obraz = await win.webContents.capturePage();
  const plik = path.join(WY, 'qrent-karta-gora.png');
  fs.writeFileSync(plik, obraz.toPNG());
  console.log('zrzut:', plik);

  // Dół karty — makieta telefonu i stopka z ceną. Bez tego „sprawdziłem" dotyczy
  // tylko tego, co akurat weszło w pierwszy ekran.
  await win.webContents.executeJavaScript(`
    (() => { const s = document.querySelector('#qrent-overlay .qr-mobil');
             if (s) s.scrollIntoView({ block: 'start' }); return true; })()
  `);
  await czekaj(900);
  const dol = await win.webContents.capturePage();
  const plikDol = path.join(WY, 'qrent-karta-dol.png');
  fs.writeFileSync(plikDol, dol.toPNG());
  console.log('zrzut:', plikDol);

  app.quit();
}).catch(e => { console.error('BLAD:', e); app.quit(); });
