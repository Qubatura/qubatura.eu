// pong.js — easter egg "Chwila relaksu". Klasyczny Pong, styl Atari 1972.
// Gra do 3 punktów. Gracz (lewa/mysz lub W·S·↑↓) vs Bot (prawa/AI).
// Po zwycięstwie: cytat losowej postaci historycznej nad polem → powrót HOME.

import * as GSAPmod from 'gsap';
import { navFX } from './tint.js?v=mrah82mr';

const gsap = GSAPmod.gsap || GSAPmod.default || GSAPmod;

const PEOPLE = [
  {
    name: 'Nikola Tesla', years: '1856–1943',
    quote: 'Udowodniłem już, że mój system sygnalizacji umożliwia przesyłanie sygnału do każdego punktu globu, niezależnie od odległości.',
  },
  {
    name: 'Albert Einstein', years: '1879–1955',
    quote: 'Wyobraźnia jest ważniejsza niż wiedza.',
  },
  {
    name: 'Carl Sagan', years: '1934–1996',
    quote: 'Jesteśmy zbudowani z gwiezdnej materii.',
  },
  {
    name: 'Alan Turing', years: '1912–1954',
    quote: 'Czasem to ludzie, po których nikt niczego się nie spodziewa, robią to, czego nikt sobie nie wyobraża.',
  },
  {
    name: 'Richard Feynman', years: '1918–1988',
    quote: 'Wszystko składa się z atomów.',
  },
  {
    name: 'Marie Curie', years: '1867–1934',
    quote: 'Nic w życiu nie jest tak straszne, jak się wydaje, gdy się je zrozumie.',
  },
  {
    name: 'Ada Lovelace', years: '1815–1852',
    quote: 'Maszyna analityczna nie ma pretensji do tworzenia czegokolwiek samodzielnie.',
  },
  {
    name: 'David Bowie', years: '1947–2016',
    quote: 'Sztuka to pomost między tym, co widzisz, a tym, czego nie widzisz.',
  },
  {
    name: 'John Coltrane', years: '1926–1967',
    quote: 'Muzyka jest moim duchowym wyrazem.',
  },
  {
    name: 'Stephen Hawking', years: '1942–2018',
    quote: 'Patrz w gwiazdy, nie pod nogi.',
  },
  {
    name: 'Heinrich Hertz', years: '1857–1894',
    quote: 'Fale, które wykryłem, nie znajdą żadnego praktycznego zastosowania.',
  },
  {
    name: 'Guglielmo Marconi', years: '1874–1937',
    quote: 'Bezprzewodowa telegrafia nie jest trudna do wytłumaczenia. Zwyczajny kabel po prostu nie jest potrzebny.',
  },
  {
    name: 'Thomas Edison', years: '1847–1931',
    quote: 'Geniusz to jeden procent inspiracji i dziewięćdziesiąt dziewięć procent transpiracji.',
  },
  {
    name: 'Leonardo da Vinci', years: '1452–1519',
    quote: 'Prostota jest szczytem wyrafinowania.',
  },
  {
    name: 'Rosalind Franklin', years: '1920–1958',
    quote: 'Nauka i życie codzienne nie mogą i nie powinny być rozdzielane.',
  },
];

const WIN_SCORE = 3;
const PAD_W    = 8;
const K_SPD    = 5;
const FLASH_MS = 700;

// Kolor monochrom — cała gra w jednym: biały na czarnym, jak oryginał z 1972.
const C_MAIN  = 'rgba(255,255,255,1.00)';
const C_DIM   = 'rgba(255,255,255,0.55)';
const C_GHOST = 'rgba(255,255,255,0.20)';
const C_MARK  = '#5B2EFF';   // primary violet: tylko flash wyniku

export function initPong() {
  const btn = document.getElementById('nav-pong');
  if (!btn) return;
  btn.addEventListener('click', e => { e.preventDefault(); startGame(); });
}

const isMobile = () => window.innerWidth <= 768;

// getArea zwraca wymiary boiska — szersze o ~15% bo sygnet skurczony do 0.62
function getArea() {
  const W  = window.innerWidth;
  const H  = window.innerHeight;
  // Na mobile dodajemy bufor na safe-area-inset-top (notch/Dynamic Island ≈ 47px).
  // Nagłówek gry (header) wyrenderuje się 30px nad krawędzią boiska → gt - 30 ≥ safe area.
  const gt = isMobile() ? 80 : 52;
  const gb = H * 0.5 - 115;   // tighter: signet @ 0.62 → mniej miejsca zajmuje
  const GH = Math.max(120, gb - gt);
  const GW = Math.round(GH * 4 / 3);
  const GL = Math.round((W - GW) / 2);
  return { GW, GH, GT: gt, GL };
}

