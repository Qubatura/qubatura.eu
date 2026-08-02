// tune-signet.js — panel strojenia materiału sygnetu. Ładuje się WYŁĄCZNIE przy ?tune=1,
// więc zwykły gość nie pobiera ani bajta z tego pliku (import jest dynamiczny w main.js).
//
// Po co: refrakcja próbkuje PRAWDZIWE tło sceny (planeta, mgła, wieża), więc wartości
// dobrane w oderwanym playgroundzie nie przenoszą się 1:1. Strojenie idzie na żywym sygnecie.
//
// Czego panel NIE dotyka: uDivColor / uDivMix / uColorMix — barwienie w stronę działów
// zostaje nietknięte, to osobny mechanizm i działa dobrze.

const KLUCZ = 'qb-tune-sygnet';

// Suwaki: [uniform, etykieta, min, max, krok]. Kolejność = od tego, co najmocniej rządzi
// wrażeniem „szklana waza z cieczą", do drobiazgów.
const SUWAKI = [
  ['uEnvIntensity',      'Odbicia otoczenia',         0,    2,    0.02],
  ['uEnvRoll',           'Szerokość rolki światła',   0.15, 3,    0.05],
  ['uFillDensity',       'Gęstość cieczy',            0,    1,    0.01],
  ['uOpal',              'Opalizacja (żyły)',         0,    3.5,  0.05],
  ['uFrontClear',        'Okno szkła na froncie',     0,    1,    0.01],
  ['uFrontFlat',         'Rozjaśnienie frontu',       0,    1,    0.01],
  ['refractionStrength', 'Siła refrakcji tła',        0,    0.2,  0.002],
  ['uFrontGlass',        'Smuga szkła na tafli',      0,    2,    0.01],
  ['uInnerDepth',        'Głębia cieczy (parallaks)', 0,    5,    0.05],
  ['uBodyAlpha',         'Krycie bryły',              0,    1,    0.01],
  ['uBodyDim',           'Przyciemnienie całości',    0.4,  1.2,  0.01],
  ['uGlassFloor',        'Podłoga połysku',           0,    0.6,  0.01],
  ['uBaseFill',          'Płaskie wypełnienie',       0,    0.4,  0.01],
  ['uPrimaryShift',      'Ściąganie ku primary',      0,    1,    0.01],
];

// Dwa reżimy, które dziś siedzą w signet.js — do porównania jednym kliknięciem.
// Różnią się TYLKO tymi czterema; reszta jest 1:1 od lipca.
const PRESETY = {
  'desktop (dziś)': { uFillDensity: 0.82, uOpal: 1.8, uFrontFlat: 1.0, uFrontClear: 0.0 },
  'mobile (dziś)':  { uFillDensity: 0.28, uOpal: 2.4, uFrontFlat: 0.0, uFrontClear: 1.0 },
};

const doHex = v => '#' + [v.x, v.y, v.z]
  .map(k => Math.round(Math.max(0, Math.min(1, k)) * 255).toString(16).padStart(2, '0')).join('');
const zHex = h => ({
  x: parseInt(h.slice(1, 3), 16) / 255,
  y: parseInt(h.slice(3, 5), 16) / 255,
  z: parseInt(h.slice(5, 7), 16) / 255,
});

