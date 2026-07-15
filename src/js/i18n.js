// i18n.js — dwujęzyczność PL/EN. Zero zależności, zero frameworka (jak reszta serwisu).
//
// Dwa źródła tekstu, jeden mechanizm:
//  1. HTML statyczny → atrybuty `data-en` (treść) i `data-en-<attr>` (aria-label, placeholder,
//     title, alt). PL zostaje w HTML jako źródło prawdy; oryginał cache'ujemy przy starcie,
//     więc powrót na PL nie wymaga drugiego słownika.
//  2. Teksty zaszyte w modułach JS → `t('polski tekst')`. Kluczem jest POLSKI string, nie
//     abstrakcyjny id — kod zostaje czytelny bez zaglądania do słownika, a brak wpisu
//     degraduje się do polskiego zamiast wybuchać.
//
// Moduły renderujące DOM dynamicznie wołają t() przy renderze; onLang() daje im sygnał do
// przerysowania tego, co akurat wisi na ekranie.

const STORE_KEY = 'qb-lang';

// ── Słownik PL → EN (stringi z modułów JS) ───────────────────────────────────
// Tłumaczenie marketingowe, nie dosłowne: „od A do Z" → „end-to-end", nie „from A to Z".
const EN = {
  // — nawigacja / HUD (navigation.js) —
  'PRODUKCJA EVENTÓW OD A DO Z':      'END-TO-END EVENT PRODUCTION',
  'PRODUKCJA I POST-PRODUKCJA AUDIO': 'AUDIO PRODUCTION & POST-PRODUCTION',
  'TECHNOLOGIA, DESIGN I DEVELOPMENT':'TECHNOLOGY, DESIGN & DEVELOPMENT',

  // — konsoleta kontaktu: tory (contact-console.js) —
  'Czego potrzebuje Twój event?': 'What does your event need?',
  'Co produkujemy?':              'What are we producing?',
  'Co budujemy?':                 'What are we building?',

  // — konsoleta: chipy (etykiety) —
  'Wyceń wydarzenie':        'Quote an event',
  'Wypożycz sprzęt':         'Rent equipment',
  'Scenariusz imprezy':      'Event script',
  'Streaming / live':        'Streaming / live',
  'Sound design':            'Sound design',
  'Nie wiem, doradźcie':     'Not sure — advise me',
  'Reklama / spot':          'Ad / commercial',
  'Produkcja audio':         'Audio production',
  'Nagranie lektora':        'Voice-over recording',
  'Coś innego':              'Something else',
  'Strona www / redesign':   'Website / redesign',
  'Aplikacja / platforma':   'App / platform',
  'UX / interfejs':          'UX / interface',
  'IoT / projekt techniczny':'IoT / hardware project',
  'Pomiary akustyczne':      'Acoustic measurement',
  'Mam luźny pomysł':        'I have a rough idea',

  // — konsoleta: szkielety wiadomości (\n zachowane 1:1) —
  'Chcę wycenić wydarzenie.\n• Data i miejsce: \n• Liczba gości: \n• Czego potrzebuję (nagłośnienie / światło / ekran / streaming): ':
    'I\'d like a quote for an event.\n• Date and venue: \n• Number of guests: \n• What I need (sound / lighting / screen / streaming): ',
  'Chcę wypożyczyć sprzęt.\n• Co: \n• Na kiedy (od–do): \n• Odbiór własny czy z obsługą: ':
    'I\'d like to rent equipment.\n• What: \n• When (from–to): \n• Self-pickup or with a crew: ',
  'Chcę pogadać o scenariuszu imprezy.\n• Charakter wydarzenia: \n• Co ma się wydarzyć: ':
    'I\'d like to talk through an event script.\n• Type of event: \n• What should happen: ',
  'Interesuje mnie realizacja live / streaming.\n• Gdzie i kiedy: \n• Ile kamer / platforma docelowa: ':
    'I\'m interested in a live / streaming production.\n• Where and when: \n• How many cameras / target platform: ',
  'Szukam sound designu.\n• Do czego (gra / film / instalacja): \n• Zakres: ':
    'I\'m looking for sound design.\n• What for (game / film / installation): \n• Scope: ',
  'Mam wydarzenie, ale nie wiem od czego zacząć.\n• Opowiem w skrócie: ':
    'I have an event but don\'t know where to start.\n• Here\'s the short version: ',
  'Potrzebuję reklamy / spotu.\n• Gdzie poleci (radio / social / instore): \n• Długość: \n• Termin: ':
    'I need an ad / commercial.\n• Where it will run (radio / social / in-store): \n• Length: \n• Deadline: ',
  'Chcę zamówić produkcję audio (audiobook / słuchowisko).\n• Materiał / objętość: \n• Termin: ':
    'I\'d like to commission audio production (audiobook / radio drama).\n• Material / length: \n• Deadline: ',
  'Potrzebuję lektora.\n• Język i płeć głosu: \n• Długość tekstu: \n• Termin: ':
    'I need a voice-over.\n• Language and voice: \n• Script length: \n• Deadline: ',
  'Mam pomysł audio, nie do końca pasuje do szufladek.\n• W skrócie: ':
    'I have an audio idea that doesn\'t quite fit the boxes.\n• In short: ',
  'Chcę stronę www lub redesign.\n• Dla kogo / jaka działalność: \n• Mam już coś czy od zera: \n• Termin: ':
    'I want a website or a redesign.\n• Who it\'s for / what business: \n• Existing site or from scratch: \n• Deadline: ',
  'Potrzebuję aplikacji / platformy (np. obsługa kawiarni).\n• Co ma robić: \n• Kto będzie używał: ':
    'I need an app / platform (e.g. running a café).\n• What it should do: \n• Who will use it: ',
  'Potrzebuję UX / projektu interfejsu.\n• Do czego (www / aplikacja / panel): \n• Mam już produkt czy od zera: ':
    'I need UX / interface design.\n• What for (site / app / dashboard): \n• Existing product or from scratch: ',
  'Mam pomysł na urządzenie / IoT.\n• Co ma robić: \n• Na jakim etapie jestem: ':
    'I have an idea for a device / IoT.\n• What it should do: \n• Where I am with it: ',
  'Interesują mnie pomiary akustyczne.\n• Jakie pomieszczenie / obiekt: \n• Cel (adaptacja / raport / projekt): ':
    'I\'m interested in acoustic measurement.\n• Which room / venue: \n• Goal (treatment / report / design): ',
  'Mam luźny pomysł i chcę pogadać, czy da się zrobić.\n• Pomysł: ':
    'I have a rough idea and want to know if it\'s doable.\n• The idea: ',

  // — konsoleta: stany wysyłki —
  'WYŚLIJ SYGNAŁ →':            'SEND SIGNAL →',
  'WYSYŁAM…':                   'SENDING…',
  'Nowy sygnał — qubatura.eu':  'New signal — qubatura.eu',
  'Nie udało się wysłać. Spróbuj ponownie lub napisz na biuro@qubatura.eu.':
    'Sending failed. Please try again or email biuro@qubatura.eu.',
  'Wrócimy z odpowiedzią — zwykle w ciągu doby.<br>Odpisujemy z <b>biuro@qubatura.eu</b>.':
    'A real person will get back to you — usually within a day.<br>We reply from <b>biuro@qubatura.eu</b>.',
  ', dziękujemy. ': ', thank you. ',

  // — galeria / studio / lab —
  'Poprzednie zdjęcie': 'Previous photo',
  'Następne zdjęcie':   'Next photo',
  'Zamknij podgląd':    'Close preview',

  // — pong: cytaty postaci —
  // Zasada: gdzie istnieje ZNANY angielski oryginał, wracamy do niego zamiast tłumaczyć polskie
  // tłumaczenie z powrotem (czytelnik EN zobaczy cytat jako oryginał — kalka byłaby wpadką).
  'Udowodniłem już, że mój system sygnalizacji umożliwia przesyłanie sygnału do każdego punktu globu, niezależnie od odległości.':
    'I have already demonstrated, by means of my system of signalling, that a signal can be transmitted to any point of the globe, no matter what the distance.',
  'Wyobraźnia jest ważniejsza niż wiedza.': 'Imagination is more important than knowledge.',
  'Jesteśmy zbudowani z gwiezdnej materii.': 'We are made of star stuff.',
  'Czasem to ludzie, po których nikt niczego się nie spodziewa, robią to, czego nikt sobie nie wyobraża.':
    'Sometimes it is the people no one imagines anything of who do the things that no one can imagine.',
  'Wszystko składa się z atomów.': 'Everything is made of atoms.',
  'Nic w życiu nie jest tak straszne, jak się wydaje, gdy się je zrozumie.':
    'Nothing in life is to be feared, it is only to be understood.',
  'Maszyna analityczna nie ma pretensji do tworzenia czegokolwiek samodzielnie.':
    'The Analytical Engine has no pretensions whatever to originate anything.',
  'Sztuka to pomost między tym, co widzisz, a tym, czego nie widzisz.':
    'Art is a bridge between what you see and what you don\'t.',
  'Muzyka jest moim duchowym wyrazem.': 'My music is the spiritual expression of what I am.',
  'Patrz w gwiazdy, nie pod nogi.': 'Look up at the stars and not down at your feet.',
  'Fale, które wykryłem, nie znajdą żadnego praktycznego zastosowania.':
    'I do not think that the wireless waves I have discovered will have any practical application.',
  'Bezprzewodowa telegrafia nie jest trudna do wytłumaczenia. Zwyczajny kabel po prostu nie jest potrzebny.':
    'Wireless telegraphy is not hard to explain. The ordinary cable is simply not needed.',
  'Geniusz to jeden procent inspiracji i dziewięćdziesiąt dziewięć procent transpiracji.':
    'Genius is one percent inspiration and ninety-nine percent perspiration.',
  'Prostota jest szczytem wyrafinowania.': 'Simplicity is the ultimate sophistication.',
  'Nauka i życie codzienne nie mogą i nie powinny być rozdzielane.':
    'Science and everyday life cannot and should not be separated.',

  // — pong (easter egg) —
  'Mysz lub strzałki ↑↓ · Gra do 3 bramek': 'Mouse or arrows ↑↓ · First to 3 goals',
  'MYSZ LUB STRZAŁKI ↑↓ · GRA DO 3 BRAMEK': 'MOUSE OR ARROWS ↑↓ · FIRST TO 3 GOALS',
  'PRZESUWAJ PALCEM · GRA DO 3 BRAMEK':      'SWIPE TO MOVE · FIRST TO 3 GOALS',
  'WYJDŹ':      'EXIT',
  'PAUZA':      'PAUSE',
  'WZNÓW':      'RESUME',
  'Wygrałeś!':  'You win!',
  'Przegrałeś': 'You lose',
  'Jeszcze raz': 'Play again',

  // — cookie consent —
  'Informacja o plikach cookies': 'Cookie notice',
  'Używamy wyłącznie <b>niezbędnych</b> plików cookies, aby strona działała.':
    'We use only <b>essential</b> cookies, so the site works.',
  'Więcej w':            'More in our',
  'polityce prywatności':'privacy policy',
  'Rozumiem':            'Got it',

  // — parallax: podpowiedzi mobilne —
  'Przesuwaj scenę palcem':   'Swipe to move the scene',
  'Przechyl, by ożywić scenę':'Tilt to bring the scene alive',

  // — studio: lightbox realizacji —
  'Posłuchaj w Audiotece →': 'Listen on Audioteka →',
  'Radio Katowice →':        'Radio Katowice →',
  'Zobacz →':                'View →',
  'Realizacja studia':       'Studio work',
  '2023 — prace nad audiobookiem „Valentino Rossi. Biografia" · czyta Mateusz Kapusta':
    '2023 — working on the audiobook „Valentino Rossi. Biografia" · read by Mateusz Kapusta',
  '2026 — przygotowania do sesji nagraniowej · Studio koncertowe Radia Katowice im. Jerzego Haralda':
    '2026 — preparing for a recording session · Jerzy Harald Concert Studio, Radio Katowice',

  // — lab: podpisy mockupów (nazwy własne marek zostają) —
  'Serwis samochodowy':    'Car service',
  'Klub piłkarski dzieci': 'Kids football club',
  'Salon stylizacji':      'Beauty salon',
  'Klub fitness':          'Fitness club',
  'Restauracja':           'Restaurant',

  // — galeria —
  'Pokaż': 'Show',
};

