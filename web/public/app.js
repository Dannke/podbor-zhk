import { pick, validate, fmtMln, fmtPerM2 } from './pick.js';

const $ = (id) => document.getElementById(id);
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const num = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 });
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const SQ = '<span class="sq">2</span>'; // ² у антиквы слишком крупный — рисуем сами
const CITIES = ['Москва', 'Сочи', 'Новосибирск'];
const IN = { Москва: 'в Москве', Сочи: 'в Сочи', Новосибирск: 'в Новосибирске' };
const VER = {
  ok: ['Сверено с застройщиком', '<circle cx="6" cy="6" r="5"/>'],
  partial: ['Сверено со вторым агрегатором', '<circle cx="6" cy="6" r="4.5" fill="none"/><path d="M6 1.5a4.5 4.5 0 0 0 0 9z"/>'],
  warn: ['Есть расхождение', '<path d="M6 1 11.5 11H.5z"/>'],
};

const state = { city: 'Москва', budget: 25, area: 40 };
let items = [];

/* ---------- анимация чисел: короткий твин, без него при reduced-motion ---------- */
function tween(key, from, to, ms, draw) {
  cancelAnimationFrame(tween[key]);
  if (reduced.matches || from === to) return draw(to);
  const t0 = performance.now();
  const step = (t) => {
    const k = Math.min(1, (t - t0) / ms);
    draw(from + (to - from) * (1 - (1 - k) ** 3));
    if (k < 1) tween[key] = requestAnimationFrame(step);
  };
  tween[key] = requestAnimationFrame(step);
}

/* ---------- бюджет: логарифмическая шкала 1–1000 млн ---------- */
const toBudget = (t) => {
  const b = 10 ** (t / 100);
  return b < 10 ? Math.round(b * 10) / 10 : b < 100 ? Math.round(b) : Math.round(b / 5) * 5;
};
const toT = (b) => Math.round(100 * Math.log10(b));
const parse = (s) => (String(s).trim() === '' ? NaN : Number(String(s).replace(/\s/g, '').replace(',', '.')));

/* ---------- план квартиры в масштабе ---------- */
const S = 18; // px на метр, равен шагу сетки
const CX = 258, CY = 181, RATIO = 1.6; // центр поля сетки
const m = (v) => num.format(Math.round(v * 10) / 10);

