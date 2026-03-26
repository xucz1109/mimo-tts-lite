# MiMo TTS API 详细文档

## 概述

本文档详细说明小米 MiMo TTS（文字转语音）API 的使用方法，包括请求格式、参数说明和最佳实践。

## API 端点

```
POST https://api.xiaomimimo.com/v1/chat/completions
```

## 请求格式

### 基本请求体

```json
{
    "model": "mimo-v2-audio-tts",
    "messages": [
        {
            "role": "assistant",
            "content": "<style>语音风格描述</style>要合成的文本内容"
        }
    ],
    "audio": {
        "format": "wav",
        "voice": "mimo_default"
    }
}
```

### 完整请求示例

```json
{
    "model": "mimo-v2-audio-tts",
    "messages": [
        {
            "role": "assistant",
            "content": "<style>清晰有力，语速稳定</style>这是一段测试文本，用于语音合成。"
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

## 参数详解

### 1. model

固定为 `mimo-v2-audio-tts`

### 2. messages

必须是包含单个消息的数组，消息角色为 `assistant`。

**content 格式**：
```xml
<style>语音风格描述</style>要合成的文本
```

### 3. audio 对象

| 参数 | 类型 | 范围 | 默认值 | 说明 |
|------|------|------|--------|------|
| `format` | string | `wav`/`mp3` | `wav` | 音频格式 |
| `voice` | string | 见下表 | `mimo_default` | 语音类型 |
| `speed` | number | 0.5-2.0 | 1.0 | 语速 |
| `pitch` | number | -12到12 | 0 | 音高 |
| `volume` | number | 0-200 | 100 | 音量 |

### 4. 其他参数

| 参数 | 类型 | 范围 | 默认值 | 说明 |
|------|------|------|--------|------|
| `temperature` | number | 0.1-1.0 | 0.3 | 生成温度，越低越精准 |

### 4. 支持的语音类型

| 语音ID | 说明 |
|--------|------|
| `mimo_default` | 默认语音 |
| `default_zh` | 中文语音 |
| `default_en` | 英文语音 |

## 风格控制

### 基本风格

在 `<style>` 标签中使用自然语言描述想要的语音风格：

```xml
<style>开心</style>今天天气真好！
```

### 复合风格

可以组合多个风格描述：

```xml
<style>清晰有力，抑扬顿挫，标准广播腔</style>新闻播报内容...
```

### 支持的风格类型

#### 情感类
- `开心` - 愉快、高兴的语气
- `悲伤` - 低沉、伤感的语气
- `生气` - 激动、愤怒的语气
- `平静` - 平和、自然的语气
- `深情款款` - 温柔、深情的语气
- `慵懒` - 慵懒、刚睡醒的语气
- `撒娇` - 可爱、撒娇的语气

#### 语调类
- `清晰有力` - 字正腔圆，发音清晰
- `抑扬顿挫` - 有节奏感，高低起伏
- `温柔` - 温和、柔软的语气
- `标准广播腔` - 新闻播报风格

#### 方言类
- `东北话` - 东北方言
- `四川话` - 四川方言
- `河南话` - 河南方言
- `粤语` - 广东方言
- `台湾腔` - 台湾普通话

#### 角色扮演
- `孙悟空` - 孙悟空的语气
- `林黛玉` - 林黛玉的语气

### 高级控制

#### 非语言声音事件

可以在文本中加入标记来生成咳嗽、叹息等声音：

```xml
<style>虚弱，气若游丝</style>水……给我点水……（剧烈咳嗽）咳咳咳！
```

支持的标记：
- `[cough]` - 咳嗽
- `[heavy breathing]` - 重呼吸
- `[sigh]` - 叹息
- `[laughter]` - 笑声

#### 停顿控制

可以使用标点符号控制停顿：
- `。` - 句号停顿
- `，` - 逗号短停顿
- `……` - 省略号长停顿
- `！` - 感叹号停顿
- `？` - 问号停顿

## 响应格式

### 成功响应

```json
{
    "id": "chatcmpl-abc123",
    "object": "chat.completion",
    "created": 1710000000,
    "model": "mimo-v2-audio-tts",
    "choices": [
        {
            "index": 0,
            "message": {
                "role": "assistant",
                "content": null,
                "audio": {
                    "data": "UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAAB9AAACABAAZGF0YQAAAAA=",
                    "format": "wav"
                }
            },
            "finish_reason": "stop"
        }
    ],
    "usage": {
        "prompt_tokens": 15,
        "completion_tokens": 0,
        "total_tokens": 15
    }
}
```

### 响应字段说明

| 字段 | 说明 |
|------|------|
| `choices[0].message.audio.data` | Base64 编码的音频数据 |
| `choices[0].message.audio.format` | 音频格式 |
| `choices[0].finish_reason` | 完成原因：`stop`（正常结束）|
| `usage.prompt_tokens` | 输入 token 数 |

## 使用示例

### cURL 示例

```bash
curl --location --request POST 'https://api.xiaomimimo.com/v1/chat/completions' \
--header "api-key: $MIMO_API_KEY" \
--header "Content-Type: application/json" \
--data-raw '{
    "model": "mimo-v2-audio-tts",
    "messages": [
        {
            "role": "assistant",
            "content": "<style>开心 清晰有力</style>你好，我是MiMo语音助手！"
        }
    ],
    "audio": {
        "format": "wav",
        "voice": "mimo_default",
        "speed": 1.0,
        "pitch": 0,
        "volume": 100
    }
}'
```

### Python 示例

```python
import requests
import base64

