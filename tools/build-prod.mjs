// tools/build-prod.mjs — buduje dist/ serwowalny z ROOTA domeny (qubatura.eu/, nie /src/).
// Płaska kopia src/* -> dist/ + assets/ -> dist/assets/, i przepisanie ścieżek do assetów tak,
// żeby index.html leżał w rootcie (a nie w /src/):
//   root (HTML) + JS:  "../assets/"   -> "assets/"      (dokument/DOC_ROOT = root)
//   CSS (dist/css/):   "../../assets/" -> "../assets/"  (css jest o jeden poziom niżej)
// Dev (src/, GitHub Pages pod /src/) NIE jest ruszany — build idzie tylko na serwer produkcyjny.
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT   = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC    = path.join(ROOT, 'src');
const ASSETS = path.join(ROOT, 'assets');
const DIST   = path.join(ROOT, 'dist');

async function walk(dir, cb) {
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) await walk(p, cb);
    else await cb(p);
  }
}

async function main() {
  await fs.rm(DIST, { recursive: true, force: true });
  await fs.mkdir(DIST, { recursive: true });
  await fs.cp(SRC, DIST, { recursive: true });                       // index.html, css/, js/, send.php, polityka, robots, sitemap
  await fs.cp(ASSETS, path.join(DIST, 'assets'), { recursive: true });

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

  console.log('build-prod: dist/ gotowe (root-servable), przepisano plików=' + touched);
}
main().catch(e => { console.error(e); process.exit(1); });
