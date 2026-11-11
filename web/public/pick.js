// Логика подбора ЖК. Чистые функции, без DOM: их же гоняет test/pick.test.mjs.

export const LIMITS = { budget: [1, 1000], area: [15, 300] }; // млн ₽, м²

const num = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 });

/** 21 960 000 → «21,96 млн ₽» */
export const fmtMln = (rub) => `${num.format(rub / 1e6)} млн ₽`;
/** 549 000 → «549 000 ₽/м²» */
export const fmtPerM2 = (rub) => `${num.format(rub)} ₽/м²`;

/** Возвращает { budget, area } с текстом подсказки для невалидного поля или null. */
export function validate(budgetM, area) {
  const check = (v, [lo, hi], unit) =>
    typeof v !== 'number' || !Number.isFinite(v) || v < lo || v > hi
      ? `Укажите число от ${num.format(lo)} до ${num.format(hi)} ${unit}`
      : null;
  return { budget: check(budgetM, LIMITS.budget, 'млн ₽'), area: check(area, LIMITS.area, 'м²') };
}

/** Оценка «от»: площадь × минимальная цена за м², до 10 000 ₽. */
export const estimate = (area, pricePerM2) => Math.round((area * pricePerM2) / 1e4) * 1e4;

/**
 * Три ЖК города: сначала самые дорогие из тех, что в бюджете,
 * затем — если их меньше трёх — ближайшие сверх бюджета.
 * При невалидном вводе возвращает { errors }, без исключений.
 */
export function pick(items, city, budgetM, area) {
  const errors = validate(budgetM, area);
  if (errors.budget || errors.area) return { errors };

  const budget = budgetM * 1e6;
  const all = items
    .filter((i) => i.city === city)
    .map((i) => ({ ...i, estimate: estimate(area, i.pricePerM2) }));
  const fits = all.filter((i) => i.estimate <= budget).sort((a, b) => b.estimate - a.estimate);
  const over = all
    .filter((i) => i.estimate > budget)
    .sort((a, b) => a.estimate - b.estimate)
    .slice(0, Math.max(0, 3 - fits.length))
    .map((i) => {
      let maxArea = Math.floor(budget / i.pricePerM2);
      while (maxArea > 0 && estimate(maxArea, i.pricePerM2) > budget) maxArea--;
      return {
        ...i,
        over: true,
        overPct: Math.round(((i.estimate - budget) * 100) / budget),
        extra: i.estimate - budget, // сколько добавить к бюджету
        maxArea: maxArea >= LIMITS.area[0] ? maxArea : null, // или до какой площади уменьшить
      };
    });

  return { results: [...fits.slice(0, 3), ...over], inBudget: Math.min(fits.length, 3), total: all.length };
}