function drawPlan(area) {
  const wM = Math.sqrt(area * RATIO), hM = area / wM;
  const W = wM * S, H = hM * S, X0 = CX - W / 2, Y0 = CY - H / 2, x1 = X0 + W, y1 = Y0 + H;
  const p = [];
  // окна на верхней стене
  const wins = [];
  for (let i = 0, n = Math.max(1, Math.floor(wM / 4)); i < n; i++) {
    const cx = X0 + (W * (i + 0.5)) / n, half = Math.min(0.75 * S, W / n / 3);
    wins.push(`<line class="win" x1="${cx - half}" y1="${Y0}" x2="${cx + half}" y2="${Y0}"/>`,
      `<line class="win-l" x1="${cx - half}" y1="${Y0 - 1.5}" x2="${cx + half}" y2="${Y0 - 1.5}"/>`,
      `<line class="win-l" x1="${cx - half}" y1="${Y0 + 1.5}" x2="${cx + half}" y2="${Y0 + 1.5}"/>`);
  }
  p.push(`<rect class="wall" x="${X0}" y="${Y0}" width="${W}" height="${H}"/>`, ...wins);
  // санузел у входа
  const bw = Math.min(2.4, wM * 0.3) * S, bh = Math.min(2.2, hM * 0.42) * S, d = Math.min(0.8 * S, bw * 0.45);
  p.push(`<path class="part" d="M${X0 + bw},${y1} V${y1 - bh} H${X0 + bw - d - 4} M${X0 + 4},${y1 - bh} H${X0}"/>`,
    `<path class="door" d="M${X0 + 4},${y1 - bh} A${d},${d} 0 0 0 ${X0 + 4 + d},${y1 - bh + d}"/>`);
  // спальня и вторая спальня — когда площадь позволяет
  const vx = X0 + W * 0.58;
  if (area >= 32) {
    p.push(`<path class="part" d="M${vx},${Y0} V${y1 - 1.3 * S} M${vx},${y1 - 0.4 * S} V${y1}"/>`,
      `<path class="door" d="M${vx},${y1 - 1.3 * S} A${0.9 * S},${0.9 * S} 0 0 1 ${vx + 0.9 * S},${y1 - 0.4 * S}"/>`);
  }
  if (area >= 70) p.push(`<path class="part" d="M${vx},${Y0 + H * 0.5} H${x1 - 1.2 * S} M${x1 - 0.3 * S},${Y0 + H * 0.5} H${x1}"/>`);
  // размерные линии: верх и справа
  const ty = Y0 - 18, rx = x1 + 18, tk = 4;
  p.push(`<line class="ext" x1="${X0}" y1="${Y0 - 4}" x2="${X0}" y2="${ty - 6}"/><line class="ext" x1="${x1}" y1="${Y0 - 4}" x2="${x1}" y2="${ty - 6}"/>`,
    `<line class="dim" x1="${X0 - 6}" y1="${ty}" x2="${x1 + 6}" y2="${ty}"/>`,
    `<path class="dim" d="M${X0 - tk},${ty + tk}L${X0 + tk},${ty - tk}M${x1 - tk},${ty + tk}L${x1 + tk},${ty - tk}"/>`,
    `<text class="dim-t" x="${X0 + W / 2}" y="${ty - 6}" text-anchor="middle">${m(wM)} м</text>`,
    `<line class="ext" x1="${x1 + 4}" y1="${Y0}" x2="${rx + 6}" y2="${Y0}"/><line class="ext" x1="${x1 + 4}" y1="${y1}" x2="${rx + 6}" y2="${y1}"/>`,
    `<line class="dim" x1="${rx}" y1="${Y0 - 6}" x2="${rx}" y2="${y1 + 6}"/>`,
    `<path class="dim" d="M${rx - tk},${Y0 + tk}L${rx + tk},${Y0 - tk}M${rx - tk},${y1 + tk}L${rx + tk},${y1 - tk}"/>`,
    `<text class="dim-t" transform="translate(${rx + 7} ${Y0 + H / 2}) rotate(90)" text-anchor="middle">${m(hM)} м</text>`);
  // площадь в центре жилой зоны
  const fs = Math.max(17, Math.min(36, W / 3.4));
  const cx = area >= 32 ? X0 + (vx - X0) / 2 + bw * 0.15 : X0 + W / 2 + bw / 4;
  p.push(`<text class="area-t" x="${cx}" y="${Y0 + H * 0.42 + fs / 3}" text-anchor="middle" style="font-size:${fs}px">${Math.round(area)} м<tspan font-size="${fs * 0.42}" dy="${-fs * 0.42}">2</tspan></text>`);
  // масштабная линейка
  const sy = 352;
  p.push(`<rect class="scale-b" x="24" y="${sy}" width="${S}" height="4"/><rect class="scale-w" x="${24 + S}" y="${sy}" width="${S}" height="4"/><rect class="scale-b" x="${24 + 2 * S}" y="${sy}" width="${3 * S}" height="4"/>`,
    ...[[0, '0'], [1, '1'], [2, '2'], [5, '5 м']].map(([v, l]) => `<text class="scale-t" x="${24 + v * S}" y="${sy - 5}" text-anchor="${v ? 'middle' : 'start'}">${l}</text>`));
  $('plan-draw').innerHTML = p.join('');
}

/* ---------- карточки ---------- */
const host = (u) => {
  const parts = new URL(u).hostname.replace(/^www\./, '').split('.');
  return (parts.length > 2 && parts[0].length > 12 ? parts.slice(-2) : parts).join('.');
};
// оценки «от» — всегда два знака, чтобы 9,80 стояло в одном формате с 21,96
const num2 = new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const mln2 = (rub) => `${num2.format(rub / 1e6)} млн ₽`;
const priceHTML = (rub) => `<small>от</small> ${num2.format(rub / 1e6)}<small>&nbsp;млн&nbsp;₽</small>`;

