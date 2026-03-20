# 🎙️ MiMo TTS Web

<div align="center">

![MiMo TTS](https://img.shields.io/badge/MiMo-v2_TTS-purple?style=for-the-badge)
![Node.js](https://img.shields.io/badge/Node.js-22+-green?style=for-the-badge)
![ffmpeg](https://img.shields.io/badge/ffmpeg-MP3-blue?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)

**基于小米 MiMo v2 大模型的文字转语音 Web 应用**

输入文本 → 调节参数 → 生成语音 → 在线试听 → 下载 WAV/MP3

[功能介绍](#-功能) • [快速开始](#-快速开始) • [API 文档](#-api-文档)

</div>

---

## ✨ 功能

### 🎤 语音合成
- **高质量语音合成** — 调用 MiMo v2 TTS 大模型，自然流畅
- **16+ 预设风格** — 开心、悲伤、平静、东北话、四川话等一键切换
- **自定义风格** — 支持任意自然语言描述的风格组合
- **唱歌模式** — 支持歌词朗唱，预置 15 首歌曲

### 🎭 多角色语音模式
在每行文本开头用 `[标签]` 指定该行的独立音色/风格，系统会逐行调用 TTS 并自动拼接：

```
[男声][愤怒]你竟敢背叛我！[停顿500ms]
[女声][温柔]没关系，我原谅你。
[鸣人][快速][大声喊]我要成为火影！
没有标签的行使用全局风格设置
```

支持的标签：

| 类型 | 标签 | 类型 | 标签 |
|------|------|------|------|
| 😊 情绪 | `[开心]` `[悲伤]` `[生气]` `[平静]` `[深情款款]` `[慵懒 刚睡醒]` `[撒娇 夹子音]` | 🗺️ 方言 | `[东北话]` `[四川话]` `[台湾腔]` `[粤语]` |
| 🎭 角色 | `[像个大将军]` `[像个小孩]` `[孙悟空]` `[像个新闻主播]` `[像个老师]` | 💬 语气 | `[悄悄话]` `[大声喊]` `[清晰有力]` |
| ⚡ 语速 | `[语速1.5x]` `[语速0.8x]` | 🔊 音量 | `[音量150%]` `[音量80%]` |
| 🎵 音高 | `[音高+3]` `[音高-5]` | ⏸ 停顿 | `[停顿500ms]` `[停顿1000ms]` |

支持多个标签自由叠加：`[女声][台湾腔][温柔][语速0.9x]`

> 💡 点击右侧面板的任意配置项，标签自动插入到文本框光标所在行行首。滑块旁的 ＋ 按钮可插入语速/音量/音高/停顿标签。

### ⚙️ 参数调节
| 功能 | 说明 |
|------|------|
| **语速** | 0.5x ~ 2.0x |
| **音量** | 0% ~ 200% |
| **音高** | -12 ~ +12，可做变声效果 |
| **段落停顿** | 0~3000ms 静音，可全局设置或用 `[停顿]` 标签逐行控制 |
| **下载格式** | WAV（无损）/ MP3（128kbps） |
| **试听模式** | 仅转换前 50 字，快速调试 |
| **自动文本规范化** | 数字、符号自动转为朗读格式 |

### 🔧 界面特性
- **撤销 / 恢复** — 文本编辑和标签插入均可撤销恢复（最多 50 步），支持 Ctrl+Z / Ctrl+Y 快捷键
- **实时行预览** — 文本框下方显示每行解析出的标签，风格与停顿区分颜色
- **生成进度** — 多角色模式下逐行显示当前生成的标签和文本，如 `[男声][愤怒]你竟敢背叛我！… (1/3)`
- **生成历史** — 浏览器本地保存，回放之前生成的语音
- **左右分栏布局** — 左侧输入+结果，右侧配置面板，适配 1080p 无需全屏
- **参数调节可折叠** — 参数面板默认展开，不需要时可收起节省空间
- **响应式** — 适配桌面与移动端
- **内置 API 文档** — 弹窗查看完整请求格式和代码示例
- **请求超时保护** — 5 分钟超时，超时后显示明确错误提示

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
- **ffmpeg**（MP3 转换所需，仅用 WAV 可不装）

```bash
# Ubuntu / Debian
sudo apt install ffmpeg

# macOS
brew install ffmpeg
```

### 3. 配置 API Key

支持三种方式（优先级从高到低）：

1. **页面输入** — 启动后在页面右上角输入并保存，Key 存于浏览器 localStorage
2. **环境变量** — `MIMO_API_KEY=your_key`
3. **OpenClaw 配置** — 自动从 `~/.openclaw/openclaw.json` 读取

> ⚠️ 页面输入的 API Key 会随请求发送到后端，请在可信网络环境使用。

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
| 模型 | `mimo-v2-audio-tts` |
| 端点 | `https://api.xiaomimimo.com/v1/chat/completions` |
| 输出 | WAV（24kHz, 16-bit PCM）/ MP3 |
| 最大文本 | 10,000 字符 |

### `POST /api/tts`

#### 请求参数

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `text` | string | ✅ | 合成文本（最大 10000 字符） |
| `style` | string | ❌ | 全局风格，如 `开心`、`东北话 像个大将军` |
| `apiKey` | string | ❌ | API Key（优先于环境变量） |
| `speed` | number | ❌ | 语速倍率 0.5~2.0（默认 1.0） |
| `volume` | number | ❌ | 音量 0~200（默认 100） |
| `pitch` | number | ❌ | 音高 -12~+12（默认 0） |
| `pauseMs` | number | ❌ | 段间停顿 ms（默认 0） |
| `format` | string | ❌ | `wav`（默认）或 `mp3` |

#### 多角色标签

文本中每行开头的 `[标签]` 会覆盖全局 style，`[停顿XXXms]` 作为行间静音。服务端按行拆分、逐行合成、拼接返回。

#### 响应

```json
{
  "success": true,
  "audio": "<base64>",
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

# 带风格 + MP3
curl -X POST http://localhost:3210/api/tts \
  -H "Content-Type: application/json" \
  -d '{"text":"今天天气真好！","style":"开心","speed":1.2,"format":"mp3"}'

# 多角色
curl -X POST http://localhost:3210/api/tts \
  -H "Content-Type: application/json" \
  -d '{"text":"[男声][愤怒]你竟敢背叛我！[停顿500ms]\n[女声][温柔]没关系，我原谅你。"}'
```

### MiMo 原生 API

```bash
curl -X POST https://api.xiaomimimo.com/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "api-key: YOUR_API_KEY" \
  -d '{
    "model": "mimo-v2-audio-tts",
    "audio": {"format": "wav", "voice": "mimo_default"},
    "messages": [{"role": "assistant", "content": "<style>开心</style>恭喜你！"}]
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
with open("output.wav", "wb") as f:
    f.write(base64.b64decode(resp.json()["choices"][0]["message"]["audio"]["data"]))
```

### 文本规范化

开启后自动转换（数字→中文、符号→朗读）：

| 输入 | 朗读 | 输入 | 朗读 |
|------|------|------|------|
| `3.14` | 三点一四 | `95%` | 百分之九十五 |
| `14:30` | 下午两点半 | `+` `-` `*` `=` | 加 减 乘以 等于 |

---

## 📁 项目结构

```
mimo-tts-web/
├── server.js              # Express 后端（含多角色分行 TTS 拼接）
├── public/
│   └── index.html         # 前端单页应用
├── scripts/
│   └── tts_to_wav.sh      # 命令行 TTS 脚本（可选）
├── sing0301_dict.json     # 预置歌曲歌词字典（15 首）
├── package.json
└── README.md
```

## ⚙️ 环境变量

| 变量 | 说明 |
|------|------|
| `MIMO_API_KEY` | MiMo API 密钥（必需） |
| `MIMO_API_ENDPOINT` | 自定义 API 端点 |
| `MIMO_TTS_MODEL` | 模型名（默认 `mimo-v2-audio-tts`）|
| `PORT` | 服务端口（默认 `3210`）|

---

## 📸 页面截图

![主页面](screenshots/main.png)
![多角色](screenshots/multi-role.png)
![参数调节](screenshots/advanced.png)
![生成结果](screenshots/result.png)

> 💡 运行项目后截取实际界面截图保存到 `screenshots/` 目录

---

## 📄 License

MIT