url = "https://api.xiaomimimo.com/v1/chat/completions"
headers = {
    "api-key": "YOUR_API_KEY",
    "Content-Type": "application/json"
}

payload = {
    "model": "mimo-v2-audio-tts",
    "messages": [
        {
            "role": "assistant",
            "content": "<style>清晰有力</style>这是一段测试文本。"
        }
    ],
    "audio": {
        "format": "wav",
        "voice": "mimo_default"
    }
}

response = requests.post(url, headers=headers, json=payload)
data = response.json()

# 解码音频
audio_base64 = data["choices"][0]["message"]["audio"]["data"]
audio_bytes = base64.b64decode(audio_base64)

# 保存为文件
with open("output.wav", "wb") as f:
    f.write(audio_bytes)
```

### Node.js 示例

```javascript
const fs = require('fs');
const https = require('https');

const data = JSON.stringify({
    model: "mimo-v2-audio-tts",
    messages: [{
        role: "assistant",
        content: "<style>温柔</style>你好，很高兴认识你。"
    }],
    audio: {
        format: "wav",
        voice: "mimo_default"
    }
});

const options = {
    hostname: 'api.xiaomimimo.com',
    path: '/v1/chat/completions',
    method: 'POST',
    headers: {
        'api-key': process.env.MIMO_API_KEY,
        'Content-Type': 'application/json'
    }
};

const req = https.request(options, (res) => {
    let body = '';
    res.on('data', (chunk) => body += chunk);
    res.on('end', () => {
        const result = JSON.parse(body);
        const audioBase64 = result.choices[0].message.audio.data;
        const audioBuffer = Buffer.from(audioBase64, 'base64');
        fs.writeFileSync('output.wav', audioBuffer);
    });
});

req.write(data);
req.end();
```

## 错误处理

### 常见错误

| 错误码 | 信息 | 解决方案 |
|--------|------|----------|
| 400 | Invalid request | 检查请求格式和参数 |
| 401 | Unauthorized | 检查 API Key |
| 402 | Insufficient balance | 充值账户余额 |
| 429 | Rate limit exceeded | 降低请求频率 |
| 500 | Internal server error | 稍后重试 |

### 错误响应示例

```json
{
    "error": {
        "message": "Invalid API key",
        "type": "authentication_error",
        "code": "invalid_api_key"
    }
}
```

## 最佳实践

### 1. 长文本处理

对于长文本，建议：
- 按句子或段落分段
- 每段保持相似的长度
- 使用一致性提示词确保风格统一

```javascript
// 一致性提示词示例
const consistencyPrompt = "请严格按照以下文本朗读，保持音色、语调、情绪、语气、语速完全一致。不要遗漏任何内容，不要重复任何内容。";

const content = `<style>${consistencyPrompt} 清晰有力</style>${text}`;
```

### 2. 性能优化

- 使用 `wav` 格式以获得最佳质量
- 适当调整语速（0.8-1.2 通常最佳）
- 避免过长的单次请求（建议 < 5000 字）

### 3. 音频质量

- 使用 `mimo_default` 语音以获得最佳效果
- 对于中文内容，可以使用 `default_zh`
- 对于英文内容，使用 `default_en`

### 4. 风格一致性

当处理多段文本时：
1. 使用相同的风格描述
2. 添加一致性提示词
3. 保持相似的文本长度

## 限制

| 限制项 | 值 |
|--------|-----|
| 单次最大文本长度 | 10000 字符 |
| 音频格式 | WAV, MP3 |
| 采样率 | 24kHz |
| 位深度 | 16bit |
| 声道 | 单声道 |

## 更新记录

- **2026-03-18**：发布 MiMo-V2-TTS
- **2026-03-19**：支持多种方言和角色扮演
- **2026-03-20**：优化语音质量和稳定性