function overHTML(i) {
  const pct = i.overPct >= 1 ? `на ${i.overPct} %` : 'менее чем на 1 %';
  const fix = i.maxArea
    ? `Добавьте к бюджету ${mln2(i.extra)} или уменьшите площадь до ${i.maxArea} м².`
    : `Добавьте к бюджету ${mln2(i.extra)} — даже 15 м² здесь в бюджет не помещаются.`;
  return `<strong>Выше бюджета ${pct}</strong>${fix}`;
}

function cardHTML(i, n) {
  const [verText, verIcon] = VER[i.verification];
  return `<li class="card${i.over ? ' is-over' : ''}" style="--i:${n}">
    <div class="card-top">
      <span class="rank label">${i.over ? 'Сверх бюджета' : `Вариант ${n + 1}`}</span>
      <span class="tag label${i.class === 'премиум' ? ' premium' : ''}">${esc(i.class[0].toUpperCase() + i.class.slice(1))}</span>
      ${i.isApartments ? '<span class="tag apart label">Апартаменты</span>' : ''}
    </div>
    <h3>${esc(i.name)}</h3>
    <p class="who">${esc(i.developer)} · ${esc(i.district)}</p>
    <div class="price">
      <span class="label">Стоимость ${num.format(state.area)}&nbsp;м²</span>
      <span class="price-v" data-v="${i.estimate}">${priceHTML(i.estimate)}</span>
    </div>
    ${i.over ? `<p class="over">${overHTML(i)}</p>` : ''}
    <dl class="spec">
      <dt>Цена за м²</dt><dd>от ${fmtPerM2(i.pricePerM2)}</dd>
      <dt>Сдача</dt><dd>${esc(i.delivery)}</dd>
    </dl>
    ${i.isApartments ? '<p class="apart-note">Продаются как апартаменты, а не квартиры.</p>' : ''}
    <span class="ver ver-${i.verification}"><svg viewBox="0 0 12 12" aria-hidden="true">${verIcon}</svg>${verText}</span>
    <details><summary>Что сверено</summary><p>${esc(i.note)}</p></details>
    <p class="links">
      <a href="${esc(i.sourceUrl)}" target="_blank" rel="noopener noreferrer">Источник <span>${esc(host(i.sourceUrl))} ↗</span></a>
      <a href="${esc(i.source2Url)}" target="_blank" rel="noopener noreferrer">Сверка <span>${esc(host(i.source2Url))} ↗</span></a>
    </p>
  </li>`;
}

let lastKey = '', liveTimer;
function renderResults() {
  const r = pick(items, state.city, state.budget, state.area);
  const cards = $('cards');
  const key = `${state.city}|${r.results.map((i) => i.name + !!i.over).join('|')}`;
  if (key !== lastKey) {
    cards.innerHTML = r.results.map(cardHTML).join('');
    cards.querySelectorAll('.card').forEach((c) => c.classList.add('enter'));
    lastKey = key;
    r.results.forEach((i, n) => countPrice(n, i.estimate * 0.88, i.estimate));
  } else {
    // те же ЖК — обновляем цифры на месте, раскрытые «Что сверено» не схлопываются
    cards.querySelectorAll('.card').forEach((c, n) => {
      const i = r.results[n];
      c.querySelector(".price .label").innerHTML = `Стоимость ${num.format(state.area)}&nbsp;м²`;
      if (i.over) c.querySelector('.over').innerHTML = overHTML(i);
      countPrice(n, Number(c.querySelector('.price-v').dataset.v), i.estimate);
    });
  }

  const head = r.inBudget === 3 ? 'все три в бюджете'
    : r.inBudget === 0 ? 'в бюджет не помещается ни один — показаны ближайшие'
    : `в бюджете ${r.inBudget} из ${r.total}, остальные — ближайшие сверх бюджета`;
  $('res-sum').innerHTML = `${num.format(state.area)} м${SQ} ${IN[state.city]} до ${fmtMln(state.budget * 1e6)}: ${head}`;

  clearTimeout(liveTimer);
  liveTimer = setTimeout(() => {
    $('live').textContent = `${$('res-sum').textContent.replace('м2', 'м²')}. ` +
      r.results.map((i) => `${i.name}, от ${mln2(i.estimate)}${i.over ? `, выше бюджета на ${Math.max(1, i.overPct)} %` : ''}`).join('; ');
  }, 600);
}