function startGame() {
  const overlay = document.getElementById('pong-overlay');
  const canvas  = document.getElementById('pong-canvas');
  const card    = document.getElementById('pong-card');
  const header  = document.getElementById('pong-header');
  const footer  = document.getElementById('pong-footer');
  if (!overlay || !canvas || !card) return;

  gsap.to(navFX, { pageScale: 0.62, duration: 0.55, ease: 'power2.inOut' });
  // Mobile: sygnet odpływa w głąb sceny — perspektywa głębi + robi miejsce na boisko
  if (isMobile()) gsap.to(navFX, { pageZ: -70, pageY: -25, duration: 0.65, ease: 'power2.inOut' });

  const { GW, GH, GT, GL } = getArea();
  const PAD_H      = Math.round(GH / 5);
  const BALL_R     = Math.max(4, Math.round(GW * 0.016));
  // Prędkość proporcjonalna do szerokości boiska → identyczne tempo przekraczania pola
  // niezależnie od rozmiaru ekranu (mobile vs desktop).
  const BASE_SPEED = GW * 0.0090;
  const MAX_SPEED  = BASE_SPEED * 2.4;
  const BASE_AI    = GW * 0.0055;

  canvas.width  = GW;
  canvas.height = GH;
  canvas.style.top  = GT + 'px';
  canvas.style.left = GL + 'px';
  gsap.set(canvas, { opacity: 1 });

  if (header) {
    header.style.top   = (GT - 30) + 'px';
    header.style.left  = GL + 'px';
    header.style.width = GW + 'px';
    gsap.set(header, { opacity: 1 });
  }
  if (footer) {
    footer.style.top     = (GT + GH + 9) + 'px';
    footer.style.left    = GL + 'px';
    footer.style.width   = GW + 'px';
    footer.textContent   = isMobile()
      ? 'PRZESUWAJ PALCEM · GRA DO 3 BRAMEK'
      : 'MYSZ LUB STRZAŁKI ↑↓ · GRA DO 3 BRAMEK';
    gsap.set(footer, { opacity: 1 });
  }

  // Karta nad polem gry (nie centrum ekranu)
  card.style.top    = GT + 'px';
  card.style.left   = GL + 'px';
  card.style.width  = GW + 'px';
  card.style.height = GH + 'px';

  const ctx    = canvas.getContext('2d');
  const player = { y: GH / 2 };
  const ai     = { y: GH / 2 };
  let   speedMult = 1.0;
  let   paused    = false;

  const state  = {
    score:      { player: 0, bot: 0 },
    ball:       makeBall(GW, GH, BASE_SPEED, speedMult),
    flashTime:  0,
    lastScorer: null,
    resetDelay: 55,   // ~1s opóźnienia przed pierwszą piłką — gracz ma czas się zorientować
  };

  // Speed panel — po state, żeby handler miał dostęp do state.ball
  const speedPanel = document.getElementById('pong-speed');
  if (speedPanel) {
    speedPanel.style.top  = GT + 'px';
    speedPanel.style.left = (GL + GW + 18) + 'px';
    gsap.set(speedPanel, { opacity: 1 });
    speedPanel.querySelectorAll('.speed-btn[data-mult]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mult === '1.0');
      btn.addEventListener('click', () => {
        speedMult = parseFloat(btn.dataset.mult);
        speedPanel.querySelectorAll('.speed-btn[data-mult]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        // Natychmiastowe zastosowanie na bieżącą piłkę
        const cur    = Math.hypot(state.ball.vx, state.ball.vy);
        const target = BASE_SPEED * speedMult;
        if (cur > 0) { const r = target / cur; state.ball.vx *= r; state.ball.vy *= r; }
      });
    });
    const pauseBtn = document.getElementById('pong-pause');
    if (pauseBtn) {
      pauseBtn.addEventListener('click', () => {
        paused = !paused;
        pauseBtn.textContent = paused ? 'PLAY' : 'PAUSE';
        pauseBtn.classList.toggle('active', paused);
      });
    }
  }

  // Input — eksplicytne tryby: 'idle' | 'mouse' | 'key'
  // Paletka nigdy nie ciągnie się samoistnie do centrum.
  let mouseY    = GH / 2;
  let inputMode = 'idle';
  let lastKeyMs = 0;
  const KEY_PRIO = 600;
  const keys     = {};
  const onMove = e => {
    mouseY = e.clientY - GT;
    if (Date.now() - lastKeyMs >= KEY_PRIO) inputMode = 'mouse';
  };
  const onKey = e => {
    keys[e.key] = e.type === 'keydown';
    if (e.type === 'keydown') { lastKeyMs = Date.now(); inputMode = 'key'; }
  };
  // Touch: delta ruchu palca przesuwa paletkę — dotknięcie GDZIEKOLWIEK + przeciągnięcie.
  // Paletka nie skacze do miejsca dotyku, podąża za gestem (jak touchpad).
  let touchPrevY = null;
  const onTouch = e => {
    if (e.target.closest?.('#pong-speed')) return;   // przepuść dotyku do przycisków prędkości/pauzy
    e.preventDefault();
    const t = e.touches[0];
    if (!t) return;
    if (touchPrevY !== null) {
      mouseY += t.clientY - touchPrevY;
      mouseY  = Math.max(0, Math.min(GH, mouseY));
    }
    touchPrevY = t.clientY;
    inputMode = 'mouse';
  };
  const onTouchEnd = () => { touchPrevY = null; };
  window.addEventListener('mousemove', onMove);
  window.addEventListener('keydown',   onKey);
  window.addEventListener('keyup',     onKey);
  // Listenery na overlay (cały ekran), nie canvas — żeby "touch anywhere" naprawdę działał.
  overlay.addEventListener('touchstart',  onTouch,    { passive: false });
  overlay.addEventListener('touchmove',   onTouch,    { passive: false });
  overlay.addEventListener('touchend',    onTouchEnd, { passive: false });
  overlay.addEventListener('touchcancel', onTouchEnd, { passive: false });

  document.body.classList.add('pong-active');
  gsap.to(overlay, { opacity: 1, duration: 0.4, ease: 'power2.out' });

  let raf, done = false;

  function cleanup() {
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('keydown',   onKey);
    window.removeEventListener('keyup',     onKey);
    overlay.removeEventListener('touchstart',  onTouch);
    overlay.removeEventListener('touchmove',   onTouch);
    overlay.removeEventListener('touchend',    onTouchEnd);
    overlay.removeEventListener('touchcancel', onTouchEnd);
  }

  // WYJDŹ — natychmiastowy powrót na HOME w trakcie meczu, bez dogrywania (B1).
  // Sprząta tak samo jak finał gry: zatrzymuje pętlę, zdejmuje listenery, sygnet
  // wraca z głębi/skali do pozycji HOME, panel/canvas znikają, przyciski reset.
  function quitGame() {
    if (done) return;
    done = true;
    cancelAnimationFrame(raf);
    cleanup();
    const fadeEls = [canvas, card];
    if (header) fadeEls.push(header);
    if (footer) fadeEls.push(footer);
    if (speedPanel) fadeEls.push(speedPanel);
    gsap.to(navFX, { pageScale: 1, duration: 0.5, ease: 'power2.out' });
    if (isMobile()) gsap.to(navFX, { pageZ: 0, pageY: 0, duration: 0.5, ease: 'power2.out' });
    gsap.to([overlay, ...fadeEls], {
      opacity: 0, duration: 0.45, ease: 'power2.in',
      onComplete() {
        document.body.classList.remove('pong-active');
        gsap.set([overlay, ...fadeEls], { opacity: 0 });
        canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
        if (speedPanel) {
          speedPanel.querySelectorAll('.speed-btn[data-mult]').forEach(b => {
            b.classList.toggle('active', b.dataset.mult === '1.0');
          });
          const pb = document.getElementById('pong-pause');
          if (pb) { pb.textContent = 'PAUSE'; pb.classList.remove('active'); }
        }
      },
    });
  }
  const exitBtn = document.getElementById('pong-exit');
  if (exitBtn) exitBtn.onclick = quitGame;   // .onclick (nie addEventListener) → brak kumulacji między grami

  function movePlayer() {
    if (inputMode === 'key') {
      if (keys['ArrowUp']   || keys['w'] || keys['W']) player.y -= K_SPD;
      if (keys['ArrowDown'] || keys['s'] || keys['S']) player.y += K_SPD;
    } else if (inputMode === 'mouse') {
      player.y += (mouseY - player.y) * 0.15;
    }
    // idle → paletka stoi w miejscu, nie ciągnie się do żadnej pozycji
    player.y = Math.max(PAD_H / 2, Math.min(GH - PAD_H / 2, player.y));
  }

  function scoreGoal(scorer) {
    state.score[scorer]++;
    state.lastScorer = scorer;
    state.flashTime  = Date.now();

    if (state.score[scorer] >= WIN_SCORE) {
      done = true;
      cancelAnimationFrame(raf);
      cleanup();
      draw(ctx, GW, GH, player, ai, state, PAD_H, BALL_R);
      setTimeout(() => showCard(overlay, canvas, card, header, footer), 900);
    } else {
      // Tylko piłka resetuje się — paletki zostają gdzie je gracz zostawił
      state.ball = makeBall(GW, GH, BASE_SPEED, speedMult);
      state.resetDelay = 55;
    }
  }

  function loop() {
    if (done) return;
    raf = requestAnimationFrame(loop);
    if (paused) return;   // zamrożona scena — canvas nie rysowany, wygląd zachowany

    // Pauza po golu / przy starcie: gracz może przestawiać paletkę, piłka stoi w centrum
    if (state.resetDelay > 0) {
      state.resetDelay--;
      movePlayer();
      draw(ctx, GW, GH, player, ai, state, PAD_H, BALL_R);
      return;
    }

    movePlayer();

    // Bot śledzi piłkę z opóźnieniem — można go pokonać
    const d = state.ball.y - ai.y;
    ai.y += Math.sign(d) * Math.min(Math.abs(d) * 0.06, BASE_AI);
    ai.y  = Math.max(PAD_H / 2, Math.min(GH - PAD_H / 2, ai.y));

    const b = state.ball;
    b.x += b.vx;
    b.y += b.vy;

    // Ściany górna/dolna
    if (b.y - BALL_R < 2)      { b.y = 2 + BALL_R;      b.vy =  Math.abs(b.vy); }
    if (b.y + BALL_R > GH - 2) { b.y = GH - 2 - BALL_R; b.vy = -Math.abs(b.vy); }

    // Lewa paletka (gracz)
    const lpR = 28 + PAD_W;
    if (b.vx < 0 && b.x - BALL_R <= lpR && b.x > 28 &&
        b.y > player.y - PAD_H / 2 && b.y < player.y + PAD_H / 2) {
      b.x = lpR + BALL_R;
      reflect(b, player.y, 1, PAD_H, MAX_SPEED);
    }

    // Prawa paletka (bot)
    const rpL = GW - 28 - PAD_W;
    if (b.vx > 0 && b.x + BALL_R >= rpL && b.x < GW - 28 &&
        b.y > ai.y - PAD_H / 2 && b.y < ai.y + PAD_H / 2) {
      b.x = rpL - BALL_R;
      reflect(b, ai.y, -1, PAD_H, MAX_SPEED);
    }

    // Gole
    if      (b.x < -BALL_R * 2)     scoreGoal('bot');
    else if (b.x > GW + BALL_R * 2) scoreGoal('player');

    if (!done) draw(ctx, GW, GH, player, ai, state, PAD_H, BALL_R);
  }

  loop();
}

