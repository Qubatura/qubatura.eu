// zrzut-mockupy.cjs — miniaturki mockupów Lab bez headless Chrome (ten na MSI nie działa od 07-14).
// Electron sam otwiera plik, czeka na fonty i robi zrzut obszaru galerii → PNG do scratchpada.
// Skalowanie/konwersję do .webp robi krok drugi (PIL), bo Electron nie zapisuje webp.
//
// Uruchomienie (electron bierzemy z Qplayera, nie instalujemy drugi raz):
//   "…/Qplayer/node_modules/electron/dist/electron.exe" tools/zrzut-mockupy.cjs
//
// Uwaga: okno MUSI być widoczne — capturePage na ukrytym oknie potrafi zwrócić czarną klatkę.

const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

const KATALOG_MOCKUPY = path.join(__dirname, '..', 'assets', 'lab', 'mockupy');
const KATALOG_WY = process.argv[2] || path.join(__dirname, '..', '.zrzuty');

// Skala renderu: 2× względem docelowych 744×474, żeby po zmniejszeniu tekst był ostry.
const SZER_OKNA = 1400;
const WYS_OKNA = 1200;

app.disableHardwareAcceleration();   // stabilniejszy capturePage na laptopowym GPU

async function zrzut(win, plik) {
  await win.loadFile(path.join(KATALOG_MOCKUPY, plik));

  // Nagłówek strony (branża + adres) do miniaturki nie wchodzi — karta pokazuje sam interfejs.
  await win.webContents.insertCSS('.head{display:none!important} body{padding-top:26px!important}');

  // Czekamy na fonty Google — bez tego zrzut łapie fallback systemowy i wygląda tanio.
  await win.webContents.executeJavaScript('document.fonts.ready.then(() => true)');
  await new Promise(r => setTimeout(r, 900));

  const prostokat = await win.webContents.executeJavaScript(`
    (() => {
      const g = document.querySelector('.gallery').getBoundingClientRect();
      return { x: Math.max(0, Math.round(g.x) - 12), y: Math.max(0, Math.round(g.y) - 12),
               width: Math.round(g.width) + 24, height: Math.round(g.height) + 24 };
    })()
  `);

  const obraz = await win.webContents.capturePage(prostokat);
  const wy = path.join(KATALOG_WY, plik.replace(/\.html$/, '.png'));
  fs.writeFileSync(wy, obraz.toPNG());
  console.log('OK', path.basename(wy), prostokat.width + 'x' + prostokat.height);
}

app.whenReady().then(async () => {
  fs.mkdirSync(KATALOG_WY, { recursive: true });
  const win = new BrowserWindow({
    width: SZER_OKNA, height: WYS_OKNA, x: 0, y: 0,
    show: true, frame: false, backgroundColor: '#000000',
    webPreferences: { offscreen: false }
  });

  const pliki = fs.readdirSync(KATALOG_MOCKUPY).filter(f => /^\d\d-.*\.html$/.test(f)).sort();
  for (const p of pliki) await zrzut(win, p);

  win.destroy();
  app.quit();
});
