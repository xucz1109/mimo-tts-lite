# 🎙️ MiMo TTS Web

<div align="center">

![MiMo TTS](https://img.shields.io/badge/MiMo-v2_TTS-purple?style=for-the-badge)
![Node.js](https://img.shields.io/badge/Node.js-22+-green?style=for-the-badge)
![ffmpeg](https://img.shields.io/badge/ffmpeg-MP3-blue?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)

**基于小米 MiMo v2 大模型的文字转语音 Web 应用**

输入文本 → 调节参数 → 生成语音 → 在线试听 → 下载 WAV/MP3

[功能介绍](#-功能) • [快速开始](#-快速开始) • [API 文档](#-api-文档) • [截图](#-页面截图)

</div>

---

## ✨ 功能

### 🎤 语音合成
- **高质量语音合成** — 调用 MiMo v2 TTS 大模型，自然流畅
- **16+ 预设风格** — 开心、悲伤、平静、东北话、四川话等一键切换
- **自定义风格** — 支持任意自然语言描述的风格组合
- **语音克隆** — 上传 5~15 秒 WAV 音频，克隆任意音色
- **唱歌模式** — 支持歌词朗唱，预置 15 首歌曲

### 🎛️ 多维度风格控制
| 维度 | 选项 |
|------|------|
| 😊 情绪 | 开心、悲伤、生气、平静、深情款款、慵懒… |
| 🏎️ 语速 | 正常、语速慢、语速快 |
| 🗺️ 方言 | 东北话、四川话、台湾腔、粤语 |
| 🎭 角色 | 像个大将军、像个小孩、孙悟空、林黛玉… |
| 💬 语气 | 悄悄话、清晰有力、撒娇、夹子音… |
| 🎵 唱歌 | 预置歌词库 / 自定义歌词 |
| 🔀 组合 | 任意风格自由搭配，如「深情款款 台湾腔」 |

### ⚙️ 高级设置
| 功能 | 说明 |
|------|------|
| **语速调节** | 滑块控制 0.5x ~ 2.0x |
| **音量调节** | 滑块控制 0% ~ 200% |
| **音高调节** | 滑块控制 -12 ~ +12，可做变声效果 |
| **段落停顿** | 文本按换行分段，段间插入 0~3000ms 静音 |
| **下载格式** | WAV（无损）/ MP3（128kbps，体积小约 4 倍） |
| **试听模式** | 仅转换前 50 字，快速调试风格效果 |
| **自动文本规范化** | 数字、符号自动转为自然朗读格式 |

### 🔧 其他特性
- **生成历史** — 浏览器本地保存，回放之前生成的语音
- **暗色主题** — 护眼设计，沉浸体验
- **响应式布局** — 适配桌面与移动端
- **折叠面板** — 高级设置、风格、语音克隆卡片默认折叠，界面更简洁
- **内置 API 文档** — 完整的请求格式、代码示例、风格说明

---

## 🚀 快速开始

### 1. 克隆项目
```bash
git clone https://github.com/xucz1109/mimo-tts-web.git
cd mimo-tts-web
npm install
```

### 2. 环境依赖

- **Node.js** >= 18（推荐 22+）
- **ffmpeg**（MP3 格式转换所需，仅使用 WAV 可不装）

```bash
# Ubuntu / Debian
sudo apt install ffmpeg

# macOS
brew install ffmpeg

# 验证
ffmpeg -version
```

### 3. 配置 API Key

支持三种方式（优先级从高到低）：

1. **页面输入** — 启动后在页面顶部输入 API Key 并点击「保存」，Key 暂存于浏览器 localStorage
2. **环境变量** — 启动前设置 `MIMO_API_KEY=your_key`
3. **OpenClaw 配置** — 自动从 `~/.openclaw/openclaw.json` 读取

> ⚠️ 页面输入的 API Key 会随 TTS 请求发送到后端服务器用于调用 API。请确保在可信任的网络环境中使用。

### 4. 启动
```bash
npm start
# 访问 http://localhost:3210
```

---

## 📡 API 文档

### 接口信息

| 项目 | 值 |
|------|------|
| **模型** | `mimo-v2-audio-tts` |
| **API 端点** | `https://api.xiaomimimo.com/v1/chat/completions` |
| **输出格式** | WAV（24kHz, 16-bit PCM, 单声道）/ MP3 |
| **最大文本长度** | 10,000 字符 |

### 本地 TTS 接口

```
POST /api/tts
Content-Type: application/json
```

#### 请求参数

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `text` | string | ✅ | 合成文本（最大 10000 字符） |
| `style` | string | ❌ | 风格描述，如 `开心`、`东北话 像个大将军` |
| `apiKey` | string | ❌ | API Key（优先级高于环境变量） |
| `speed` | number | ❌ | 语速倍率，0.5~2.0，默认 1.0 |
| `volume` | number | ❌ | 音量百分比，0~200，默认 100 |
| `pitch` | number | ❌ | 音高偏移，-12~+12，默认 0 |
| `pauseMs` | number | ❌ | 段落停顿时长(ms)，文本按换行分段，默认 0 |
| `format` | string | ❌ | 输出格式：`wav`（默认）或 `mp3` |
| `voiceAudioBase64` | string | ❌ | 语音克隆参考音频（Base64 编码的 WAV） |

#### 响应格式

```json
{
  "success": true,
  "audio": "<base64-encoded-audio>",
  "size": 238124,
  "filename": "tts_xxx.wav",
  "format": "wav",
  "mimeType": "audio/wav"
}
```

#### 示例

```bash
# 基础合成
curl -X POST http://localhost:3210/api/tts \
  -H "Content-Type: application/json" \
  -d '{"text":"你好，世界！"}'

# 带风格 + 语速 + MP3 输出
curl -X POST http://localhost:3210/api/tts \
  -H "Content-Type: application/json" \
  -d '{"text":"今天天气真好！","style":"开心","speed":1.2,"format":"mp3"}'

# 多段落 + 停顿
curl -X POST http://localhost:3210/api/tts \
  -H "Content-Type: application/json" \
  -d '{"text":"第一段。\n第二段。\n第三段。","pauseMs":800}'
```

### MiMo 原生 API

```bash
curl -X POST https://api.xiaomimimo.com/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "api-key: YOUR_API_KEY" \
  -d '{
    "model": "mimo-v2-audio-tts",
    "audio": {"format": "wav", "voice": "mimo_default"},
    "messages": [
      {"role": "assistant", "content": "<style>开心</style>恭喜你！"}
    ]
  }'
```

### Python 示例

```python
import requests, base64

resp = requests.post(
    "https://api.xiaomimimo.com/v1/chat/completions",
    headers={"Content-Type": "application/json", "api-key": "YOUR_API_KEY"},
    json={
        "model": "mimo-v2-audio-tts",
        "audio": {"format": "wav", "voice": "mimo_default"},
        "messages": [{"role": "assistant", "content": "今天天气真不错！"}],
    },
)

audio_data = base64.b64decode(resp.json()["choices"][0]["message"]["audio"]["data"])
with open("output.wav", "wb") as f:
    f.write(audio_data)
```

### 文本规范化规则

合成前建议将输入文本标准化：

| 输入 | 朗读 | 输入 | 朗读 |
|------|------|------|------|
| `3` | 三 | `+` | 加 |
| `3.14` | 三点一四 | `-` | 减 |
| `14:30` | 下午两点半 | `*` | 乘以 |
| `95%` | 百分之九十五 | `=` | 等于 |
| `2024` | 二零二四年 | `...` | 等等 |

---

## 📁 项目结构

```
mimo-tts-web/
├── server.js              # Express 后端（纯 Node.js，MP3 转码需 ffmpeg）
├── public/
│   └── index.html         # 前端单页应用（含 API 文档）
├── scripts/
│   └── tts_to_wav.sh      # 命令行 TTS 脚本（可选）
├── sing0301_dict.json     # 预置歌曲歌词字典（15 首）
├── package.json
├── .gitignore
└── README.md
```

## ⚙️ 环境变量

| 变量 | 必需 | 说明 |
|------|------|------|
| `MIMO_API_KEY` | ✅ | MiMo API 密钥 |
| `MIMO_API_ENDPOINT` | ❌ | 自定义 API 端点 |
| `MIMO_TTS_MODEL` | ❌ | 模型名（默认 `mimo-v2-audio-tts`）|
| `PORT` | ❌ | 服务端口（默认 `3210`）|

---

## 📸 页面截图

### 主页面 — 文字转语音
![主页面](screenshots/main.png)

### 高级设置面板
![高级设置](screenshots/advanced.png)

### 风格选择面板
![风格面板](screenshots/styles.png)

### 生成结果与试听
![生成结果](screenshots/result.png)

### API 文档页面
![API文档](screenshots/api-docs.png)

> 💡 运行项目后截取实际界面截图保存到 `screenshots/` 目录

---

## 📄 License

MIT