function makeBall(GW, GH, baseSpeed, mult = 1.0) {
  const spd   = baseSpeed * mult;
  const angle = (Math.random() * 0.5 - 0.25) * Math.PI;
  const dir   = Math.random() > 0.5 ? 1 : -1;
  return { x: GW / 2, y: GH / 2,
           vx: Math.cos(angle) * spd * dir,
           vy: Math.sin(angle) * spd };
}

function reflect(ball, padY, dir, PAD_H, maxSpd) {
  const rel = (ball.y - padY) / (PAD_H / 2);
  const ang = rel * (Math.PI * 0.32);
  const spd = Math.min(Math.hypot(ball.vx, ball.vy) * 1.04, maxSpd ?? 11);
  ball.vx   = dir * Math.cos(ang) * spd;
  ball.vy   = Math.sin(ang) * spd;
}

function draw(ctx, GW, GH, player, ai, state, PAD_H, BALL_R) {
  ctx.clearRect(0, 0, GW, GH);

  // EST. 1972 watermark — dyskretny, lewy-dolny (pixel font jak reszta gry)
  ctx.save();
  ctx.font         = '8px "Press Start 2P", monospace';
  ctx.textAlign    = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillStyle    = 'rgba(255,255,255,0.22)';
  ctx.fillText('EST. 1972', 10, GH - 7);
  ctx.restore();

  // Ściany (góra/dół) — monochromatyczne białe
  ctx.fillStyle = C_MAIN;
  ctx.fillRect(0, 0,      GW, 2);
  ctx.fillRect(0, GH - 2, GW, 2);

  // Linia środkowa — przerywana, niska intensywność
  ctx.save();
  ctx.setLineDash([6, 10]);
  ctx.strokeStyle = C_GHOST;
  ctx.lineWidth   = 1;
  ctx.beginPath(); ctx.moveTo(GW / 2, 2); ctx.lineTo(GW / 2, GH - 2);
  ctx.stroke();
  ctx.restore();

  // Tablica wyników — Press Start 2P, twardy pixel, obie strony linii środkowej
  const fontSize  = Math.max(16, Math.round(GH * 0.075));
  const flashPct  = Math.max(0, 1 - (Date.now() - state.flashTime) / FLASH_MS);
  const scoreOff  = GW * 0.13;
  ctx.font        = `${fontSize}px "Press Start 2P", monospace`;
  ctx.textAlign   = 'center';
  ctx.textBaseline = 'top';

  const p1Flash = state.lastScorer === 'player' && flashPct > 0;
  const p2Flash = state.lastScorer === 'bot'    && flashPct > 0;
  ctx.fillStyle = p1Flash ? C_MARK : C_DIM;
  ctx.fillText(state.score.player, GW / 2 - scoreOff, 10);
  ctx.fillStyle = p2Flash ? C_MARK : C_DIM;
  ctx.fillText(state.score.bot, GW / 2 + scoreOff, 10);

  // Paletki — solid white, płaskie (zero efektów)
  ctx.fillStyle = C_MAIN;
  ctx.fillRect(28,               player.y - PAD_H / 2, PAD_W, PAD_H);
  ctx.fillRect(GW - 28 - PAD_W, ai.y     - PAD_H / 2, PAD_W, PAD_H);

  // Piłka — miga podczas resetDelay (wizualny sygnał "zaraz start"), solid po starcie
  if (state.resetDelay <= 0 || Math.floor(Date.now() / 100) % 2 === 0) {
    ctx.fillStyle = C_MAIN;
    ctx.fillRect(state.ball.x - BALL_R, state.ball.y - BALL_R, BALL_R * 2, BALL_R * 2);
  }
}

