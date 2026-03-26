API 地址： <https://api.xiaomimimo.com/v1/chat/completions>

&#x20;

Model： mimo-v2-tts

```
curl -X POST <https://api.xiaomimimo.com/v1/chat/completions> \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "mimo-v2-tts",
    "messages": [
      {"role": "user", "content": "请用自然的语气朗读以下文本"},
      {"role": "assistant", "content": "你好，我是小米的AI助手MiMo！"}
    ],
    "modalities": ["text", "audio"],
    "audio": {"format": "wav"}
  }'

```

- mimo\_default — 默认中文音色
- default\_en — 英文

Python 示例：

注意事项：

- 唱歌需要把歌词放在 \<style>唱歌\</style> 后面
- 返回的是 WAV 格式，飞书发送需要转 Opus（ffmpeg -i out.wav -ar 16000 -ac 1 -c:a libopus out.opus）

> 基于实际测试整理 API 地址：<https://api.xiaomimimo.com/v1/chat/completions>

***

***

### 2.1 基本结构

```
{
  "model": "mimo-v2-tts",
  "messages": [
    {"role": "user", "content": "提示语"},
    {"role": "assistant", "content": "要合成的文本"}
  ],
  "modalities": ["text", "audio"],
  "audio": {
    "format": "wav"
  }
}

```

```
{
  "messages": [
    {
      "role": "user",
      "content": "这里放提示语，告诉模型用什么语气/风格"
    },
    {
      "role": "assistant",
      "content": "这里放要合成的文本内容，可以包含风格标签"
    }
  ]
}

```

- `user` 消息 = 指令/提示（不被朗读）
- `assistant` 消息 = 要合成的文本（会被朗读）

## 三、风格标签（Style Tags）

### 3.2 方言/口音

标签

效果

备注

`<style>东北话</style>`

东北方言

趣味性强

`<style>粤语</style>`

粤语发音

需粤语文本

`<style>台湾腔</style>`

台湾口音

软糯感

`<style>四川话</style>`

四川方言

需四川话文本

`<style>上海话</style>`

上海方言

需上海话文本

`<style>河南话</style>`

河南方言

需河南话文本

标签

效果

备注

`<style>唱歌</style>`

唱歌

需要歌词配合

`<style>悄悄话</style>`

轻声细语

ASMR 风格

`<style>夹子音</style>`

撒娇、甜美

撒娇语气

`<style>播音腔</style>`

新闻播音

正式场合

`<style>讲故事</style>`

叙事语气

儿童故事

`<style>机器人</style>`

机械感

科幻场景

### 3.4 标签用法示例

```
{
  "role": "assistant",
  "content": "<style>东北话</style>哎呀妈呀，这事儿整的，老铁你说咋办吧！"
}

```

```
{
  "role": "assistant",
  "content": "<style>悄悄话</style>嘘，小声点，别把宝宝吵醒了。"
}

```

```
{
  "role": "assistant",
  "content": "<style>唱歌</style>一闪一闪亮晶晶，满天都是小星星。"
}

```

***

## 四、音色选项

在 audio 参数中指定：

```
{
  "audio": {
    "format": "wav",
    "voice": "mimo_default"
  }
}

```

***

## 五、完整调用示例

### 5.3 curl 调用

***

## 六、音频格式转换

```
ffmpeg -i output.wav -codec:a libmp3lame -qscale:a 2 output.mp3

```

### 6.2 WAV → Opus（飞书语音）

```
ffmpeg -i output.wav -ar 16000 -ac 1 -c:a libopus -b:a 24k output.opus

```

### 6.3 WAV → OGG（Telegram 语音）

***

建议

原因

每段 100-200 字

太长会前快后慢

用好标点符号

影响停顿和语气

避免特殊字符

数学符号、代码等可能读错

英文用中文音色会读拼音

英文内容用 default\_en

### 7.3 唱歌技巧

```
1. 歌词要准确（包括语气词如"啦""呀"）
2. 每句歌词独立请求效果更好
3. 不在歌词库里的歌旋律会不准
4. 网易云 API 可获取歌词：<https://music.163.com/api/song/lyric?id=歌曲ID&lv=1>

```

***

## 八、常见问题

> 文档结束。基于 MiMo V2 TTS 实际测试整理。

