/**
 * DALL-E 3 — генерация изображений
 *
 * Использование:
 *   node dalle.js "описание на русском или английском"
 *   node dalle.js "баннер для Upwork профиля разработчика ботов" --size landscape
 *
 * --size: square (1024×1024) | landscape (1792×1024) | portrait (1024×1792)
 * --quality: standard | hd (hd = 2x цена)
 * --out: путь для сохранения (по умолчанию Knowledge/artifacts/image-ДАТА.png)
 */
import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';
import { openai, trackUsage, checkBudget } from './client.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VAULT_ROOT = path.resolve(__dirname, '../../');

const SIZE_MAP = {
  square:    '1024x1024',
  landscape: '1792x1024',
  portrait:  '1024x1792',
};

function downloadImage(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (res) => {
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', reject);
  });
}

async function generate(prompt, { size = 'landscape', quality = 'standard', outPath } = {}) {
  checkBudget();

  const sizeStr = SIZE_MAP[size] || SIZE_MAP.landscape;
  console.log(`🎨 Генерирую (${sizeStr}, ${quality})...`);
  console.log(`   Промпт: "${prompt}"`);

  const response = await openai.images.generate({
    model: 'dall-e-3',
    prompt,
    size: sizeStr,
    quality,
    n: 1,
    response_format: 'url',
  });

  const imageUrl = response.data[0].url;
  const revisedPrompt = response.data[0].revised_prompt;

  const cost = trackUsage({ model: 'dall-e-3', images: 1 });
  console.log(`✅ Готово ($${cost.toFixed(3)})`);

  if (revisedPrompt && revisedPrompt !== prompt) {
    console.log(`\n📝 DALL-E уточнил промпт: ${revisedPrompt}`);
  }

  // Сохранить файл
  const dateStr = new Date().toISOString().slice(0, 16).replace('T', '-').replace(':', '-');
  const defaultPath = path.join(VAULT_ROOT, 'Knowledge', 'artifacts', `image-${dateStr}.png`);
  const savePath = outPath || defaultPath;

  fs.mkdirSync(path.dirname(savePath), { recursive: true });
  await downloadImage(imageUrl, savePath);

  const relPath = path.relative(VAULT_ROOT, savePath).replace(/\\/g, '/');
  console.log(`\n🖼️  Сохранено: ${relPath}`);
  console.log(`   Вставить в заметку: ![[${relPath}]]`);

  return savePath;
}

// CLI
const args = process.argv.slice(2);
const prompt = args.find(a => !a.startsWith('--'));

if (!prompt) {
  console.log(`Использование:
  node dalle.js "баннер для профиля разработчика Telegram ботов"
  node dalle.js "схема архитектуры staff бота" --size square
  node dalle.js "промпт" --size portrait --quality hd`);
  process.exit(0);
}

const sizeIdx = args.indexOf('--size');
const qualityIdx = args.indexOf('--quality');
const outIdx = args.indexOf('--out');

generate(prompt, {
  size:    sizeIdx    !== -1 ? args[sizeIdx + 1]    : 'landscape',
  quality: qualityIdx !== -1 ? args[qualityIdx + 1] : 'standard',
  outPath: outIdx     !== -1 ? args[outIdx + 1]     : undefined,
});
