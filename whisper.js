/**
 * Whisper — транскрипция аудио в заметку Obsidian
 *
 * Использование:
 *   node whisper.js <путь_к_аудио> [--note] [--lang ru]
 *
 * Примеры:
 *   node whisper.js voice.mp3
 *   node whisper.js "C:\Users\admin00\Downloads\recording.m4a" --note
 *
 * --note : сохранить как заметку в Knowledge/raw/voice-YYYY-MM-DD-HH-MM.md
 * --lang : язык (по умолчанию ru)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { openai, trackUsage, checkBudget } from './client.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VAULT_ROOT = path.resolve(__dirname, '../../');

async function transcribe(audioPath, { saveNote = false, lang = 'ru' } = {}) {
  checkBudget();

  if (!fs.existsSync(audioPath)) {
    console.error(`Файл не найден: ${audioPath}`);
    process.exit(1);
  }

  const stat = fs.statSync(audioPath);
  const fileSizeMB = stat.size / 1024 / 1024;
  const estimatedMinutes = fileSizeMB / 1.5; // примерная оценка

  console.log(`🎙️ Транскрибирую: ${path.basename(audioPath)} (~${estimatedMinutes.toFixed(1)} мин)...`);

  const response = await openai.audio.transcriptions.create({
    file: fs.createReadStream(audioPath),
    model: 'gpt-4o-mini-transcribe',
    language: lang,
    response_format: 'verbose_json',
  });

  const text = response.text;
  const actualMinutes = response.duration ? response.duration / 60 : estimatedMinutes;
  const cost = trackUsage({ model: 'gpt-4o-mini-transcribe', minutes: actualMinutes });

  console.log(`✅ Готово (${actualMinutes.toFixed(1)} мин, ~$${cost.toFixed(4)})\n`);
  console.log('--- Текст ---');
  console.log(text);
  console.log('-------------');

  if (saveNote) {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 16).replace('T', '-').replace(':', '-');
    const notePath = path.join(VAULT_ROOT, 'Knowledge', 'raw', `voice-${dateStr}.md`);

    const noteContent = `---
type: voice-note
date: ${now.toISOString().slice(0, 10)}
source: ${path.basename(audioPath)}
tags: [voice, raw]
---

# Голосовая заметка ${now.toISOString().slice(0, 10)}

${text}
`;

    fs.mkdirSync(path.dirname(notePath), { recursive: true });
    fs.writeFileSync(notePath, noteContent, 'utf8');
    console.log(`\n📝 Заметка сохранена: Knowledge/raw/voice-${dateStr}.md`);
  }

  return text;
}

// CLI
const args = process.argv.slice(2);
const audioPath = args[0];
const saveNote = args.includes('--note');
const langIdx = args.indexOf('--lang');
const lang = langIdx !== -1 ? args[langIdx + 1] : 'ru';

if (!audioPath) {
  console.log('Использование: node whisper.js <аудио-файл> [--note] [--lang ru]');
  process.exit(0);
}

transcribe(audioPath, { saveNote, lang });
