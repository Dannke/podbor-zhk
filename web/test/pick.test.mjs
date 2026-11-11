// Запуск: node --test web/test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pick, fmtMln, fmtPerM2 } from '../public/pick.js';

const { items } = JSON.parse(readFileSync(new URL('../public/data.json', import.meta.url), 'utf8'));
const brief = (r) => r.results.map((i) => [i.name, i.estimate, i.overPct ?? null]);

test('1. Москва, 25 млн, 40 м² — три в бюджете, по убыванию', () => {
  const r = pick(items, 'Москва', 25, 40);
  assert.equal(r.inBudget, 3);
  assert.deepEqual(brief(r), [
    ['Событие', 21_960_000, null],
    ['Foriver (Форивер)', 20_410_000, null],
    ['Обручева 30', 20_390_000, null],
  ]);
});

test('2. Сочи, 15 млн, 40 м² — третьим Светский лес +2 %', () => {
  const r = pick(items, 'Сочи', 15, 40);
  assert.equal(r.inBudget, 2);
  assert.deepEqual(brief(r), [
    ['Лестория', 13_730_000, null],
    ['Кислород', 12_170_000, null],
    ['Светский лес', 15_270_000, 2],
  ]);
});

test('3. Новосибирск, 10 млн, 50 м² — третьим Flora&Fauna +6 %, премиум', () => {
  const r = pick(items, 'Новосибирск', 10, 50);
  assert.deepEqual(brief(r), [
    ['Unity Center', 9_800_000, null],
    ['Willart', 9_360_000, null],
    ['Эко-квартал Flora&Fauna', 10_550_000, 6],
  ]);
  assert.equal(r.results[2].class, 'премиум');
});

test('4. Москва, 5 млн, 40 м² — три самых дешёвых сверх бюджета с подсказкой', () => {
  const r = pick(items, 'Москва', 5, 40);
  assert.equal(r.inBudget, 0);
  assert.deepEqual(r.results.map((i) => i.name), ['Обручева 30', 'Foriver (Форивер)', 'Событие']);
  assert.ok(r.results.every((i) => i.over && i.overPct > 0 && i.extra > 0));
  assert.equal(r.results[0].extra, 15_390_000);
  assert.equal(r.results[0].maxArea, null); // 9 м² — меньше допустимых 15
});

test('5. Невалидный ввод — подсказки, без исключений', () => {
  assert.ok(pick(items, 'Москва', 25, 0).errors.area);
  assert.ok(pick(items, 'Москва', NaN, 40).errors.budget);
  assert.ok(pick(items, 'Москва', undefined, 40).errors.budget);
  assert.ok(pick(items, 'Москва', 1001, 40).errors.budget);
  assert.equal(pick(items, 'Москва', 25, 40).errors, undefined);
});

test('всегда ровно 3 результата', () => {
  for (const city of ['Москва', 'Сочи', 'Новосибирск'])
    for (const b of [1, 7, 30, 200, 1000])
      for (const a of [15, 47, 120, 300]) assert.equal(pick(items, city, b, a).results.length, 3);
});

test('подсказка площади держит оценку в бюджете', () => {
  const r = pick(items, 'Сочи', 15, 40);
  assert.equal(r.results[2].maxArea, 39); // 39 × 381 760 = 14,89 млн
});

test('форматы', () => {
  assert.equal(fmtMln(21_960_000), '21,96 млн ₽');
  assert.equal(fmtMln(29_000_000), '29 млн ₽');
  assert.equal(fmtPerM2(549_000), '549 000 ₽/м²');
});
