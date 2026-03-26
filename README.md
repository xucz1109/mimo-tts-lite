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
| `MIMO_CONSISTENCY_PROMPT` | "请严格按照以下文本朗读，保持音色、语调、情绪、语气、语速完全一致。不要遗漏任何内容，不要重复任何内容，不要添加任何额外内容。" | 自定义一致性提示词 |
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
| `temperature` | number | 生成温度，0.1-1.0，默认 0.3（更精准） |
| `pauseMs` | number | 句间停顿(ms)，0-5000 |
| `format` | string | 输出格式：`wav` / `mp3` |
| `split` | boolean | 是否分割长文本，默认 true |
| `maxSegmentLength` | number | 最大段落长度，默认 200 |
| `addNumbers` | boolean | 是否自动添加编号，默认 false |
| `apiKey` | string | 可选，页面传入的 Key |

#### 确保长文本一致性

系统会自动添加一致性提示词，确保长文本生成过程中音色、语调、情绪、语气、语速完全一致：

1. **自动一致性控制**：所有文本（无论是否分割）都会包含一致性提示词
2. **分段处理一致性**：当文本被分割时，系统会为每个段落添加上下文信息，确保所有段落使用相同的语音风格
3. **自定义提示词**：通过 `MIMO_CONSISTENCY_PROMPT` 环境变量可以自定义一致性提示词
4. **自动校验**：使用 `/api/verify` 端点可以验证生成的语音是否与原始文本一致

#### 平滑拼接与自然停顿

系统优化了音频拼接算法，确保段落间过渡自然：

1. **自然静音**：静音段落包含轻微背景噪音，避免完全静音的突兀感
2. **淡入淡出效果**：每个音频段落的开头和结尾都有平滑的淡入淡出
3. **智能停顿**：停顿时间自动调整（100ms-3000ms），避免过短或过长
4. **平滑拼接**：使用专门的拼接算法，消除段落间的突兀电子声音

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

### POST /api/verify

校验生成的语音是否与原始文本一致，检测漏读或重复问题。

| 参数 | 类型 | 说明 |
|------|------|------|
| `originalText` | string | 原始文本（必填） |
| `audioBase64` | string | 生成的音频Base64编码（必填） |
| `asrProvider` | string | ASR提供商：`local`（本地Whisper）、`whisper`（OpenAI API） |
| `asrApiKey` | string | ASR API密钥（使用whisper时需要） |

返回示例：
```json
{
  "success": true,
  "similarity": 0.92,
  "similarityPercent": "92.0%",
  "originalText": "原始文本...",
  "recognizedText": "识别出的文字...",
  "originalLength": 100,
  "recognizedLength": 95,
  "lengthDiff": -5,
  "missingChars": [{"char": "你", "count": 1}],
  "repeatedPatterns": [],
  "quality": "excellent",
  "issues": []
}
```

## 技术栈

- **后端：** Node.js + Express
- **前端：** 原生 HTML/CSS/JS，无框架依赖
- **API：** MiMo v2（OpenAI 兼容格式）
- **音频处理：** ffmpeg（MP3 转换）

## License

MIT
