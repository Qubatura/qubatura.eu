// pong.js — easter egg "Chwila relaksu". Klasyczny Pong, styl Atari 1972.
// Gra do 3 punktów. Gracz (lewa/mysz lub W·S·↑↓) vs Bot (prawa/AI).
// Po 3. pkt: fade-out, karta z postacią historyczną nad polem, powrót do HOME.

import * as GSAPmod from 'gsap';
import { navFX } from './tint.js';

const gsap = GSAPmod.gsap || GSAPmod.default || GSAPmod;

const PEOPLE = [
  { name: 'Nikola Tesla',       years: '1856–1943' },
  { name: 'Albert Einstein',    years: '1879–1955' },
  { name: 'Alan Turing',        years: '1912–1954' },
  { name: 'Steve Jobs',         years: '1955–2011' },
  { name: 'Marie Curie',        years: '1867–1934' },
  { name: 'David Bowie',        years: '1947–2016' },
  { name: 'John Coltrane',      years: '1926–1967' },
  { name: 'Richard Feynman',    years: '1918–1988' },
  { name: 'Ada Lovelace',       years: '1815–1852' },
  { name: 'Leonardo da Vinci',  years: '1452–1519' },
  { name: 'Carl Sagan',         years: '1934–1996' },
  { name: 'Grace Hopper',       years: '1906–1992' },
];

const WIN_SCORE = 3;
const PAD_W     = 6;
const AI_SPD    = 2.8;
const K_SPD     = 5;
const BALL_SPD  = 4.5;
const FLASH_MS  = 650;

export function initPong() {
  const btn = document.getElementById('nav-pong');
  if (!btn) return;
  btn.addEventListener('click', e => { e.preventDefault(); startGame(); });
}