function countPrice(n, from, to) {
  const el = $('cards').children[n]?.querySelector('.price-v');
  if (!el) return;
  el.dataset.v = to;
  tween(`p${n}`, from, to, 380, (v) => { el.innerHTML = priceHTML(Math.round(v / 1e4) * 1e4); });
}

/* ---------- ввод ---------- */
let shownBudget = state.budget, shownArea = state.area;
function update(source) {
  const errs = validate(state.budget, state.area);
  for (const [f, def] of [['budget', 'От 1 до 1 000 млн ₽, например 25 или 12,5'], ['area', 'От 15 до 300 м²']]) {
    const hint = $(`${f}-hint`);
    hint.textContent = errs[f] ?? def;
    hint.classList.toggle('err', !!errs[f]);
    $(`${f}-num`).setAttribute('aria-invalid', String(!!errs[f]));
  }
  $('cards').classList.toggle('stale', !!(errs.budget || errs.area));
  if (errs.budget || errs.area) {
    clearTimeout(liveTimer);
    $('live').textContent = errs.budget ? `Бюджет: ${errs.budget}` : `Площадь: ${errs.area}`;
    return;
  }
  facadeArea(state.area);
  if (source !== 'budget-range') $('budget-range').value = toT(state.budget);
  if (source !== 'area-range') $('area-range').value = Math.round(state.area);
  if (source !== 'budget-num') $('budget-num').value = num.format(state.budget);
  if (source !== 'area-num') $('area-num').value = num.format(state.area);
  $('budget-range').setAttribute('aria-valuetext', fmtMln(state.budget * 1e6));
  $('area-range').setAttribute('aria-valuetext', `${num.format(state.area)} м²`);

  tween('b', shownBudget, state.budget, 320, (v) => { shownBudget = v; $('budget-out').innerHTML = `${num.format(Math.round(v * 100) / 100)} <span class="u">млн ₽</span>`; });
  tween('a', shownArea, state.area, 260, (v) => { shownArea = v; $('area-out').innerHTML = `${Math.round(v)} <span class="u">м${SQ}</span>`; drawPlan(v); });
  renderResults();
}

function setCity(city) {
  state.city = city;
  document.querySelectorAll('.skyline path').forEach((p) => p.classList.toggle('on', p.dataset.city === city));
  update('city');
}

/* ---------- движение страницы ---------- */
function motion() {
  if (reduced.matches || !('IntersectionObserver' in window)) return;
  // появление блоков при прокрутке; --d даёт лёгкий сдвиг соседям
  const groups = ['.cities', '.field', '.plan', '.res-head', '.stamp > div'];
  const io = new IntersectionObserver((es) => es.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }), { rootMargin: '0px 0px -8% 0px' });
  groups.forEach((sel) => document.querySelectorAll(sel).forEach((el, n) => {
    el.dataset.reveal = ''; el.style.setProperty('--d', n); io.observe(el);
  }));
  document.documentElement.classList.add('js-motion');

  // мягкая инерция колеса мыши; тачпад, клавиатура и тач остаются нативными
  if (!matchMedia('(pointer: fine)').matches) return;
  let target = scrollY, raf = 0;
  addEventListener('wheel', (e) => {
    // тачпады шлют мелкие дробные шаги — их не трогаем; ctrl+колесо — это зум
    if (e.ctrlKey || e.deltaX || (e.deltaMode === 0 && Math.abs(e.deltaY) < 40)) return;
    e.preventDefault();
    const max = document.documentElement.scrollHeight - innerHeight;
    target = Math.max(0, Math.min(max, (raf ? target : scrollY) + e.deltaY * (e.deltaMode === 1 ? 40 : 1)));
    if (!raf) raf = requestAnimationFrame(function step() {
      const from = scrollY;
      const y = from + (target - from) * 0.14;
      scrollTo({ top: y, behavior: 'instant' });
      // стоп у цели или если страница больше не двигается (край, дробные пиксели) — иначе цикл держит скролл
      raf = Math.abs(target - y) < 1 || Math.abs(scrollY - from) < 0.5 ? 0 : requestAnimationFrame(step);
    });
  }, { passive: false });
  // клавиши, клик по полосе прокрутки и т. п. перехватывают управление у инерции
  const stop = () => { cancelAnimationFrame(raf); raf = 0; };
  addEventListener('keydown', stop);
  addEventListener('pointerdown', stop);
}

