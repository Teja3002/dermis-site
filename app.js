const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

// All demonstrations are browser-local illustrations, never device telemetry.
const header = $('#header');
const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 24);
addEventListener('scroll', onScroll, { passive: true }); onScroll();

const menuButton = $('.menu-toggle');
const mobileNav = $('#mobile-nav');
function closeMenu() {
  mobileNav.hidden = true;
  menuButton.setAttribute('aria-expanded', 'false');
  menuButton.setAttribute('aria-label', 'Open navigation');
  document.body.classList.remove('menu-open');
}
menuButton.addEventListener('click', () => {
  const opening = mobileNav.hidden;
  mobileNav.hidden = !opening;
  menuButton.setAttribute('aria-expanded', String(opening));
  menuButton.setAttribute('aria-label', opening ? 'Close navigation' : 'Open navigation');
  document.body.classList.toggle('menu-open', opening);
});
$$('.mobile-nav a').forEach(link => link.addEventListener('click', closeMenu));
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !mobileNav.hidden) { closeMenu(); menuButton.focus(); }
});
window.matchMedia('(min-width: 761px)').addEventListener('change', event => { if (event.matches) closeMenu(); });

const revealTargets = '.section-head, .layers-visual, .console, .use, .contact-copy, .contact-form';
if ('IntersectionObserver' in window && !reducedMotion.matches) {
  document.body.classList.add('motion-enabled');
  const revealObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add('visible'); revealObserver.unobserve(entry.target); }
    });
  }, { threshold: 0.12 });
  $$(revealTargets).forEach((element, index) => {
    element.classList.add('reveal');
    if (element.classList.contains('use')) element.style.transitionDelay = `${(index % 3) * 0.12}s`;
    revealObserver.observe(element);
  });
}

// Statement: words light up as the paragraph scrolls through the viewport.
const statement = $('#statement');
const words = statement.textContent.trim().split(/\s+/);
statement.innerHTML = words.map(word => `<span class="w${/^(Touch|contact|skin|Dermis)/.test(word) ? ' hot-word' : ''}">${word}</span>`).join(' ');
const wordSpans = $$('#statement .w');
function updateStatement() {
  const box = statement.getBoundingClientRect();
  const progress = reducedMotion.matches ? 1 : (innerHeight * 0.82 - box.top) / (box.height + innerHeight * 0.3);
  const lit = Math.round(Math.min(1, Math.max(0, progress)) * wordSpans.length);
  wordSpans.forEach((span, index) => {
    span.classList.toggle('on', index < lit);
    span.classList.toggle('hot', index < lit && span.classList.contains('hot-word'));
  });
}
addEventListener('scroll', updateStatement, { passive: true }); updateStatement();

const privacyDialog = $('#privacy-dialog');
$$('[data-open-privacy]').forEach(button => button.addEventListener('click', () => {
  privacyDialog.showModal(); document.body.classList.add('dialog-open');
}));
$('.dialog-close').addEventListener('click', () => privacyDialog.close());
privacyDialog.addEventListener('close', () => document.body.classList.remove('dialog-open'));
privacyDialog.addEventListener('click', event => {
  const box = privacyDialog.getBoundingClientRect();
  if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) privacyDialog.close();
});

$('#contact-form').addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity() || form.elements.website.value) return;
  const button = form.querySelector('[type="submit"]');
  const status = $('#form-status');
  button.disabled = true; button.textContent = 'Sending…';
  status.classList.remove('error'); status.textContent = '';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const data = Object.fromEntries(new FormData(form));
    delete data.website;
    const response = await fetch('https://formsubmit.co/ajax/hello@dermistouch.com', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ ...data, _subject: 'Dermis project inquiry', _captcha: 'false' }), signal: controller.signal
    });
    const result = await response.json();
    if (!response.ok || !(result.success === true || result.success === 'true')) throw new Error('Delivery not confirmed');
    form.reset(); status.textContent = 'Your inquiry has been sent. We’ll reply by email.';
  } catch {
    status.classList.add('error'); status.textContent = 'Delivery could not be confirmed. Your message is still here. You can email hello@dermistouch.com.';
  } finally {
    clearTimeout(timeout); button.disabled = false; button.innerHTML = 'Start a conversation <span aria-hidden="true">→</span>';
  }
});