export function initTuneSignet() {
  const u = window.__sygnetUniformy;
  if (!u) { console.warn('[tune] brak uniformów sygnetu — czy signet.js zdążył się zainicjalizować?'); return; }

  const style = document.createElement('style');
  style.textContent = `
    /* Lewa strona: prawy górny róg zajmuje topbar (KONTAKT / EN / dźwięk) — panel by go zasłaniał. */
    #qb-tune{position:fixed;top:14px;left:14px;z-index:9999;width:296px;max-height:calc(100dvh - 28px);
      display:flex;flex-direction:column;background:rgba(8,7,18,.94);border:1px solid rgba(139,79,255,.42);
      border-radius:12px;color:#F0EFFF;font:12px/1.4 ui-monospace,'DM Mono',monospace;
      box-shadow:0 24px 60px rgba(0,0,0,.6);backdrop-filter:none;}
    #qb-tune header{display:flex;align-items:center;justify-content:space-between;gap:8px;
      padding:10px 12px;border-bottom:1px solid rgba(139,79,255,.28);}
    #qb-tune h4{margin:0;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#8B4FFF;}
    #qb-tune .qb-body{overflow-y:auto;padding:10px 12px 12px;}
    #qb-tune.qb-zwiniety .qb-body{display:none;}
    #qb-tune .row{margin-bottom:9px;}
    #qb-tune .row label{display:flex;justify-content:space-between;gap:8px;margin-bottom:3px;color:#BDB8D8;}
    #qb-tune .row b{color:#F0EFFF;font-weight:500;}
    #qb-tune input[type=range]{width:100%;accent-color:#8B4FFF;margin:0;height:16px;}
    #qb-tune input[type=color]{width:100%;height:26px;padding:0;border:1px solid rgba(139,79,255,.3);
      background:none;border-radius:5px;cursor:pointer;}
    #qb-tune .btns{display:flex;flex-wrap:wrap;gap:6px;margin:4px 0 10px;}
    #qb-tune button{flex:1 1 auto;background:rgba(139,79,255,.14);color:#F0EFFF;cursor:pointer;
      border:1px solid rgba(139,79,255,.42);border-radius:6px;padding:6px 8px;font:inherit;font-size:11px;
      transition:background .18s ease,border-color .18s ease;}
    #qb-tune button:hover{background:rgba(139,79,255,.3);border-color:#8B4FFF;}
    #qb-tune .qb-x{flex:0 0 auto;padding:2px 8px;}
    #qb-tune .info{color:#8E88AD;font-size:10.5px;line-height:1.45;margin:0 0 8px;}
    #qb-tune .sep{border:none;border-top:1px solid rgba(139,79,255,.22);margin:10px 0;}
  `;
  document.head.appendChild(style);

  const panel = document.createElement('div');
  panel.id = 'qb-tune';
  const mobile = window.innerWidth <= 768;
  panel.innerHTML = `
    <header>
      <h4>Sygnet — strojenie</h4>
      <button class="qb-x" type="button" data-zwin>–</button>
    </header>
    <div class="qb-body">
      <p class="info">To okno widzi <b>${mobile ? 'mobile' : 'desktop'}</b> (szer. ${window.innerWidth}px).
      Barwienie w stronę działów działa normalnie i nie jest tu ruszane.</p>
      <div class="btns" data-presety></div>
      <div data-suwaki></div>
      <hr class="sep">
      <div class="row"><label>Barwa rantu (uEdgeWarm)</label><input type="color" data-edge></div>
      <div class="btns">
        <button type="button" data-kopiuj>Kopiuj wartości</button>
        <button type="button" data-zeruj>Cofnij do kodu</button>
      </div>
      <p class="info" data-status>Ustawienia zapisują się same — po F5 wracają twoje, nie kodowe.</p>
    </div>`;
  document.body.appendChild(panel);

  const wSuwaki = panel.querySelector('[data-suwaki]');
  const status = panel.querySelector('[data-status]');
  const zKodu = Object.fromEntries(SUWAKI.map(([k]) => [k, u[k].value]));
  const edgeZKodu = doHex(u.uEdgeWarm.value);

  const odswiez = {};
  SUWAKI.forEach(([klucz, etykieta, min, max, krok]) => {
    const row = document.createElement('div');
    row.className = 'row';
    row.innerHTML = `<label>${etykieta} <b data-v></b></label>
      <input type="range" min="${min}" max="${max}" step="${krok}" value="${u[klucz].value}">`;
    const suwak = row.querySelector('input');
    const pole = row.querySelector('[data-v]');
    const pokaz = () => { pole.textContent = (+u[klucz].value).toFixed(krok < 0.01 ? 3 : 2); };
    suwak.addEventListener('input', () => { u[klucz].value = +suwak.value; pokaz(); zapisz(); });
    odswiez[klucz] = () => { suwak.value = u[klucz].value; pokaz(); };
    pokaz();
    wSuwaki.appendChild(row);
  });

  const edge = panel.querySelector('[data-edge]');
  edge.value = edgeZKodu;
  edge.addEventListener('input', () => {
    const c = zHex(edge.value);
    u.uEdgeWarm.value.set ? u.uEdgeWarm.value.set(c.x, c.y, c.z)
                          : Object.assign(u.uEdgeWarm.value, c);
    zapisz();
  });

  function zastosuj(wartosci) {
    Object.entries(wartosci).forEach(([k, v]) => {
      if (k === 'uEdgeWarm') { const c = zHex(v); u.uEdgeWarm.value.set(c.x, c.y, c.z); edge.value = v; return; }
      if (!u[k]) return;
      u[k].value = v;
      odswiez[k] && odswiez[k]();
    });
  }

  function zapisz() {
    const stan = Object.fromEntries(SUWAKI.map(([k]) => [k, +u[k].value]));
    stan.uEdgeWarm = doHex(u.uEdgeWarm.value);
    localStorage.setItem(KLUCZ, JSON.stringify(stan));
  }

  // Presety: podglądnij, jak dziś wygląda drugi reżim, bez grzebania w kodzie.
  const wPresety = panel.querySelector('[data-presety]');
  Object.entries(PRESETY).forEach(([nazwa, wart]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = nazwa;
    b.addEventListener('click', () => { zastosuj(wart); zapisz(); status.textContent = 'Wgrany preset: ' + nazwa; });
    wPresety.appendChild(b);
  });

  panel.querySelector('[data-zeruj]').addEventListener('click', () => {
    zastosuj({ ...zKodu, uEdgeWarm: edgeZKodu });
    localStorage.removeItem(KLUCZ);
    status.textContent = 'Wróciły wartości z kodu.';
  });

  // Kopiuj = gotowy blok do wklejenia w signet.js, żeby nikt nie przepisywał liczb z palca.
  panel.querySelector('[data-kopiuj]').addEventListener('click', async () => {
    const linie = SUWAKI.map(([k]) => `    ${k}:`.padEnd(28) + `{ value: ${(+u[k].value).toFixed(3)} },`);
    const e = u.uEdgeWarm.value;
    linie.push('    uEdgeWarm:'.padEnd(28) +
      `{ value: new THREE.Vector3(${e.x.toFixed(3)}, ${e.y.toFixed(3)}, ${e.z.toFixed(3)}) },`);
    const tekst = `// sygnet — wartości ze strojenia, ${new Date().toISOString().slice(0, 10)}\n` + linie.join('\n');
    try {
      await navigator.clipboard.writeText(tekst);
      status.textContent = 'Skopiowane do schowka — wklej mi to na czacie.';
    } catch {
      console.log(tekst);
      status.textContent = 'Schowek zablokowany — wartości poszły do konsoli (F12).';
    }
  });

  panel.querySelector('[data-zwin]').addEventListener('click', e => {
    panel.classList.toggle('qb-zwiniety');
    e.target.textContent = panel.classList.contains('qb-zwiniety') ? '+' : '–';
  });

  // Twoje ostatnie ustawienia wracają po odświeżeniu — inaczej każde F5 kasowałoby robotę.
  const zapisane = localStorage.getItem(KLUCZ);
  if (zapisane) {
    try { zastosuj(JSON.parse(zapisane)); status.textContent = 'Wczytane twoje ostatnie ustawienia.'; }
    catch { localStorage.removeItem(KLUCZ); }
  }
}
