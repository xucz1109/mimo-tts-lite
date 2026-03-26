# 小米 MiMo API 参考文档

## 概述

小米 MiMo 平台提供 OpenAI 兼容的 API 接口，支持文本生成、语音合成等功能。

**官方平台**：
- 控制台：https://platform.xiaomimimo.com/
- AI Studio：https://aistudio.xiaomimimo.com/
- API 文档：https://platform.xiaomimimo.com/#/docs/api/chat/openai-api

## API 端点

### OpenAI 格式

```
POST https://api.xiaomimimo.com/v1/chat/completions
```

### Anthropic 格式

```
POST https://api.xiaomimimo.com/anthropic/v1/messages
```

## 认证

使用 `api-key` 请求头进行认证：

```bash
api-key: YOUR_API_KEY
```

或使用标准的 `Authorization` 头：

```bash
Authorization: Bearer YOUR_API_KEY
```

## 可用模型

| 模型 | 说明 | 上下文长度 |
|------|------|-----------|
| `mimo-v2-flash` | 开源基础语言模型，309B总参数，15B活跃参数 | 256K |
| `mimo-v2-pro` | 旗舰模型，超过1T总参数，1M上下文长度 | 1M |
| `mimo-v2-audio-tts` | 语音合成模型 | N/A |
| `mimo-v2-omni` | 多模态模型，支持图像、视频、音频输入 | 256K |

## OpenAI 兼容 API 示例

### 基本请求

```bash
curl --location --request POST 'https://api.xiaomimimo.com/v1/chat/completions' \
--header "api-key: $MIMO_API_KEY" \
--header "Content-Type: application/json" \
--data-raw '{
    "model": "mimo-v2-flash",
    "messages": [
        {
            "role": "user",
            "content": "请介绍一下你自己"
        }
    ],
    "max_completion_tokens": 1024,
    "temperature": 0.8,
    "top_p": 0.95,
    "stream": false,
    "stop": null,
    "frequency_penalty": 0,
    "presence_penalty": 0,
    "thinking": {
        "type": "disabled"
    }
}'
```

### Python 示例

```python
from openai import OpenAI

client = OpenAI(
    api_key="YOUR_API_KEY",
    base_url="https://api.xiaomimimo.com/v1"
)

response = client.chat.completions.create(
    model="mimo-v2-flash",
    messages=[
        {"role": "user", "content": "请介绍一下你自己"}
    ],
    max_tokens=1024,
    temperature=0.8
)

print(response.choices[0].message.content)
```

## 语音合成 API (TTS)

### 请求格式

```json
{
    "model": "mimo-v2-audio-tts",
    "messages": [
        {
            "role": "assistant",
            "content": "<style>语音风格</style>要合成的文本"
        }
    ],
    "audio": {
        "format": "wav",
        "voice": "mimo_default",
        "speed": 1.0,
        "pitch": 0,
        "volume": 100
    }
}
```

### 支持的参数

| 参数 | 类型 | 说明 |
|------|------|------|
| `model` | string | 模型名称，固定为 `mimo-v2-audio-tts` |
| `messages[0].content` | string | 包含风格标签和文本 |
| `audio.format` | string | 音频格式：`wav` / `mp3` |
| `audio.voice` | string | 语音：`mimo_default` / `default_zh` / `default_en` |
| `audio.speed` | number | 语速，0.5-2.0，默认 1.0 |
| `audio.pitch` | number | 音高，-12 到 12，默认 0 |
| `audio.volume` | number | 音量，0-200，默认 100 |

### 风格标签

使用 `<style>` 标签指定语音风格：

```xml
<style>清晰有力，语速稳定</style>要合成的文本
```

支持的风格描述：
- 情感：开心、悲伤、生气、平静、深情款款、慵懒、撒娇
- 语调：清晰有力、抑扬顿挫、温柔、标准广播腔
- 方言：东北话、四川话、河南话、粤语、台湾腔

### 响应格式

```json
{
    "id": "chatcmpl-xxx",
    "object": "chat.completion",
    "created": 1234567890,
    "model": "mimo-v2-audio-tts",
    "choices": [
        {
            "index": 0,
            "message": {
                "role": "assistant",
                "content": null,
                "audio": {
                    "data": "base64编码的音频数据",
                    "format": "wav"
                }
            },
            "finish_reason": "stop"
        }
    ],
    "usage": {
        "prompt_tokens": 10,
        "completion_tokens": 0,
        "total_tokens": 10
    }
}
```

## 错误处理

### 常见错误码

| 错误码 | 说明 |
|--------|------|
| 400 | 请求参数错误 |
| 401 | API Key 无效 |
| 402 | 账号余额不足 |
| 429 | 请求过于频繁 |
| 500 | 服务器内部错误 |

### 错误响应示例

```json
{
    "error": {
        "message": "Insufficient balance",
        "type": "insufficient_balance",
        "code": "invalid_request_error"
    }
}
```

## 最佳实践

### 1. 语音合成优化

- **一致性提示**：在 `<style>` 标签中添加一致性提示，确保长文本语音风格一致
- **分段处理**：长文本自动分段，每段独立合成后拼接
- **停顿控制**：使用 `pauseMs` 参数控制段落间停顿

### 2. 性能优化

- **流式输出**：设置 `stream: true` 获取流式响应
- **批处理**：多个请求可以并发处理
- **缓存**：相同文本可以缓存结果

### 3. 错误处理

```python
try:
    response = client.chat.completions.create(
        model="mimo-v2-audio-tts",
        messages=[...]
    )
except Exception as e:
    if "insufficient_balance" in str(e):
        print("余额不足，请充值")
    elif "rate" in str(e):
        print("请求过于频繁，请稍后重试")
    else:
        print(f"错误: {e}")
```

## 速率限制

| 等级 | 并发请求数 | 每分钟请求数 |
|------|-----------|-------------|
| 免费 | 5 | 60 |
| 标准 | 50 | 1000 |
| 企业 | 200 | 10000 |

## 计费

| 模型 | 输入价格 (每百万tokens) | 输出价格 (每百万tokens) |
|------|------------------------|------------------------|
| mimo-v2-flash | ¥1.00 | ¥2.00 |
| mimo-v2-pro | ¥10.00 | ¥20.00 |
| mimo-v2-audio-tts | ¥5.00/分钟 | - |

## 更新日志

- **2026-03-18**：发布 MiMo-V2-TTS 语音合成模型
- **2025-12-21**：支持 OpenAI 和 Anthropic 双格式 API
- **2025-09-19**：发布 MiMo-Audio 音频理解模型

## 相关链接

- [官方文档](https://platform.xiaomimimo.com/#/docs/api/chat/openai-api)
- [AI Studio](https://aistudio.xiaomimimo.com/)
- [GitHub](https://github.com/XiaomiMiMo)
- [OpenRouter](https://openrouter.ai/xiaomi/mimo-v2-flash:free)