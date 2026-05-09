/**
 * Extract — извлечение структурированных данных из текста → заметка в Clients/
 *
 * Использование:
 *   node extract.js --text "Текст сообщения клиента..."
 *   node extract.js --file message.txt
 *   echo "текст" | node extract.js --stdin
 *
 * Создаёт/обновляет заметку в Clients/ автоматически
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { openai, trackUsage, checkBudget } from './client.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VAULT_ROOT = path.resolve(__dirname, '../../');

const SYSTEM_PROMPT = `Ты — CRM-ассистент. Извлеки из сообщения клиента структурированные данные.
Отвечай ТОЛЬКО валидным JSON без markdown блоков.
Если поле не указано — пустая строка.
Используй русский язык.`;

const JSON_SCHEMA = {
  type: 'object',
  properties: {
    client_name:   { type: 'string', description: 'Имя клиента или название компании' },
    niche:         { type: 'string', description: 'Сфера бизнеса (автосервис, недвижимость, клининг...)' },
    pain:          { type: 'string', description: 'Главная боль/проблема — своими словами клиента' },
    task:          { type: 'string', description: 'Конкретная задача которую хочет решить' },
    budget:        { type: 'string', description: 'Бюджет если упомянут' },
    deadline:      { type: 'string', description: 'Сроки если упомянуты' },
    contact:       { type: 'string', description: 'Контакт: имя, Telegram, телефон' },
    source:        { type: 'string', description: 'Откуда пришёл: Upwork, Telegram, рекомендация...' },
    priority:      { type: 'string', enum: ['high', 'medium', 'low'], description: 'Приоритет по ощущениям' },
    notes:         { type: 'string', description: 'Другие важные детали' },
  },
  required: ['client_name', 'pain', 'task', 'priority'],
};

async function extract(text) {
  checkBudget();

  console.log('🔍 Извлекаю данные...');

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0,
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'crm_extract',
        strict: true,
        schema: JSON_SCHEMA,
      },
    },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user',   content: text },
    ],
  });

  const usage = response.usage;
  const cost = trackUsage({
    model: 'gpt-4o-mini',
    inputTokens: usage.prompt_tokens,
    outputTokens: usage.completion_tokens,
  });

  const data = JSON.parse(response.choices[0].message.content);

  console.log(`✅ Готово (~$${cost.toFixed(5)})`);
  console.log('\n--- Извлечено ---');
  console.log(JSON.stringify(data, null, 2));

  // Создать заметку в Clients/
  if (data.client_name) {
    const slug = data.client_name
      .toLowerCase()
      .replace(/[^a-zа-яё0-9]+/gi, '-')
      .replace(/^-+|-+$/g, '');

    const notePath = path.join(VAULT_ROOT, 'Clients', `${slug}.md`);
    const today = new Date().toISOString().slice(0, 10);

    // Если файл уже есть — добавляем в историю, не перезаписываем
    if (fs.existsSync(notePath)) {
      const existing = fs.readFileSync(notePath, 'utf8');
      const update = `\n| ${today} | Обновлены данные (auto-extract) | Обработать |\n`;
      const updated = existing.replace(
        '| --- | --- | --- |',
        `| --- | --- | --- |${update}`
      );
      fs.writeFileSync(notePath, updated, 'utf8');
      console.log(`\n📝 Обновлена: Clients/${slug}.md`);
    } else {
      const noteContent = `---
type: client
status: lead
created: ${today}
tags: [client]
---

# ${data.client_name}

## О клиенте

- **Сфера:** ${data.niche || '—'}
- **Контакт:** ${data.contact || '—'}
- **Откуда пришёл:** ${data.source || '—'}
- **Приоритет:** ${data.priority}

---

## Боль / Задача

> ${data.pain}

**Задача:** ${data.task}

---

## Предложение

- **Бюджет:** ${data.budget || 'не обсуждали'}
- **Срок:** ${data.deadline || 'не обсуждали'}

---

## История переговоров

| Дата | Что обсуждали | Следующий шаг |
| --- | --- | --- |
| ${today} | Первый контакт (auto-extract) | Уточнить бюджет |

---

## Заметки

${data.notes || '—'}
`;
      fs.writeFileSync(notePath, noteContent, 'utf8');
      console.log(`\n📝 Создана: Clients/${slug}.md`);
    }
  }

  return data;
}

// CLI
const args = process.argv.slice(2);

let text = '';
if (args.includes('--text')) {
  text = args[args.indexOf('--text') + 1];
} else if (args.includes('--file')) {
  text = fs.readFileSync(args[args.indexOf('--file') + 1], 'utf8');
} else if (args.includes('--stdin')) {
  text = fs.readFileSync('/dev/stdin', 'utf8');
} else {
  console.log(`Использование:
  node extract.js --text "Привет, мне нужен бот для автосервиса..."
  node extract.js --file message.txt`);
  process.exit(0);
}

extract(text);