function getArea() {
  const W  = window.innerWidth;
  const H  = window.innerHeight;
  const gt = 58;
  const gb = H * 0.5 - 90 - 68;
  const GH = Math.max(100, gb - gt);
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

  const { GW, GH, GT, GL } = getArea();
  const PAD_H  = Math.round(GH / 5);
  const BALL_R = Math.max(4, Math.round(GW * 0.016));

  // Canvas = pole gry
  canvas.width  = GW;
  canvas.height = GH;
  canvas.style.top  = GT + 'px';
  canvas.style.left = GL + 'px';
  gsap.set(canvas, { opacity: 1 });

  // Nagłówek Q-PONG powyżej pola
  if (header) {
    header.style.top   = (GT - 30) + 'px';
    header.style.left  = GL + 'px';
    header.style.width = GW + 'px';
    gsap.set(header, { opacity: 1 });
  }

  // Stopka z retro instrukcją poniżej pola
  if (footer) {
    footer.style.top   = (GT + GH + 8) + 'px';
    footer.style.left  = GL + 'px';
    footer.style.width = GW + 'px';
    gsap.set(footer, { opacity: 1 });
  }

  // Karta pojawia się NAD polem gry (nie na środku ekranu)
  card.style.top    = GT + 'px';
  card.style.left   = GL + 'px';
  card.style.width  = GW + 'px';
  card.style.height = GH + 'px';

  const ctx    = canvas.getContext('2d');
  const player = { y: GH / 2 };
  const ai     = { y: GH / 2 };
  const state  = {
    score:      { player: 0, bot: 0 },
    ball:       makeBall(GW, GH),
    flashTime:  0,
    lastScorer: null,
    resetDelay: 0,   // klatki pauzy po golu zanim piłka ruszy
  };

  let mouseY = GH / 2;
  const keys  = {};
  const onMove = e => { mouseY = e.clientY - GT; };
  const onKey  = e => { keys[e.key] = e.type === 'keydown'; };
  window.addEventListener('mousemove', onMove);
  window.addEventListener('keydown',   onKey);
  window.addEventListener('keyup',     onKey);

  document.body.classList.add('pong-active');
  gsap.to(overlay, { opacity: 1, duration: 0.4, ease: 'power2.out' });

  let raf, done = false;

  function cleanup() {
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('keydown',   onKey);
    window.removeEventListener('keyup',     onKey);
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
      // Chwila z końcowym wynikiem przed kartą
      setTimeout(() => showCard(overlay, canvas, card, header, footer), 900);
    } else {
      // Reset piłki na środek, pauza ~1s
      state.ball = makeBall(GW, GH);
      state.resetDelay = 55;
    }
  }

  function loop() {
    if (done) return;
    raf = requestAnimationFrame(loop);

    // Pauza po golu — piłka widoczna w centrum, paletki aktywne
    if (state.resetDelay > 0) {
      state.resetDelay--;
      draw(ctx, GW, GH, player, ai, state, PAD_H, BALL_R);
      return;
    }

    // Gracz — klawiatura ma priorytet nad myszą
    if      (keys['ArrowUp']   || keys['w'] || keys['W']) player.y -= K_SPD;
    else if (keys['ArrowDown'] || keys['s'] || keys['S']) player.y += K_SPD;
    else player.y += (mouseY - player.y) * 0.15;
    player.y = Math.max(PAD_H / 2, Math.min(GH - PAD_H / 2, player.y));

    // Bot — śledzi piłkę z małym opóźnieniem (można pokonać)
    const d = state.ball.y - ai.y;
    ai.y += Math.sign(d) * Math.min(Math.abs(d) * 0.06, AI_SPD);
    ai.y  = Math.max(PAD_H / 2, Math.min(GH - PAD_H / 2, ai.y));

    const b = state.ball;
    b.x += b.vx;
    b.y += b.vy;

    // Odbicia od ścian magenta (góra/dół)
    if (b.y - BALL_R < 2)      { b.y = 2 + BALL_R;      b.vy =  Math.abs(b.vy); }
    if (b.y + BALL_R > GH - 2) { b.y = GH - 2 - BALL_R; b.vy = -Math.abs(b.vy); }

    // Lewa paletka (gracz)
    const lpR = 28 + PAD_W;
    if (b.vx < 0 && b.x - BALL_R <= lpR && b.x > 28 &&
        b.y > player.y - PAD_H / 2 && b.y < player.y + PAD_H / 2) {
      b.x = lpR + BALL_R;
      reflect(b, player.y, 1, PAD_H);
    }

    // Prawa paletka (bot)
    const rpL = GW - 28 - PAD_W;
    if (b.vx > 0 && b.x + BALL_R >= rpL && b.x < GW - 28 &&
        b.y > ai.y - PAD_H / 2 && b.y < ai.y + PAD_H / 2) {
      b.x = rpL - BALL_R;
      reflect(b, ai.y, -1, PAD_H);
    }

    // Gole
    if      (b.x < -BALL_R * 2)       scoreGoal('bot');
    else if (b.x > GW + BALL_R * 2)   scoreGoal('player');

    if (!done) draw(ctx, GW, GH, player, ai, state, PAD_H, BALL_R);
  }

  loop();
}

function makeBall(GW, GH) {
  const angle = (Math.random() * 0.5 - 0.25) * Math.PI;
  const dir   = Math.random() > 0.5 ? 1 : -1;
  return { x: GW / 2, y: GH / 2,
           vx: Math.cos(angle) * BALL_SPD * dir,
           vy: Math.sin(angle) * BALL_SPD };
}

function reflect(ball, padY, dir, PAD_H) {
  const rel = (ball.y - padY) / (PAD_H / 2);
  const ang = rel * (Math.PI * 0.32);
  const spd = Math.min(Math.hypot(ball.vx, ball.vy) * 1.04, 11);
  ball.vx   = dir * Math.cos(ang) * spd;
  ball.vy   = Math.sin(ang) * spd;
}