/* ---------- тема: по системе, пока не выбрали кнопкой; выбор помнит браузер ---------- */
function themeToggle() {
  const root = document.documentElement, btn = $('theme'), sys = matchMedia('(prefers-color-scheme: dark)');
  const dark = () => (root.dataset.theme ?? (sys.matches ? 'dark' : 'light')) === 'dark';
  const paint = () => { btn.lastElementChild.textContent = dark() ? 'Светлая тема' : 'Тёмная тема'; };
  const apply = () => {
    root.dataset.theme = dark() ? 'light' : 'dark';
    try { localStorage.setItem('theme', root.dataset.theme); } catch {}
    paint();
  };
  btn.addEventListener('click', () => {
    if (!document.startViewTransition || reduced.matches) return apply();
    // новая тема раскрывается кругом от кнопки (View Transitions; без поддержки — мгновенно)
    const r = btn.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    root.style.setProperty('--vt-x', `${x}px`);
    root.style.setProperty('--vt-y', `${y}px`);
    root.style.setProperty('--vt-r', `${Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y))}px`);
    document.startViewTransition(apply);
  });
  sys.addEventListener('change', paint);
  paint();
}
themeToggle();

/* ---------- фасад: квартира растёт с площадью, этаж выбирается кликом ---------- */
const FA = { G: 360, L: 120, R: 330, WR: 390, LOBBY: 30, FL: 22, N: 12, BW: 35 };
const fa = { f: 8, bays: 2, area: 40, shownF: 0, shownB: 2, ready: false };
const floorTop = (f) => FA.G - FA.LOBBY - FA.FL * (f + 1); // f = 0 — первый типовой, то есть 2-й этаж
const bayEnd = 5; // правый край квартиры — ось 6

function drawUnit(fy, bays) {
  fa.shownF = fy; fa.shownB = bays;
  const x = FA.L + Math.max(0, bayEnd - bays) * FA.BW, w = bays * FA.BW, y = floorTop(fy);
  const unit = document.querySelector('.fa-unit');
  unit.setAttribute('x', x); unit.setAttribute('y', y); unit.setAttribute('width', w);
  const ux = x + w, uy = y + FA.FL / 2;
  document.querySelector('.fa-lead').setAttribute('d', `M${ux},${uy}L${FA.WR - 14},99H${FA.WR + 20}`);
  const dot = document.querySelector('.fa-dot');
  dot.setAttribute('cx', ux); dot.setAttribute('cy', uy);
  // окна загораются на том этаже, мимо которого «едет» квартира
  const f = Math.round(fy), b = Math.round(bays), s = Math.max(0, bayEnd - b);
  fa.wins.forEach((win) => win.el.classList.toggle('on', win.f === f && win.b >= s && win.b < s + b));
}

function moveUnit() {
  const f0 = fa.shownF, b0 = fa.shownB, f1 = fa.f, b1 = fa.bays;
  document.querySelector('.fa-call').textContent = `Квартира ${num.format(fa.area)} м² · ${f1 + 2} этаж`;
  tween('fa', 0, 1, 260 + 30 * Math.abs(f1 - f0), (k) => drawUnit(f0 + (f1 - f0) * k, b0 + (b1 - b0) * k));
}

