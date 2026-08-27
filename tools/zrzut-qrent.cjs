// zrzut-qrent.cjs — zrzuty prototypu QRenta na kartę produktu w Lab.
//
// ⚠️ Headless Chrome na MSI nie działa od 07-14 — Electron robi zrzut sam sobie.
//    Electron bierzemy z Qplayera, nie instalujemy drugi raz.
// ⚠️ Okno MUSI być widoczne, inaczej capturePage potrafi zwrócić czarną klatkę.
//
// Zrzuty są 2× większe niż docelowy rozmiar na stronie — po zmniejszeniu tekst
// zostaje ostry. Konwersję do .webp robi krok drugi (PIL), bo Electron nie zapisuje webp.
//
// Uruchomienie:
//   "…/Qplayer/node_modules/electron/dist/electron.exe" tools/zrzut-qrent.cjs

const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

const PROTOTYP = path.resolve(__dirname, '..', '..', 'QRent', 'prototyp', 'index.html');
const WY = path.join(__dirname, '..', '.zrzuty');

app.disableHardwareAcceleration();
const czekaj = ms => new Promise(r => setTimeout(r, ms));

// (nazwa, szerokość, wysokość) — dwa widoki desktop + jeden telefon (poglądowy).
const UJECIA = [
  ['qrent-oferta',  1440, 900],
  ['qrent-magazyn', 1440, 900],
  ['qrent-telefon',  390, 844],
];

app.whenReady().then(async () => {
  fs.mkdirSync(WY, { recursive: true });

  // ⚠️ JEDNO okno na wszystkie ujęcia, tylko zmieniamy rozmiar. Tworzenie i niszczenie
  //    okna w pętli kończyło się `ERR_FAILED (-2)` przy drugim `loadFile` — nowe okno
  //    startowało, zanim poprzednie zwolniło plik.
  const win = new BrowserWindow({ width: UJECIA[0][1], height: UJECIA[0][2], show: true });

  for (const [nazwa, w, h] of UJECIA) {
    win.setContentSize(w, h);
    await czekaj(250);
    await win.loadFile(PROTOTYP);
    await win.webContents.executeJavaScript('document.fonts.ready.then(() => true)');
    await czekaj(1200);

    // ⚠️ Prototyp to SPA z nawigacją w bocznym pasku — przewijanie NIC nie daje
    //    (pierwsze podejście dało dwa identyczne zrzuty). Trzeba kliknąć w ten sam
    //    element, w który klika człowiek.
    const SEKCJA = { 'qrent-magazyn': 'Magazyn', 'qrent-telefon': 'Oferty' };
    if (SEKCJA[nazwa]) {
      const trafione = await win.webContents.executeJavaScript(`
        (() => {
          const cel = ${JSON.stringify('X')}.replace('X', ${JSON.stringify(SEKCJA[nazwa])});
          const el = [...document.querySelectorAll('a,button,li,[role=button],nav *')]
            .find(e => (e.textContent || '').trim().startsWith(cel) && e.children.length < 3);
          if (el) { el.click(); return true; }
          return false;
        })()
      `);
      if (!trafione) console.log('  ⚠️ nie znaleziono sekcji', SEKCJA[nazwa], '— zrzut z ekranu startowego');
      await czekaj(900);
    }

    const obraz = await win.webContents.capturePage();
    const plik = path.join(WY, nazwa + '.png');
    fs.writeFileSync(plik, obraz.toPNG());
    console.log('zrzut:', plik, `${w}x${h}`);
  }
  win.destroy();

  app.quit();
}).catch(e => { console.error('BLAD:', e); app.quit(); });
