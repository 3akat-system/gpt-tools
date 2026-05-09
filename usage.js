/**
 * Просмотр расходов по OpenAI API
 * node usage.js
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadUsage } from './client.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const data = loadUsage();
const currentMonth = new Date().toISOString().slice(0, 7);
const months = Object.keys(data.months || {}).sort().reverse();

if (months.length === 0) {
  console.log('📊 Расходов пока нет.');
  process.exit(0);
}

console.log('📊 Расходы OpenAI API\n');
console.log('═'.repeat(50));

for (const month of months) {
  const m = data.months[month];
  const isCurrent = month === currentMonth;
  const label = isCurrent ? `${month} (текущий)` : month;
  const bar = '█'.repeat(Math.round((m.total_usd / 5) * 20));
  const pct = ((m.total_usd / 5) * 100).toFixed(1);

  console.log(`\n${label}: $${m.total_usd.toFixed(4)} из $5.00 (${pct}%)`);
  console.log(`[${bar.padEnd(20, '░')}]`);

  // Разбивка по моделям
  const byModel = {};
  for (const call of m.calls) {
    byModel[call.model] = (byModel[call.model] || 0) + call.cost_usd;
  }
  for (const [model, cost] of Object.entries(byModel).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${model.padEnd(30)} $${cost.toFixed(5)}`);
  }

  console.log(`  Всего вызовов: ${m.calls.length}`);
}

console.log('\n' + '═'.repeat(50));
const current = data.months[currentMonth];
if (current) {
  const remaining = 5.00 - current.total_usd;
  console.log(`\n💰 Остаток в этом месяце: $${remaining.toFixed(4)}`);
}
