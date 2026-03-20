# MiMo TTS Lite

轻量级 MiMo v2 文字转语音 Web 界面，支持文本校验。

## 功能

- 🎤 **文字转语音** — 输入文本，一键生成 WAV/MP3 音频
- 🔍 **文本校验** — AI 自动检查错别字、多音字、重复字、语句不通顺
- ⚙️ **参数调节** — 语速、音量、音高、段落停顿
- 📜 **历史记录** — 本地保存生成历史，支持回放
- 📦 **格式选择** — WAV / MP3 输出

## 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 启动（需要 MiMo API Key）
MIMO_API_KEY=your_key node server.js

# 3. 打开浏览器
# http://localhost:3210
```

API Key 也可以在页面上直接输入，无需环境变量。

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

```json
{
  "text": "你好，这是一段测试文本",
  "format": "wav",
  "speed": 1.0,
  "pitch": 0,
  "volume": 100,
  "pauseMs": 0,
  "apiKey": "optional_inline_key"
}
```

**响应：**

```json
{
  "success": true,
  "audio": "<base64-encoded>",
  "size": 92204,
  "filename": "tts_xxx.wav",
  "format": "wav",
  "mimeType": "audio/wav"
}
```

### POST /api/proofread

AI 文本校验。

```json
{
  "text": "今天天气很好，我们一起去公圆玩把",
  "apiKey": "optional_inline_key"
}
```

**响应：**

```json
{
  "success": true,
  "issues": [
    {
      "type": "错别字",
      "position": "公圆",
      "original": "公圆",
      "suggestion": "公园",
      "reason": "'圆'应为'园'，指公园，用字错误"
    }
  ],
  "summary": "文本中有1处错别字，修改后语句通顺。"
}
```

### GET /api/health

健康检查。

```json
{ "status": "ok", "hasApiKey": true }
```

## 技术栈

- **后端：** Node.js + Express
- **前端：** 原生 HTML/CSS/JS，无框架依赖
- **API：** MiMo v2 (OpenAI 兼容格式)
- **音频处理：** ffmpeg（MP3 转换）

## License

MIT