function showCard(overlay, canvas, card, header, footer) {
  const person      = PEOPLE[Math.floor(Math.random() * PEOPLE.length)];
  const quoteEl     = card.querySelector('.pong-quote');
  const identEl     = card.querySelector('.pong-identity');
  const nameEl      = card.querySelector('.pong-name');
  const yearsEl     = card.querySelector('.pong-years');
  const speedPanel  = document.getElementById('pong-speed');

  if (quoteEl)  quoteEl.textContent = '"' + person.quote + '"';
  if (nameEl)   nameEl.textContent  = person.name;
  if (yearsEl)  yearsEl.textContent = person.years;

  const fadeEls = [canvas];
  if (header)     fadeEls.push(header);
  if (footer)     fadeEls.push(footer);
  if (speedPanel) fadeEls.push(speedPanel);

  // Karta widoczna od razu — elementy wewnętrzne animowane osobno
  gsap.set(card,    { opacity: 1 });
  gsap.set(quoteEl, { opacity: 0 });
  gsap.set(identEl, { opacity: 0 });

  const tl = gsap.timeline({
    onComplete() {
      document.body.classList.remove('pong-active');
      gsap.to(navFX, { pageScale: 1, duration: 0.5, ease: 'power2.out' });
      // Mobile: sygnet wraca z głębi sceny do pozycji HOME
      if (isMobile()) gsap.to(navFX, { pageZ: 0, pageY: 0, duration: 0.5, ease: 'power2.out' });
      gsap.set([overlay, card, ...fadeEls], { opacity: 0 });
      gsap.set([quoteEl, identEl], { clearProps: 'opacity' });
      canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
      // Reset przycisków do stanu domyślnego
      if (speedPanel) {
        speedPanel.querySelectorAll('.speed-btn[data-mult]').forEach(b => {
          b.classList.toggle('active', b.dataset.mult === '1.0');
        });
        const pb = document.getElementById('pong-pause');
        if (pb) { pb.textContent = 'PAUSE'; pb.classList.remove('active'); }
      }
    },
  });

  tl.to(fadeEls, { opacity: 0, duration: 0.6, ease: 'power2.in'  }, 0)
    .to(quoteEl, { opacity: 1, duration: 0.8, ease: 'power2.out' }, 0.55)
    .to(identEl, { opacity: 1, duration: 0.6, ease: 'power2.out' }, 1.1)
    .to(card,    { opacity: 0, duration: 0.7, ease: 'power2.in'  }, 4.8)
    .to(overlay, { opacity: 0, duration: 0.5, ease: 'power2.out' }, 5.3);
}