let lang = 'pl';
const subs = [];

// Cache oryginałów PL z HTML — pozwala wrócić na PL bez drugiego słownika w atrybutach.
const plCache = new WeakMap();   // el → { html, attrs: {name: value} }

/** Tłumaczenie stringu z modułu JS. Klucz = polski tekst; brak wpisu → PL (bezpieczny fallback). */
export function t(pl) {
  if (lang === 'pl') return pl;
  return EN[pl] !== undefined ? EN[pl] : pl;
}

/** Aktualny język ('pl' | 'en'). */
export function getLang() {
  return lang;
}

/** Subskrypcja zmiany języka — moduły przerysowują to, co mają otwarte na ekranie. */
export function onLang(cb) {
  subs.push(cb);
}

// Atrybuty tłumaczone przez `data-en-<attr>`.
const ATTRS = ['aria-label', 'placeholder', 'title', 'alt'];

function cacheOriginal(el) {
  if (plCache.has(el)) return;
  const attrs = {};
  ATTRS.forEach(a => { if (el.hasAttribute(a)) attrs[a] = el.getAttribute(a); });
  plCache.set(el, { html: el.innerHTML, attrs });
}

/** Przepisuje statyczny DOM na aktualny język. Woła się przy setLang i po wstrzyknięciu treści. */
export function applyDom(root = document) {
  root.querySelectorAll('[data-en]').forEach(el => {
    cacheOriginal(el);
    el.innerHTML = (lang === 'en') ? el.dataset.en : plCache.get(el).html;
  });

  ATTRS.forEach(attr => {
    const key = 'data-en-' + attr;
    root.querySelectorAll(`[${key}]`).forEach(el => {
      cacheOriginal(el);
      const en = el.getAttribute(key);
      const pl = plCache.get(el).attrs[attr];
      const val = (lang === 'en') ? en : pl;
      if (val !== undefined) el.setAttribute(attr, val);
    });
  });
}

/** Zmiana języka: DOM + <html lang> + zapamiętanie wyboru + sygnał do modułów. */
export function setLang(next) {
  if (next !== 'pl' && next !== 'en') return;
  lang = next;
  document.documentElement.lang = next;
  try { localStorage.setItem(STORE_KEY, next); } catch { /* prywatny tryb — trudno */ }
  applyDom();
  subs.forEach(cb => { try { cb(next); } catch (e) { console.warn('i18n sub:', e); } });
}

/** Język zapamiętany z poprzedniej wizyty (bez preferencji przeglądarki — PL to język domyślny marki). */
export function storedLang() {
  try { return localStorage.getItem(STORE_KEY) === 'en' ? 'en' : 'pl'; } catch { return 'pl'; }
}
