/**
 * Общий клиент OpenAI + трекер расходов
 * Читает OPENAI_API_KEY из переменных среды Windows
 */
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Загрузить .env если переменная не задана системно
if (!process.env.OPENAI_API_KEY) {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const [key, ...val] = line.split('=');
      if (key && val.length) process.env[key.trim()] = val.join('=').trim();
    }
  }
}
const USAGE_FILE = path.join(__dirname, 'usage.json');
const BUDGET_LIMIT = 4.50; // предупреждение при $4.50 из $5

// Стоимость за 1M токенов / за минуту
const PRICING = {
  'gpt-4o-mini':              { input: 0.15,  output: 0.60  },
  'gpt-4o':                   { input: 5.00,  output: 15.00 },
  'text-embedding-3-small':   { input: 0.02,  output: 0     },
  'whisper-1':                { perMinute: 0.006             },
  'gpt-4o-mini-transcribe':   { perMinute: 0.003             },
  'dall-e-3':                 { perImage: 0.040              },
};

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Загрузить статистику за текущий месяц
export function loadUsage() {
  if (!fs.existsSync(USAGE_FILE)) return { months: {} };
  return JSON.parse(fs.readFileSync(USAGE_FILE, 'utf8'));
}

// Сохранить запись о расходе
export function trackUsage({ model, inputTokens = 0, outputTokens = 0, minutes = 0, images = 0 }) {
  const data = loadUsage();
  const month = new Date().toISOString().slice(0, 7); // "2026-04"

  if (!data.months[month]) data.months[month] = { total_usd: 0, calls: [] };

  const p = PRICING[model] || {};
  let cost = 0;
  if (p.input)     cost += (inputTokens  / 1_000_000) * p.input;
  if (p.output)    cost += (outputTokens / 1_000_000) * p.output;
  if (p.perMinute) cost += minutes * p.perMinute;
  if (p.perImage)  cost += images  * p.perImage;

  data.months[month].total_usd += cost;
  data.months[month].calls.push({
    ts: new Date().toISOString(),
    model,
    inputTokens,
    outputTokens,
    minutes,
    images,
    cost_usd: +cost.toFixed(6),
  });

  fs.writeFileSync(USAGE_FILE, JSON.stringify(data, null, 2));

  const total = data.months[month].total_usd;
  if (total >= BUDGET_LIMIT) {
    console.warn(`\n⚠️  ВНИМАНИЕ: Расход за ${month} = $${total.toFixed(3)} из $5 лимита!\n`);
  }

  return cost;
}

// Проверить: не превышен ли лимит
export function checkBudget() {
  const data = loadUsage();
  const month = new Date().toISOString().slice(0, 7);
  const total = data.months?.[month]?.total_usd || 0;
  if (total >= 5.00) {
    console.error(`❌ Месячный лимит $5.00 исчерпан ($${total.toFixed(3)}). Запрос отменён.`);
    process.exit(1);
  }
  return total;
}
