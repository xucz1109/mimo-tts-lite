# 🎙️ MiMo TTS Web

<div align="center">

![MiMo TTS](https://img.shields.io/badge/MiMo-v2_TTS-purple?style=for-the-badge)
![Node.js](https://img.shields.io/badge/Node.js-22+-green?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)

**基于小米 MiMo v2 大模型的文字转语音 Web 应用**

输入文本 → 选择风格 → 生成语音 → 在线试听 → 下载 WAV

[功能介绍](#-功能) • [快速开始](#-快速开始) • [API 文档](#-api-文档) • [截图](#-页面截图)

</div>

---

## ✨ 功能

### 🎤 语音合成
- **高质量语音合成** — 调用 MiMo v2 TTS 大模型，自然流畅
- **16+ 预设风格** — 开心、悲伤、平静、东北话、四川话等一键切换
- **自定义风格** — 支持任意自然语言描述的风格组合
- **语音克隆** — 上传 5~15 秒 WAV 音频，克隆任意音色
- **唱歌模式** — 支持歌词朗唱，预置多首歌曲

### 🎛️ 多维度风格控制
| 维度 | 选项 |
|------|------|
| 情绪 | 开心、悲伤、生气、平静、深情款款、慵懒… |
| 语速 | 正常、语速慢、语速快 |
| 方言 | 东北话、四川话、台湾腔、粤语 |
| 角色 | 像个大将军、像个小孩、孙悟空、林黛玉… |
| 语气 | 悄悄话、清晰有力、撒娇、夹子音… |
| 唱歌 | 预置歌词库 / 自定义歌词 |

### 📖 API 文档（内置）
- 完整的 API 端点、请求格式、响应格式说明
- 代码调用示例（curl、Python、JavaScript）
- 环境变量配置说明
- 文本规范化规则

### 🔧 优化与设计
- **文本规范化** — 自动将数字、符号转换为自然语音格式
- **生成历史** — 回放之前生成的语音
- **一键下载** — 标准 WAV（24kHz, 16-bit, Mono）
- **暗色主题** — 护眼设计，沉浸体验
- **响应式布局** — 适配桌面与移动端

---

## 🚀 快速开始

### 1. 克隆项目
```bash
git clone https://github.com/xucz1109/mimo-tts-web.git
cd mimo-tts-web
npm install
```

### 2. 配置 API Key

**方式 A：环境变量**
```bash
export MIMO_API_KEY="your-api-key-here"
```

**方式 B：OpenClaw 自动读取**
> 如果已安装 OpenClaw，自动从 `~/.openclaw/openclaw.json` 读取

### 3. 启动
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
| **输出格式** | WAV（24kHz, 16-bit PCM, 单声道） |

### 请求格式

```bash
curl -X POST https://api.xiaomimimo.com/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "api-key: YOUR_API_KEY" \
  -d '{
    "model": "mimo-v2-audio-tts",
    "audio": {"format": "wav", "voice": "mimo_default"},
    "messages": [
      {"role": "assistant", "content": "你好，我是小米AI语音助手。"}
    ]
  }'
```

### Python 示例

```python
import requests, base64, struct, io

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

### 带风格的请求

```json
{
  "model": "mimo-v2-audio-tts",
  "audio": {"format": "wav", "voice": "mimo_default"},
  "messages": [
    {"role": "assistant", "content": "<style>开心激动</style>恭喜你获得了一等奖！"}
  ]
}
```

### 带语音克隆的请求

```json
{
  "model": "mimo-v2-audio-tts",
  "audio": {
    "format": "wav",
    "voice_audio": {
      "format": "wav",
      "data": "<base64-encoded-wav>"
    }
  },
  "messages": [
    {"role": "assistant", "content": "大家好，我是自定义音色。"}
  ]
}
```

### 响应格式

```json
{
  "choices": [{
    "message": {
      "audio": {
        "data": "<base64-encoded-wav>"
      }
    }
  }]
}
```

### 风格能力一览

| 分类 | 示例 |
|------|------|
| 😊 情绪 | `开心` `悲伤` `生气` `平静` `深情款款` |
| 🏎️ 语速 | `语速慢` `语速快` `清晰有力` |
| 🗺️ 方言 | `东北话` `四川话` `台湾腔` `粤语` |
| 🎭 角色 | `像个大将军` `像个小孩` `孙悟空` `林黛玉` |
| 💬 语气 | `悄悄话` `慵懒 刚睡醒` `撒娇 夹子音` |
| 🎵 唱歌 | `唱歌`（配合歌词字典或 `LYRICS:` 前缀） |
| 🔀 组合 | `深情款款 语速慢` `慵懒 刚睡醒` `撒娇 夹子音` |

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
├── server.js              # Express 后端服务
├── public/
│   └── index.html         # 前端单页应用（含 API 文档）
├── scripts/
│   └── tts_to_wav.sh      # MiMo TTS API 调用脚本
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

### 风格选择面板
![风格面板](screenshots/styles.png)

### 生成结果与试听
![生成结果](screenshots/result.png)

### API 文档页面
![API文档](screenshots/api-docs.png)

> 💡 运行项目后截取实际界面截图保存到 `screenshots/` 目录

---

## 🔮 优化方向

| 方向 | 说明 |
|------|------|
| 🎤 **多音色对比** | 同一段文本用不同风格并排生成，A/B 对比试听 |
| 📊 **波形可视化** | 音频播放时显示实时波形/频谱图 |
| 📝 **批量合成** | 导入文本列表，批量生成并打包下载 |
| 🔊 **格式转换** | 服务端自动转 MP3/OGG 等格式 |
| 🌍 **多语言** | 支持英文、日文等多语言界面 |
| 📱 **PWA 支持** | 添加 Service Worker，支持离线使用 |
| 🔐 **用户系统** | 多用户、配额管理、生成记录持久化 |
| 🎵 **歌词编辑器** | 可视化歌词编辑，支持唱歌模式 |

---

## 📄 License

MIT
