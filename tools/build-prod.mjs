// tools/build-prod.mjs — buduje dist/ serwowalny z ROOTA domeny (qubatura.eu/, nie /src/).
// Płaska kopia src/* -> dist/ + assets/ -> dist/assets/, i przepisanie ścieżek do assetów tak,
// żeby index.html leżał w rootcie (a nie w /src/):
//   root (HTML) + JS:  "../assets/"   -> "assets/"      (dokument/DOC_ROOT = root)
//   CSS (dist/css/):   "../../assets/" -> "../assets/"  (css jest o jeden poziom niżej)
// Dev (src/, GitHub Pages pod /src/) NIE jest ruszany — build idzie tylko na serwer produkcyjny.
//
// LEKKOŚĆ (2026-07): assets/ trzyma też CIĘŻKIE MASTERY (.MOV/.HEIC/.jpeg/PNG źródłowe, ~144 MB)
// których strona NIE serwuje. Deploy wgrywał je publicznie na produkcję. Filtr niżej kopiuje do dist/
// TYLKO media faktycznie referencowane w kodzie; struktura/fonty/svg/html zawsze zostają. Mastery
// zostają w git (backup), ale nie lecą na serwer.
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT   = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC    = path.join(ROOT, 'src');
const ASSETS = path.join(ROOT, 'assets');
const DIST   = path.join(ROOT, 'dist');

// Rozszerzenia MEDIALNE — tylko te mogą zostać WYCIĘTE (gdy nie-referencowane).
// Wszystko inne (woff2/svg/html/css/js/php/json/txt/xml…) zawsze kopiowane — zero ryzyka.
const MEDIA_EXT = new Set([
  '.webp', '.png', '.jpg', '.jpeg', '.gif', '.avif', '.heic',
  '.mp4', '.mov', '.webm', '.mp3', '.wav',
]);

async function walk(dir, cb) {
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) await walk(p, cb);
    else await cb(p);
  }
}

// Zbierz basename'y assetów REFERENCOWANE w kodzie: src/*.{html,css,js,php} + mockupy w assets/*.{html,css}.
async function collectReferenced() {
  const ref = new Set();
  const rx = /[A-Za-z0-9_][A-Za-z0-9_.\- ]*\.(?:webp|png|jpe?g|gif|avif|heic|mp4|mov|webm|mp3|wav|svg|woff2?|json)/gi;
  const scanExt = new Set(['.html', '.css', '.js', '.php', '.mjs', '.json', '.xml', '.txt']);
  const add = async (root) => {
    await walk(root, async (p) => {
      if (!scanExt.has(path.extname(p).toLowerCase())) return;
      const txt = await fs.readFile(p, 'utf8').catch(() => '');
      for (const m of txt.matchAll(rx)) ref.add(path.basename(m[0]).toLowerCase());
    });
  };
  await add(SRC);
  await add(ASSETS);   // mockupy HTML/CSS linkujące własne obrazki (asset→asset)
  return ref;
}

// Filtrowana kopia assets/ -> dist/assets/. Zwraca liczbę skopiowanych/pominiętych + wagi.
async function copyAssetsFiltered(referenced) {
  let kept = 0, kb = 0, skipped = 0, skb = 0;
  await walk(ASSETS, async (p) => {
    const ext  = path.extname(p).toLowerCase();
    const base = path.basename(p).toLowerCase();
    const size = (await fs.stat(p)).size;
    const isMedia = MEDIA_EXT.has(ext);
    const keep = !isMedia || referenced.has(base);   // media wycinamy tylko gdy nie-referencowane
    if (!keep) { skipped++; skb += size; return; }
    const rel = path.relative(ASSETS, p);
    const dest = path.join(DIST, 'assets', rel);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.copyFile(p, dest);
    kept++; kb += size;
  });
  return { kept, kb, skipped, skb };
}

async function main() {
  await fs.rm(DIST, { recursive: true, force: true });
  await fs.mkdir(DIST, { recursive: true });
  await fs.cp(SRC, DIST, { recursive: true });                       // index.html, css/, js/, send.php, polityka, robots, sitemap

  const referenced = await collectReferenced();
  const stat = await copyAssetsFiltered(referenced);

  let touched = 0;
  await walk(DIST, async (p) => {
    if (!['.html', '.css', '.js'].includes(path.extname(p))) return;
    const top = path.relative(DIST, path.dirname(p)).split(path.sep)[0] || '';
    if (top === 'assets') return;                                    // mockupy itd. mają własne ścieżki — nie ruszać
    const before = await fs.readFile(p, 'utf8');
    const after = (top === 'css')
      ? before.split('../../assets/').join('../assets/')
      : before.split('../assets/').join('assets/');
    if (after !== before) { await fs.writeFile(p, after); touched++; }
  });

  // SAMO-WERYFIKACJA: każdy MEDIA-asset referencowany w kodzie MUSI trafić do dist/ (inaczej abort).
  const missing = [];
  for (const base of referenced) {
    if (!MEDIA_EXT.has(path.extname(base))) continue;                // sprawdzamy tylko media (svg/woff2 i tak zawsze kopiowane)
    // szukamy pliku o tym basename w źródłowym assets/ (żeby nie wymagać nieistniejących)
    let existsInAssets = false, existsInDist = false;
    await walk(ASSETS, async (p) => { if (path.basename(p).toLowerCase() === base) existsInAssets = true; });
    if (!existsInAssets) continue;                                   // referencja do pliku którego nie ma w assets — nie nasz problem
    await walk(path.join(DIST, 'assets'), async (p) => { if (path.basename(p).toLowerCase() === base) existsInDist = true; });
    if (!existsInDist) missing.push(base);
  }
  if (missing.length) {
    console.error('build-prod: BŁĄD — referencowane media NIE trafiły do dist/:', missing.join(', '));
    process.exit(1);
  }

  console.log(`build-prod: dist/ gotowe (root-servable), przepisano plików=${touched}`);
  console.log(`build-prod: assets skopiowane=${stat.kept} (${(stat.kb/1048576).toFixed(1)} MB), `
    + `POMINIĘTE mastery=${stat.skipped} (${(stat.skb/1048576).toFixed(1)} MB) — nie lecą na produkcję`);
}
main().catch(e => { console.error(e); process.exit(1); });
