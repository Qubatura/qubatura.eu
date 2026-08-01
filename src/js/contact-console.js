// contact-console.js — silnik formularza Kontakt („centrum sterowania komunikacją").
// Osadzony w #contact-overlay (obok minimalistycznego Kontaktu). Brama (frost-kafelek)
// odsłania konsoletę w „pokoju łączności" (tło reveal) → tor → podpowiedź → opis → wyślij.
// Kolor działu zalewa konsoletę po wyborze toru; tło morfuje w scenę działu.
//
// Assety jako ABSOLUTNY URL z URL modułu (import.meta.url) — ODPORNE na SPA pushState.
import { t } from './i18n.js?v=msajxhno';

const DOC_ROOT = new URL('../', import.meta.url).href;
const asset = rel => new URL(rel, DOC_ROOT).href;

// Wysyłka: PHP na IQ Host (send.php → mail na biuro@qubatura.eu; dane zostają na serwerze, RODO-czysto).
// Poza domeną (localhost / GitHub Pages) NIE ma PHP → tryb podglądu: pokaż sukces, nie wysyłaj realnie.
const IS_LIVE = /(^|\.)qubatura\.eu$/i.test(location.hostname);

// Tory + podpowiedzi + gotowe szkielety wiadomości (klik podpowiedzi = auto-wypełnienie opisu).
const DATA = {
  events: { color: 'var(--color-events)', label: 'EVENTS', q: 'Czego potrzebuje Twój event?',
    items: [
      { t: 'Wyceń wydarzenie',   p: 'Chcę wycenić wydarzenie.\n• Data i miejsce: \n• Liczba gości: \n• Czego potrzebuję (nagłośnienie / światło / ekran / streaming): ' },
      { t: 'Wypożycz sprzęt',    p: 'Chcę wypożyczyć sprzęt.\n• Co: \n• Na kiedy (od–do): \n• Odbiór własny czy z obsługą: ' },
      { t: 'Scenariusz imprezy', p: 'Chcę pogadać o scenariuszu imprezy.\n• Charakter wydarzenia: \n• Co ma się wydarzyć: ' },
      { t: 'Streaming / live',   p: 'Interesuje mnie realizacja live / streaming.\n• Gdzie i kiedy: \n• Ile kamer / platforma docelowa: ' },
      { t: 'Nie wiem, doradźcie', p: 'Mam wydarzenie, ale nie wiem od czego zacząć.\n• Opowiem w skrócie: ', soft: 1 },
    ] },
  studio: { color: 'var(--color-studio)', label: 'STUDIO', q: 'Co produkujemy?',
    items: [
      { t: 'Reklama / spot',    p: 'Potrzebuję reklamy / spotu.\n• Gdzie poleci (radio / social / instore): \n• Długość: \n• Termin: ' },
      { t: 'Produkcja audio',   p: 'Chcę zamówić produkcję audio (audiobook / słuchowisko).\n• Materiał / objętość: \n• Termin: ' },
      { t: 'Sound design',      p: 'Szukam sound designu.\n• Do czego (gra / film / instalacja): \n• Zakres: ' },
      { t: 'Nagranie lektora',  p: 'Potrzebuję lektora.\n• Język i płeć głosu: \n• Długość tekstu: \n• Termin: ' },
      { t: 'Coś innego',        p: 'Mam pomysł audio, nie do końca pasuje do szufladek.\n• W skrócie: ', soft: 1 },
    ] },
  lab: { color: 'var(--color-lab)', label: 'Qlab', q: 'Co budujemy?',
    items: [
      { t: 'Strona www / redesign', p: 'Chcę stronę www lub redesign.\n• Dla kogo / jaka działalność: \n• Mam już coś czy od zera: \n• Termin: ' },
      { t: 'Aplikacja / platforma', p: 'Potrzebuję aplikacji / platformy (np. obsługa kawiarni).\n• Co ma robić: \n• Kto będzie używał: ' },
      { t: 'UX / interfejs',        p: 'Potrzebuję UX / projektu interfejsu.\n• Do czego (www / aplikacja / panel): \n• Mam już produkt czy od zera: ' },
      { t: 'IoT / projekt techniczny', p: 'Mam pomysł na urządzenie / IoT.\n• Co ma robić: \n• Na jakim etapie jestem: ' },
      { t: 'Pomiary akustyczne',    p: 'Interesują mnie pomiary akustyczne.\n• Jakie pomieszczenie / obiekt: \n• Cel (adaptacja / raport / projekt): ' },
      { t: 'Mam luźny pomysł',      p: 'Mam luźny pomysł i chcę pogadać, czy da się zrobić.\n• Pomysł: ', soft: 1 },
    ] },
};

