// qp-zapis.js — mini-zgłoszenie „nie mam zaproszenia" na karcie Qplayera (/qplayer).
//
// ⚠️ DLACZEGO INLINE, a nie [data-contact] → #contact-overlay:
// karta produktu (.product-overlay) ma z-index 1050, overlay kontaktu 1000. Kontakt
// otwierał się POD kartą i był zasłonięty jej tłem rgba(6,5,15,.9) — z zewnątrz objaw
// brzmiał „guzik nie działa, nic się nie dzieje" (zgłoszenie Kuby 2026-08-05).
// Formularz w miejscu nie nakłada się na nic, więc problem znika u źródła zamiast być
// obchodzony kolejnym z-indeksem.
//
// Wysyłka: /send.php — ten sam endpoint, którego używa konsoleta Kontaktu (mail na
// biuro@qubatura.eu, dane zostają na serwerze, bez pośrednika).
// ⚠️ ŚCIEŻKA ABSOLUTNA. Karta żyje pod /qplayer, więc względne 'send.php' poleciałoby
// na /qplayer/send.php i dostało 404. Ta sama pułapka, która była już opisana przy
// pobierz.php — jedna litera, cała klasa błędów mniej.

// Poza domeną (localhost / podgląd) nie ma PHP → sukces bez realnej wysyłki.
const IS_LIVE = /(^|\.)qubatura\.eu$/i.test(location.hostname);

export function initQpZapis() {
  const open = document.getElementById('qp-zapis-open');
  const form = document.getElementById('qp-zapis-form');
  if (!open || !form) return;

  const pola   = form.querySelector('.qp-zg-pola');
  const stopka = form.querySelector('.qp-zg-stopka');
  const status = form.querySelector('.qp-zg-status');
  const btn    = form.querySelector('button[type="submit"]');

  const val = n => {
    const el = form.elements[n];
    return el ? el.value.trim() : '';
  };

  open.addEventListener('click', () => {
    const otwieram = form.hidden;
    form.hidden = !otwieram;
    open.setAttribute('aria-expanded', String(otwieram));
    if (otwieram) {
      const first = form.elements['imie'];
      if (first) first.focus({ preventScroll: true });
      form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  });

  function sukces() {
    if (pola)   pola.hidden = true;
    if (stopka) stopka.hidden = true;
    if (status) {
      status.dataset.stan = 'ok';
      status.textContent = 'Mamy zgłoszenie. Kod wyślemy mailem — zwykle tego samego dnia.';
    }
  }

  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (!form.reportValidity()) return;

    const label = btn ? btn.textContent : '';
    if (btn) { btn.disabled = true; btn.textContent = 'Wysyłam…'; }
    if (status) { status.textContent = ''; status.dataset.stan = ''; }

    if (!IS_LIVE) { sukces(); return; }

    try {
      const res = await fetch('/send.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({
          subject: '[QPLAYER] Prośba o testy — ' + val('imie'),
          name:    val('imie'),
          kontakt: val('mail'),          // trafia w Reply-To → odpowiadasz jednym klikiem
          message:
            'Prośba o dostęp testowy (14 dni) z karty /qplayer.\n\n' +
            'Miasto:    ' + val('miasto') + '\n' +
            'Gdzie gra: ' + val('gdzie')  + '\n',
          botcheck: val('botcheck'),     // honeypot
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error('send failed');
      sukces();
    } catch (err) {
      if (btn) { btn.disabled = false; btn.textContent = label || 'Wyślij zgłoszenie'; }
      if (status) {
        status.dataset.stan = 'blad';
        status.textContent = 'Nie udało się wysłać. Napisz na biuro@qubatura.eu — załatwimy tak samo.';
      }
    }
  });
}
