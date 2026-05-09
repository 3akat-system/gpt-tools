# GPT Tools

> CLI utilities for OpenAI API — transcription, image generation, text extraction.

## Tools

| Command | What it does | Cost |
|---------|-------------|------|
| `node dalle.js "prompt"` | Image generation via DALL-E 3 | ~$0.04/image |
| `node whisper.js <file>` | Audio transcription via Whisper | ~$0.006/min |
| `node extract.js --text "..."` | Text processing via GPT-4o-mini | ~$0.001/call |
| `node usage.js` | Show API usage and budget | Free |

## Setup

```bash
npm install
export OPENAI_API_KEY=sk-...
```

## Options

**dalle.js**
- `--size square|landscape|portrait` (1024x1024 / 1792x1024 / 1024x1792)
- `--quality standard|hd`
- `--out path/to/file.png`

**whisper.js**
- `--note` — save transcription as a note

## Budget

Built-in budget tracking ($5/mo default). Usage logged to `usage.json`.

## License

MIT