export function initContactConsole() {
  const overlay = document.getElementById('contact-overlay');
  if (!overlay) return;
  const gate     = document.getElementById('cc-gate');
  const consoleEl = document.getElementById('cc-console');
  const wrap     = document.getElementById('cc-wrap');
  const closeBtn = document.getElementById('contact-close');
  const backBtn  = document.getElementById('cc-back');
  const chips    = document.getElementById('cc-chips');
  const nextBtn  = document.getElementById('cc-next');
  const s2q      = document.getElementById('cc-s2q');
  const msg      = document.getElementById('cc-msg');
  const subj     = document.getElementById('cc-subj');
  const nameIn   = document.getElementById('cc-name-in');
  const contactIn = document.getElementById('cc-contact-in');
  const rodoIn   = document.getElementById('cc-rodo-in');
  const rodoBox  = document.getElementById('cc-rodo');
  const hp       = document.getElementById('cc-hp');
  const bgA = document.getElementById('cc-bgA');
  const bgB = document.getElementById('cc-bgB');
  const vig = overlay.querySelector('.cc-vig');
  const steps = ['cc-s1', 'cc-s2', 'cc-s3', 'cc-s4'].map(id => document.getElementById(id));
  const count = document.getElementById('cc-count');

  // Natężenie tła pokoju łączności: przygaszone na minimalistycznym Kontakcie (standby),
  // mocniejsze w konsolecie/formularzu (online) — eskalacja standby → online.
  const OP_GATE = 0.22;
  const OP_FORM = 0.42;

  let cur = null;        // aktywny tor
  let depActive = null;  // która warstwa tła aktywna (crossfade)
  let selected = [];     // zaznaczone chipy (multi-select) — komponują wiadomość/temat

  function setStep(n) {
    steps.forEach((el, i) => el.classList.toggle('on', i === n - 1));
    if (count) {                                    // licznik 0n / 03 (kroki 1–3); na sukcesie znika
      count.innerHTML = '<b>0' + n + '</b> / 03';
      count.style.visibility = (n < 4) ? 'visible' : 'hidden';
    }
    backBtn.style.visibility = (n === 4) ? 'hidden' : 'visible';   // na sukcesie brak „wstecz"
  }
  function setDepBg(key, op = OP_FORM) {
    if (!key) { bgA.style.opacity = 0; bgB.style.opacity = 0; vig.style.opacity = 0; depActive = null; return; }
    const show = depActive === 'A' ? bgB : bgA;
    const hide = depActive === 'A' ? bgA : bgB;
    show.style.backgroundImage = "url('" + asset('../assets/qubatura.eu-tlo-dep-' + key + '.webp') + "')";
    show.style.opacity = op;
    hide.style.opacity = 0;
    vig.style.opacity = 1;
    depActive = depActive === 'A' ? 'B' : 'A';
  }
  function neutral() { wrap.style.setProperty('--cc', 'var(--color-primary)'); }

  function openConsole() {
    overlay.classList.add('is-console');
    consoleEl.setAttribute('aria-hidden', 'false');
    neutral();
    setDepBg('contact', OP_FORM);   // pokój „online" — mocniejszy niż na bramie
    setStep(1);
  }
  function closeConsole() {        // powrót do bramy (minimalistyczny Kontakt) — pokój zostaje, przygaszony
    overlay.classList.remove('is-console');
    consoleEl.setAttribute('aria-hidden', 'true');
    setDepBg('contact', OP_GATE);
    neutral();
    setStep(1);
  }
  function resetConsole() {        // pełny reset (przy zamknięciu całego overlaya)
    closeConsole();
    cur = null;
    selected = [];
    if (nextBtn) nextBtn.disabled = true;
    if (msg) msg.value = '';
    if (nameIn) nameIn.value = '';
    if (contactIn) contactIn.value = '';
    if (rodoIn) rodoIn.checked = false;
    if (rodoBox) rodoBox.classList.remove('err');
    if (hp) hp.value = '';
    const st = document.getElementById('cc-status'); if (st) st.textContent = '';
    const sb = document.getElementById('cc-send'); if (sb) { sb.disabled = false; sb.textContent = t('WYŚLIJ SYGNAŁ →'); }
  }
  function pickTor(key) {
    cur = key;
    selected = [];                 // nowy tor → czyste zaznaczenie
    const d = DATA[key];
    wrap.style.setProperty('--cc', d.color);
    s2q.firstChild.textContent = t(d.q);
    chips.innerHTML = '';
    d.items.forEach(it => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'cc-chip' + (it.soft ? ' soft' : '');
      b.textContent = t(it.t);
      b.setAttribute('aria-pressed', 'false');
      b.addEventListener('click', () => toggleChip(it, b));
      chips.appendChild(b);
    });
    if (nextBtn) nextBtn.disabled = true;
    setDepBg(key, OP_FORM);   // morfing tła w scenę działu
    setStep(2);
  }
  // Toggle-select: klient zaznacza chipy (multi), nic nie pisze. Zaznaczone złożą wiadomość+temat.
  function toggleChip(it, b) {
    const i = selected.indexOf(it);
    if (i >= 0) { selected.splice(i, 1); b.classList.remove('on'); b.setAttribute('aria-pressed', 'false'); }
    else        { selected.push(it);     b.classList.add('on');    b.setAttribute('aria-pressed', 'true'); }
    if (nextBtn) nextBtn.disabled = selected.length === 0;
  }
  // DALEJ → komponuje z zaznaczonych: temat = tytuły przez „ + ", opis = szkielety pól sklejone.
  function composeAndAdvance() {
    if (!selected.length) return;
    msg.value  = selected.map(it => t(it.p)).join('\n\n');
    subj.textContent = '[' + DATA[cur].label + '] ' + selected.map(it => t(it.t)).join(' + ');
    setStep(3);
    setTimeout(() => { msg.focus(); msg.setSelectionRange(msg.value.length, msg.value.length); }, 350);
  }
  function showSuccess() {
    const nm = (nameIn.value || '').trim();
    document.getElementById('cc-doneline').innerHTML =
      (nm ? nm + t(', dziękujemy. ') : '') +
      t('Wrócimy z odpowiedzią — zwykle w ciągu doby.<br>Odpisujemy z <b>biuro@qubatura.eu</b>.');
    setStep(4);
  }

  async function send() {
    if (hp && hp.value) return;                     // honeypot: bot wypełnił ukryte pole → cicho porzuć
    if (rodoIn && !rodoIn.checked) {                // brak zgody RODO → blokada wysyłki
      if (rodoBox) rodoBox.classList.add('err');
      return;
    }
    const status = document.getElementById('cc-status');
    if (status) status.textContent = '';

    // Poza domeną (localhost / Pages) brak PHP → tryb podglądu: sukces bez realnej wysyłki.
    if (!IS_LIVE) { showSuccess(); return; }

    const btn = document.getElementById('cc-send');
    const label = btn ? btn.textContent : '';
    if (btn) { btn.disabled = true; btn.textContent = t('WYSYŁAM…'); }
    try {
      const res = await fetch('send.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({
          subject: (subj.textContent || t('Nowy sygnał — qubatura.eu')).trim(),
          name: (nameIn.value || '').trim(),
          kontakt: (contactIn.value || '').trim(),
          message: (msg.value || '').trim(),
          botcheck: (hp && hp.value) || '',           // honeypot
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        showSuccess();
      } else {
        throw new Error('send failed');
      }
    } catch (err) {
      if (btn) { btn.disabled = false; btn.textContent = label || t('WYŚLIJ SYGNAŁ →'); }
      if (status) status.textContent = t('Nie udało się wysłać. Spróbuj ponownie lub napisz na biuro@qubatura.eu.');
    }
  }
  function back() {
    const on = steps.findIndex(el => el.classList.contains('on')) + 1;
    if (on === 1)      closeConsole();                          // z toru → brama
    else if (on === 2) { neutral(); setDepBg('contact', OP_FORM); setStep(1); }  // z podpowiedzi → tor (reset koloru/tła)
    else               setStep(on - 1);                         // z opisu → podpowiedzi (zostaje kolor działu)
  }

  // Otwarcie Kontaktu ([data-contact] → contact.js pokazuje overlay): włącz pokój łączności
  // od razu, przygaszony (standby). Konsoleta później go „rozjaśnia".
  document.addEventListener('click', e => {
    if (e.target.closest('[data-contact]')) setDepBg('contact', OP_GATE);
  });

  // Deep-link z CTA działu (np. Lab „Opisz projekt") → wejdź OD RAZU w konsoletę z wybranym torem,
  // z pominięciem bramy i wyboru toru. Element ma [data-contact] (contact.js otwiera overlay)
  // + [data-contact-tor="lab"] (ten skok: openConsole → pickTor → krok „Co budujemy?" w kolorze działu).
  document.addEventListener('click', e => {
    const trg = e.target.closest('[data-contact-tor]');
    if (!trg) return;
    const tor = trg.dataset.contactTor;
    if (!DATA[tor]) return;
    openConsole();
    pickTor(tor);
  });

  gate.addEventListener('click', openConsole);
  if (nextBtn) nextBtn.addEventListener('click', composeAndAdvance);
  backBtn.addEventListener('click', back);
  document.getElementById('cc-send').addEventListener('click', send);
  overlay.querySelectorAll('.cc-tor').forEach(t => t.addEventListener('click', () => pickTor(t.dataset.tor)));

  // Linki do polityki (checkbox + stopka Kontaktu) — SPA-proof (absolutny URL z modułu)
  overlay.querySelectorAll('[data-policy]').forEach(a => { a.href = asset('polityka-prywatnosci.html'); });
  // Zaznaczenie zgody kasuje stan błędu
  if (rodoIn) rodoIn.addEventListener('change', () => { if (rodoIn.checked && rodoBox) rodoBox.classList.remove('err'); });

  // Reset przy zamknięciu całego overlaya — spójne z contact.js (close-btn / Escape).
  closeBtn.addEventListener('click', resetConsole);
  window.addEventListener('keydown', e => { if (e.key === 'Escape') resetConsole(); });

  setStep(1);
}