// Keep links from the previous multi-page site useful on static/Netlify hosts.
const routeAliases = {
  '/product': 'product', '/technology': 'technology', '/durability': 'technology',
  '/developers': 'signal', '/pilots': 'contact', '/company': 'technology',
  '/contact': 'contact', '/privacy': 'privacy'
};
const requestedRoute = new URLSearchParams(location.search).get('route');
const alias = routeAliases[(requestedRoute ? requestedRoute.split(/[?#]/)[0] : location.pathname).replace(/\/$/, '')];
if (alias) {
  history.replaceState(null, '', alias === 'privacy' ? '/#privacy' : `/#${alias}`);
  if (alias === 'privacy') { privacyDialog.showModal(); document.body.classList.add('dialog-open'); }
  else requestAnimationFrame(() => document.getElementById(alias)?.scrollIntoView());
} else if (location.hash === '#developers' || location.hash === '#specifications') {
  const section = location.hash === '#developers' ? 'signal' : 'technology';
  history.replaceState(null, '', '/#' + section);
  requestAnimationFrame(() => document.getElementById(section).scrollIntoView());
} else if (location.hash === '#privacy') {
  privacyDialog.showModal(); document.body.classList.add('dialog-open');
}

$('#year').textContent = new Date().getFullYear();

// Hero: a wireframe tactile membrane that dents and ripples under contact.
const field = $('#field');
const fieldContext = field.getContext('2d');
const hero = $('.hero');
const ROWS = 44, COLS = 150, NEAR = 0.6, FAR = 6, X_SPAN = 4.2, CAMERA = 1;
const contacts = [];
const pointerContact = { x: 0, d: 2, strength: 0, target: 0 };
let fieldW = 0, fieldH = 0, fieldVisible = true, nextAutoContact = 0;
const rowDepth = Array.from({ length: ROWS }, (_, i) => NEAR * (FAR / NEAR) ** (i / (ROWS - 1)));
const horizon = () => fieldH * 0.46;
const scale = () => fieldH * 0.5;

function resizeField() {
  const ratio = Math.min(devicePixelRatio || 1, 1.5);
  fieldW = field.clientWidth; fieldH = field.clientHeight;
  field.width = Math.round(fieldW * ratio); field.height = Math.round(fieldH * ratio);
  fieldContext.setTransform(ratio, 0, 0, ratio, 0, 0);
  if (reducedMotion.matches) drawField(0);
}
function toWorld(clientX, clientY) {
  const box = field.getBoundingClientRect();
  const sy = clientY - box.top - horizon();
  if (sy < 8) return null;
  const d = CAMERA * scale() / sy;
  if (d < NEAR || d > FAR) return null;
  return { x: (clientX - box.left - fieldW / 2) * d / (fieldW * 0.62), d };
}
function addContact(x, d, strength) { contacts.push({ x, d, strength, born: performance.now() / 1000 }); if (contacts.length > 8) contacts.shift(); }

function displacement(x, d, now) {
  let y = 0, heat = 0;
  for (const c of contacts) {
    const age = now - c.born;
    const r = Math.hypot(x - c.x, (d - c.d) * 0.8);
    const envelope = Math.min(1, age * 5) * Math.exp(-age * 1.1);
    const press = c.strength * envelope * Math.exp(-(r * r) / 0.05);
    const front = Math.max(0, 1 - Math.abs(r - age * 0.9) * 3);
    y += -press * 0.16 + c.strength * 0.05 * Math.sin(r * 22 - age * 10) * front * Math.exp(-age * 0.8);
    heat += press;
  }
  if (pointerContact.strength > 0.01) {
    const r = Math.hypot(x - pointerContact.x, (d - pointerContact.d) * 0.8);
    const press = pointerContact.strength * Math.exp(-(r * r) / 0.07);
    y += -press * 0.14 + pointerContact.strength * 0.012 * Math.sin(r * 26 - now * 6) * Math.exp(-r * 2.5);
    heat += press;
  }
  return [y, heat];
}

const heatBuckets = [[], [], [], []];
function drawField(time) {
  const now = time / 1000;
  const ctx = fieldContext;
  ctx.clearRect(0, 0, fieldW, fieldH);
  heatBuckets.forEach(bucket => { bucket.length = 0; });
  const h = horizon(), k = scale(), xScale = fieldW * 0.62;
  for (let row = ROWS - 1; row >= 0; row--) {
    const d = rowDepth[row];
    const fade = 1 - row / ROWS;
    ctx.beginPath();
    let previous = null;
    for (let col = 0; col < COLS; col++) {
      const x = -X_SPAN + (2 * X_SPAN * col) / (COLS - 1);
      const [y, heat] = displacement(x, d, now);
      const sx = fieldW / 2 + (x * xScale) / d;
      const sy = h + ((CAMERA - y) * k) / d;
      if (col === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
      if (previous && heat > 0.06) heatBuckets[Math.min(3, Math.floor(heat * 4))].push(previous[0], previous[1], sx, sy);
      previous = [sx, sy];
    }
    ctx.strokeStyle = `rgba(89, 208, 255, ${0.08 + fade * 0.42})`;
    ctx.lineWidth = 0.7 + fade * 0.7;
    ctx.stroke();
  }
  heatBuckets.forEach((segments, level) => {
    if (!segments.length) return;
    ctx.beginPath();
    for (let i = 0; i < segments.length; i += 4) { ctx.moveTo(segments[i], segments[i + 1]); ctx.lineTo(segments[i + 2], segments[i + 3]); }
    ctx.strokeStyle = `rgba(255, ${150 - level * 25}, ${80 - level * 15}, ${0.35 + level * 0.2})`;
    ctx.lineWidth = 1.2 + level * 0.4;
    ctx.shadowColor = 'rgba(255, 90, 46, .8)'; ctx.shadowBlur = 6 + level * 4;
    ctx.stroke();
    ctx.shadowBlur = 0;
  });
}

const hudClock = $('#hud-clock');
const started = performance.now();
let lastHud = 0;
function animateField(time) {
  requestAnimationFrame(animateField);
  if (!fieldVisible || document.hidden) return;
  const now = time / 1000;
  if (now > nextAutoContact) {
    addContact((Math.random() - 0.5) * 3.2, 1.1 + Math.random() * 2.4, 0.55 + Math.random() * 0.45);
    nextAutoContact = now + 1.4 + Math.random() * 1.6;
  }
  while (contacts.length && now - contacts[0].born > 5) contacts.shift();
  pointerContact.strength += (pointerContact.target - pointerContact.strength) * 0.08;
  drawField(time);
  if (time - lastHud > 120) {
    lastHud = time;
    const seconds = Math.floor((time - started) / 1000);
    hudClock.textContent = `T+${[seconds / 3600, (seconds / 60) % 60, seconds % 60].map(v => String(Math.floor(v)).padStart(2, '0')).join(':')}`;
  }
}
new ResizeObserver(resizeField).observe(field);
resizeField();
if (reducedMotion.matches) {
  addContact(0.6, 2, 0.9); contacts[0].born = -0.5; drawField(0);
} else {
  new IntersectionObserver(entries => { fieldVisible = entries[0].isIntersecting; }).observe(hero);
  hero.addEventListener('pointermove', event => {
    const point = toWorld(event.clientX, event.clientY);
    if (!point) { pointerContact.target = 0; return; }
    pointerContact.x = point.x; pointerContact.d = point.d; pointerContact.target = 1;
  });
  hero.addEventListener('pointerleave', () => { pointerContact.target = 0; });
  hero.addEventListener('pointerdown', event => {
    const point = toWorld(event.clientX, event.clientY);
    if (point) addContact(point.x, point.d, 1.2);
  });
  requestAnimationFrame(animateField);
}

// Signal illustration: simulated force, shear, and grip traces.
const signalCanvas = $('#signal-chart');
const signalContext = signalCanvas.getContext('2d');
const contactInput = $('#contact-input');
let contact = Number(contactInput.value) / 100;
let filteredContact = contact;
let signalVisible = true;
let previousSignalTime = 0;
const samples = [];
const colors = ['#ff5a2e', '#59d0ff', '#c3a6ff'];
const readouts = ['force', 'shear', 'grip'].map(metric => $('#demo-' + metric));
function updateContact() {
  contact = Number(contactInput.value) / 100;
  $('#contact-level').textContent = `${contactInput.value}%`;
  contactInput.style.setProperty('--fill', `${contactInput.value}%`);
  $('#contact-pad').style.setProperty('--contact', String(Math.min(1, contact * 1.3)));
  if (reducedMotion.matches) {
    filteredContact = contact; samples.push([contact * 1.25, contact * .45, contact * 2.2]);
    if (samples.length > 160) samples.shift(); drawSignal(); updateReadouts(samples.at(-1));
  }
}
contactInput.addEventListener('input', updateContact);
function updateReadouts(values) {
  readouts.forEach((readout, index) => { readout.textContent = values[index].toFixed(2); });
}
function drawSignal() {
  if (!signalContext) return;
  const box = signalCanvas.getBoundingClientRect();
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, box.width), height = Math.max(1, box.height);
  if (signalCanvas.width !== Math.round(width * ratio) || signalCanvas.height !== Math.round(height * ratio)) {
    signalCanvas.width = Math.round(width * ratio); signalCanvas.height = Math.round(height * ratio);
  }
  const context = signalContext;
  context.setTransform(ratio, 0, 0, ratio, 0, 0); context.clearRect(0, 0, width, height);
  const left = 30, right = width - 3, top = 10, bottom = height - 9;
  const y = value => bottom - value / 2.5 * (bottom - top);
  context.font = '9px "JetBrains Mono", monospace'; context.fillStyle = '#5c636b'; context.lineWidth = 1;
  [0, .5, 1, 1.5, 2, 2.5].forEach(value => {
    context.strokeStyle = 'rgba(255,255,255,.07)'; context.beginPath(); context.moveTo(left, y(value)); context.lineTo(right, y(value)); context.stroke();
    context.fillText(value.toFixed(1), 0, y(value) + 3);
  });
  for (let index = 0; index <= 5; index++) {
    const x = left + index / 5 * (right - left);
    context.strokeStyle = 'rgba(255,255,255,.04)'; context.beginPath(); context.moveTo(x, top); context.lineTo(x, bottom); context.stroke();
  }
  colors.forEach((color, channel) => {
    context.strokeStyle = color; context.lineWidth = 1.6; context.shadowColor = color; context.shadowBlur = 8; context.beginPath();
    samples.forEach((sample, index) => {
      const x = left + (160 - samples.length + index) / 159 * (right - left);
      if (index === 0) context.moveTo(x, y(sample[channel])); else context.lineTo(x, y(sample[channel]));
    });
    context.stroke(); context.shadowBlur = 0;
  });
}
for (let index = 0; index < 160; index++) {
  const envelope = contact * (.65 + .35 * Math.sin(index / 35));
  samples.push([envelope * 1.25, envelope * .45, envelope * 2.2]);
}
updateReadouts(samples.at(-1)); updateContact();
new ResizeObserver(drawSignal).observe(signalCanvas);
new IntersectionObserver(entries => { signalVisible = entries[0].isIntersecting; }).observe($('.console'));
function animateSignal(time) {
  requestAnimationFrame(animateSignal);
  if (document.hidden || !signalVisible || reducedMotion.matches || time - previousSignalTime < 65) return;
  previousSignalTime = time;
  filteredContact += (contact - filteredContact) * .2;
  const wobble = Math.sin(time / 480) * .013 * filteredContact;
  const values = [filteredContact * 1.25 + wobble, filteredContact * .45 + wobble * .5, filteredContact * 2.2 + wobble];
  samples.push(values); if (samples.length > 160) samples.shift();
  updateReadouts(values); drawSignal();
}
requestAnimationFrame(animateSignal);
