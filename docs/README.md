# MiMo TTS 项目文档

## 概述

本目录包含 MiMo TTS 项目的相关文档，供开发和参考使用。

## 文档列表

### 1. [API 参考文档](./mimo-api-reference.md)
- 小米 MiMo API 的完整参考
- 包括所有模型、端点和参数说明
- 包含 OpenAI 和 Anthropic 两种格式

### 2. [TTS API 详细文档](./tts-api-detailed.md)
- 语音合成 API 的详细说明
- 风格控制和参数调优
- 使用示例和最佳实践

### 3. [优化指南](./tts-optimization-guide.md)
- 如何优化 TTS 生成质量
- 解决常见问题（漏句子、重复、不一致等）
- 平滑拼接和自然停顿的实现

### 4. [Temperature 参数指南](./temperature-guide.md)
- Temperature 参数详解
- 不同温度值的效果对比
- 使用建议和最佳实践

## 快速参考

### API 端点

```
OpenAI 格式：POST https://api.xiaomimimo.com/v1/chat/completions
Anthropic 格式：POST https://api.xiaomimimo.com/anthropic/v1/messages
```

### 可用模型

| 模型 | 用途 |
|------|------|
| `mimo-v2-flash` | 通用对话，309B参数 |
| `mimo-v2-pro` | 旗舰模型，1T参数 |
| `mimo-v2-audio-tts` | 语音合成 |
| `mimo-v2-omni` | 多模态（图像、视频、音频） |

### TTS 基本请求

```json
{
    "model": "mimo-v2-audio-tts",
    "messages": [
        {
            "role": "assistant",
            "content": "<style>清晰有力</style>要合成的文本"
        }
    ],
    "audio": {
        "format": "wav",
        "voice": "mimo_default"
    }
}
```

## 项目结构

```
mimo-tts-lite/
├── docs/                    # 文档目录
│   ├── README.md           # 本文件
│   ├── mimo-api-reference.md  # API参考文档
│   ├── tts-api-detailed.md    # TTS详细文档
│   └── tts-optimization-guide.md  # 优化指南
├── public/                  # 前端文件
│   └── index.html          # 主界面
├── server.js               # 后端服务
├── package.json            # 项目配置
└── README.md               # 项目说明
```

## 核心功能

### 1. 文字转语音
- 支持多种语音风格
- 方言和角色扮演
- 语速、音高、音量调节

### 2. 智能分段
- 按标点符号自动分割
- 保持文本完整性
- 智能停顿控制

### 3. 平滑拼接
- 淡入淡出效果
- 自然静音生成
- 消除突兀声音

### 4. 一致性控制
- 确保长文本语音风格一致
- 分段上下文信息
- 可自定义提示词

### 5. 自动校验
- ASR 语音识别校验
- 相似度计算
- 错误检测和重试

## 配置说明

### 环境变量

```bash
# 必需
MIMO_API_KEY=your_api_key

# 可选
MIMO_API_ENDPOINT=https://api.xiaomimimo.com/v1/chat/completions
MIMO_TTS_MODEL=mimo-v2-audio-tts
MIMO_CONSISTENCY_PROMPT=请严格按照以下文本朗读...
PORT=3210
```

### 启动服务

```bash
npm install
MIMO_API_KEY=your_key node server.js
# 打开 http://localhost:3210
```

## 常见问题

### Q: 如何确保长文本生成的一致性？
A: 使用一致性提示词和分段上下文信息。参考[优化指南](./tts-optimization-guide.md)。

### Q: 如何消除拼接时的突兀声音？
A: 启用平滑拼接功能，使用淡入淡出效果。参考[优化指南](./tts-optimization-guide.md)。

### Q: 如何校验生成的语音是否正确？
A: 使用 `/api/verify` 端点进行ASR校验。参考[TTS详细文档](./tts-api-detailed.md)。

### Q: 如何自定义语音风格？
A: 在 `<style>` 标签中使用自然语言描述。参考[TTS详细文档](./tts-api-detailed.md)。

## 更新记录

- **2026-03-21**: 创建文档目录，添加API文档和优化指南
- **2026-03-21**: 添加平滑拼接和一致性控制文档

## 贡献

欢迎提交 Issue 和 Pull Request 来改进文档。

## 许可证

MIT License