function facadeArea(area) {
  fa.area = area;
  fa.bays = Math.min(6, Math.max(1, Math.ceil(area / 25))); // ponytail: ~25 м² на окно фасада — условно, для иллюстрации
  if (fa.ready) moveUnit();
}

function facadeInit() {
  const svg = $('facade-svg'), fig = svg.closest('.facade');
  fa.wins = [...svg.querySelectorAll('.fa-win')].map((el) => ({
    el, b: Math.round((+el.getAttribute('x') - FA.L - 7) / FA.BW),
    f: Math.round((FA.G - FA.LOBBY - 5 - +el.getAttribute('y')) / FA.FL) - 1,
  })).filter((w) => w.f >= 0 && w.b >= 0 && w.b < 6);
  svg.insertAdjacentHTML('beforeend',
    `<rect class="fa-hover" x="${FA.L}" y="0" width="${FA.R - FA.L}" height="${FA.FL}"/>` +
    `<g class="fa-hmark"><line x1="54" y1="0" x2="${FA.L - 6}" y2="0"/><path d="M62,0l-5,-6h10z"/><text x="70" y="-4"></text></g>`);
  const hover = svg.querySelector('.fa-hover'), mark = svg.querySelector('.fa-hmark');
  const floorAt = (e) => {
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM().inverse());
    const f = Math.floor((FA.G - FA.LOBBY - p.y) / FA.FL);
    return p.x >= FA.L && p.x <= FA.R && f >= 0 && f < FA.N ? f : null;
  };
  svg.addEventListener('pointermove', (e) => {
    const f = floorAt(e);
    fig.classList.toggle('hovering', f !== null);
    if (f === null) return;
    hover.style.transform = `translateY(${floorTop(f)}px)`;
    mark.style.transform = `translateY(${floorTop(f) + FA.FL}px)`;
    mark.querySelector('text').textContent = `+${(4.5 + 3 * f).toFixed(3).replace('.', ',')} · ${f + 2} этаж`;
  });
  svg.addEventListener('pointerleave', () => fig.classList.remove('hovering'));
  svg.addEventListener('click', (e) => {
    const f = floorAt(e);
    if (f !== null && f !== fa.f) { fa.f = f; moveUnit(); }
  });
  // при загрузке квартира «поднимается на лифте» на свой этаж, когда дом дорисован (~1,35 с)
  drawUnit(0, fa.bays);
  setTimeout(() => { fa.ready = true; moveUnit(); }, reduced.matches ? 0 : 1450);
}

function init(data) {
  items = data.items;
  $('date').textContent = $('date2').textContent = data.date;
  $('cities').innerHTML = CITIES.map((c) => {
    const list = items.filter((i) => i.city === c);
    const min = Math.min(...list.map((i) => i.pricePerM2));
    return `<label class="city"><input type="radio" name="city" value="${c}"${c === state.city ? ' checked' : ''}>
      <span class="city-name">${c}</span>
      <span class="city-meta label">${list.length} ЖК · от ${Math.round(min / 1000)} тыс. ₽/м²</span></label>`;
  }).join('');
  $('cities').addEventListener('change', (e) => setCity(e.target.value));

  $('budget-range').addEventListener('input', (e) => { state.budget = toBudget(+e.target.value); update('budget-range'); });
  $('area-range').addEventListener('input', (e) => { state.area = +e.target.value; update('area-range'); });
  $('budget-num').addEventListener('input', (e) => { state.budget = parse(e.target.value); update('budget-num'); });
  $('area-num').addEventListener('input', (e) => { state.area = parse(e.target.value); update('area-num'); });

  facadeInit();
  drawPlan(state.area);
  setCity(state.city);
  motion();
}

fetch('data.json')
  .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.status))))
  .then(init)
  .catch(() => { $('res-sum').textContent = 'Не удалось загрузить данные. Обновите страницу.'; });
