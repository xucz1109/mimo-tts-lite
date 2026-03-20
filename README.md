# MiMo TTS Lite

轻量级 MiMo v2 文字转语音 Web 界面，支持文本校验。

## 功能

- 🎤 **文字转语音** — 输入文本，一键生成 WAV/MP3 音频
- 🔊 **音色选择** — 默认 / 中文 / 英文
- 🎨 **语气控制** — 情感（开心、悲伤等）+ 抑扬顿挫（清晰有力、抑扬顿挫等）
- ⏸️ **智能停顿** — 自动按句断句，可自定义停顿时长
- 🔍 **文本校验** — AI 检查不通顺 & 多音字
- ⚙️ **参数调节** — 语速、音量、音高
- 📜 **历史记录** — 本地保存，支持回放（默认折叠）

## 快速开始

```bash
npm install
MIMO_API_KEY=your_key node server.js
# 打开 http://localhost:3210
```

API Key 也可以在页面上直接输入。

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `MIMO_API_KEY` | — | MiMo API 密钥 |
| `MIMO_API_ENDPOINT` | `https://api.xiaomimimo.com/v1/chat/completions` | API 端点 |
| `MIMO_TTS_MODEL` | `mimo-v2-audio-tts` | TTS 模型 |
| `MIMO_PROOFREAD_MODEL` | `mimo-v2-pro` | 文本校验模型 |
| `PORT` | `3210` | 服务端口 |

## API

### POST /api/tts

生成语音。

| 参数 | 类型 | 说明 |
|------|------|------|
| `text` | string | 待合成文本（必填，≤10000字） |
| `style` | string | 语气风格，如 `开心 清晰有力` |
| `voice` | string | 音色：`mimo_default` / `default_zh` / `default_en` |
| `speed` | number | 语速，0.5-2.0，默认 1.0 |
| `pitch` | number | 音高，-12 到 12，默认 0 |
| `volume` | number | 音量，0-200，默认 100 |
| `pauseMs` | number | 句间停顿(ms)，0-5000 |
| `format` | string | 输出格式：`wav` / `mp3` |
| `apiKey` | string | 可选，页面传入的 Key |

### POST /api/proofread

AI 文本校验，检查两类问题：

1. **不通顺** — 拗口、搭配不当的字词
2. **多音字** — 文中出现的所有多音字及读音

```json
{
  "text": "银行发行的新政策影响了行风"
}
```

```json
{
  "success": true,
  "awkward": [{"position":"...","original":"...","suggestion":"...","reason":"..."}],
  "polyphonic": [{"character":"行","pinyin":"háng","context":"银行","note":"..."}],
  "summary": "..."
}
```

### GET /api/health

健康检查。

## 技术栈

- **后端：** Node.js + Express
- **前端：** 原生 HTML/CSS/JS，无框架依赖
- **API：** MiMo v2（OpenAI 兼容格式）
- **音频处理：** ffmpeg（MP3 转换）

## License

MIT