function draw(ctx, GW, GH, player, ai, state, PAD_H, BALL_R) {
  ctx.clearRect(0, 0, GW, GH);

  // Krawędzie boiska — magenta (hierarchia: najważniejszy kolor pola)
  ctx.fillStyle = '#E0218A';
  ctx.fillRect(0, 0,      GW, 2);
  ctx.fillRect(0, GH - 2, GW, 2);

  // Linia środkowa — szara, niska intensywność
  ctx.save();
  ctx.setLineDash([6, 10]);
  ctx.strokeStyle = 'rgba(255,255,255,0.27)';
  ctx.lineWidth   = 1;
  ctx.beginPath(); ctx.moveTo(GW / 2, 2); ctx.lineTo(GW / 2, GH - 2);
  ctx.stroke();
  ctx.restore();

  // Tablica wyników — retro Space Mono, obie strony linii środkowej
  const fontSize   = Math.round(GH * 0.10);
  const flashPct   = Math.max(0, 1 - (Date.now() - state.flashTime) / FLASH_MS);
  const scoreOff   = GW * 0.11;
  ctx.font         = `700 ${fontSize}px "Space Mono", monospace`;
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'top';

  const p1Flash = state.lastScorer === 'player' && flashPct > 0;
  const p2Flash = state.lastScorer === 'bot'    && flashPct > 0;
  ctx.fillStyle = p1Flash
    ? `rgba(224,33,138,${0.65 + flashPct * 0.35})`
    : 'rgba(255,255,255,0.58)';
  ctx.fillText(state.score.player, GW / 2 - scoreOff, 10);
  ctx.fillStyle = p2Flash
    ? `rgba(224,33,138,${0.65 + flashPct * 0.35})`
    : 'rgba(255,255,255,0.58)';
  ctx.fillText(state.score.bot, GW / 2 + scoreOff, 10);

  // Paletki — białe, szklane (wąski stroke + subtelny fill)
  drawPad(ctx, 28,               player.y, PAD_H);
  drawPad(ctx, GW - 28 - PAD_W, ai.y,     PAD_H);

  // Piłka — solid white, najbardziej widoczny element
  ctx.save();
  ctx.shadowBlur  = 18;
  ctx.shadowColor = 'rgba(255,255,255,0.9)';
  ctx.fillStyle   = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(state.ball.x, state.ball.y, BALL_R, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawPad(ctx, x, cy, PAD_H) {
  const y = cy - PAD_H / 2;
  ctx.save();
  ctx.shadowBlur  = 10;
  ctx.shadowColor = 'rgba(255,255,255,0.35)';
  ctx.fillStyle   = 'rgba(255,255,255,0.11)';
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth   = 1;
  ctx.fillRect(x, y, PAD_W, PAD_H);
  ctx.strokeRect(x, y, PAD_W, PAD_H);
  ctx.restore();
}

function showCard(overlay, canvas, card, header, footer) {
  const person = PEOPLE[Math.floor(Math.random() * PEOPLE.length)];
  card.querySelector('.pong-name').textContent  = person.name;
  card.querySelector('.pong-years').textContent = person.years;

  const fadeEls = [canvas];
  if (header) fadeEls.push(header);
  if (footer) fadeEls.push(footer);

  const tl = gsap.timeline({
    onComplete() {
      document.body.classList.remove('pong-active');
      gsap.to(navFX, { pageScale: 1, duration: 0.5, ease: 'power2.out' });
      gsap.set([overlay, card, ...fadeEls], { opacity: 0 });
      canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    },
  });

  tl.to(fadeEls,  { opacity: 0, duration: 0.6, ease: 'power2.in'  }, 0)
    .to(card,     { opacity: 1, duration: 0.8, ease: 'power2.out' }, 0.5)
    .to(card,     { opacity: 0, duration: 0.7, ease: 'power2.in'  }, 4.8)
    .to(overlay,  { opacity: 0, duration: 0.5, ease: 'power2.out' }, 5.3);
}
