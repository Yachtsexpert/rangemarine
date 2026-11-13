// Считает стоимость ОДНОЙ УТВЕРЖДЁННОЙ секунды, включая все неудачные попытки.
// Запуск: node scripts/cost.mjs [production/cost-log.csv]
import { readFileSync } from "node:fs";

const file = process.argv[2] ?? "production/cost-log.csv";
const [head, ...rows] = readFileSync(file, "utf8").trim().split(/\r?\n/);
const cols = head.split(",");
const recs = rows.filter(Boolean).map((r) => {
  const v = r.split(",");
  return Object.fromEntries(cols.map((c, i) => [c, v[i] ?? ""]));
});

if (recs.length === 0) {
  console.log("Лог пуст: платных/лимитных генераций пока не было. Стоимость 0, делить не на что.");
  process.exit(0);
}

const num = (x) => (x === "" || Number.isNaN(Number(x)) ? null : Number(x));
const unknown = recs.filter((r) => num(r.credits_charged) === null && num(r.usd) === null);
const usd = recs.reduce((a, r) => a + (num(r.usd) ?? 0), 0);
const credits = {};
for (const r of recs) credits[r.tool] = (credits[r.tool] ?? 0) + (num(r.credits_charged) ?? 0);
const approvedSec = recs
  .filter((r) => r.status === "approved")
  .reduce((a, r) => a + (num(r.approved_seconds) ?? 0), 0);
const rejected = recs.filter((r) => r.status === "rejected").length;

console.log(`Попыток всего: ${recs.length} (отклонено: ${rejected})`);
console.log(`Деньги всего: $${usd.toFixed(4)}`);
console.log("Кредиты по сервисам (фактически списано):", credits);
console.log(`Утверждено секунд: ${approvedSec}`);
if (approvedSec > 0) {
  console.log(`Деньги на 1 утверждённую секунду: $${(usd / approvedSec).toFixed(4)}`);
  for (const [t, c] of Object.entries(credits)) {
    console.log(`Кредитов ${t} на 1 утверждённую секунду: ${(c / approvedSec).toFixed(2)}`);
  }
} else {
  console.log("Утверждённых секунд нет — показатель не определён.");
}
if (unknown.length) {
  console.log(`ВНИМАНИЕ: в ${unknown.length} строках нет ни credits_charged, ни usd — итог занижен. Требует проверки.`);
}
