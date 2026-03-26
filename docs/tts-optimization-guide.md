# MiMo TTS 优化指南

## 概述

本文档总结了如何优化小米 MiMo TTS 生成的语音质量，确保输出与输入完全一致，并避免常见问题。

## 问题分析

### 常见问题

1. **漏掉句子** - 模型可能跳过某些内容
2. **重复句子** - 模型可能重复某些内容
3. **音色不一致** - 长文本生成时音色变化
4. **突兀的拼接声** - 多段音频拼接时的电子声音
5. **停顿不自然** - 段落间停顿过长或过短

### 问题原因

- 模型注意力机制问题
- 分段处理时上下文丢失
- 音频拼接算法不完善
- 提示词不够明确

## 解决方案

### 1. 一致性提示词

在每次TTS调用中添加一致性提示词：

```javascript
const consistencyPrompt = '请严格按照以下文本朗读，保持音色、语调、情绪、语气、语速完全一致。不要遗漏任何内容，不要重复任何内容，不要添加任何额外内容。';
```

#### 分段处理时的上下文提示

当文本被分割时，为每个段落添加上下文信息：

```javascript
// 这是长文本的第X部分，共Y部分。请保持与其他部分完全一致的语音风格。
```

### 2. 智能分段

#### 分段原则

- 按句子或段落分割
- 每段长度控制在100-500字
- 确保分割点在标点符号处

#### 分段算法

```javascript
function splitIntoSegments(text, maxSegmentLength = 200) {
  // 1. 按换行符分割
  // 2. 按标点符号分割
  // 3. 确保每段长度适中
  // 4. 保持编号和句子的完整性
}
```

### 3. 平滑拼接

#### 淡入淡出效果

为每个音频段落添加淡入淡出：

- **淡入**：480样本（20ms）
- **淡出**：480样本（20ms）

#### 自然静音

创建带有轻微背景噪音的静音，避免完全静音的突兀感：

```javascript
// 添加轻微的随机背景噪音
for (let i = 0; i < numSamples; i++) {
  const noise = Math.random() * 65 - 32; // 非常轻微的噪音
  const sample = Math.max(-32768, Math.min(32767, Math.round(noise)));
  pcmBuffer.writeInt16LE(sample, i * 2);
}
```

### 4. 智能停顿

根据文本内容自动调整停顿时间：

- 句号：300-500ms
- 逗号：100-200ms
- 段落间：500-1000ms

### 5. 自动校验

使用ASR（语音识别）技术校验生成的语音：

```javascript
// 1. 将音频转换为文字
// 2. 与原始文本对比
// 3. 计算相似度
// 4. 如果相似度低于阈值，自动重试
```

## 代码实现

### 优化后的TTS调用

```javascript
async function callTTS({ text, style, voice, apiKey, speed, pitch, volume, segmentIndex, totalSegments }) {
  // 确保一致性的系统提示词
  let consistencyPrompt = '请严格按照以下文本朗读，保持音色、语调、情绪、语气、语速完全一致。不要遗漏任何内容，不要重复任何内容，不要添加任何额外内容。';
  
  // 如果是分段处理，添加上下文信息
  if (typeof segmentIndex === 'number' && typeof totalSegments === 'number' && totalSegments > 1) {
    consistencyPrompt += ` 这是长文本的第${segmentIndex + 1}部分，共${totalSegments}部分。请保持与其他部分完全一致的语音风格。`;
  }
  
  // 构建完整的提示词
  let fullStyle = consistencyPrompt;
  if (style) {
    fullStyle = `${consistencyPrompt} ${style}`;
  }
  
  const content = `<style>${fullStyle}</style>${text}`;
  
  // 调用API...
}
```

### 平滑拼接实现

```javascript
function smoothConcat(pcmBuffers, silenceBuffer = null) {
  // 1. 为每个段落应用淡入淡出
  // 2. 拼接段落和静音
  // 3. 确保平滑过渡
}
```

## 参数调优建议

### 语速

- 默认：1.0
- 快速：1.2-1.5
- 慢速：0.7-0.9

### 音高

- 默认：0
- 低沉：-5到-2
- 高亢：2到5

### 音量

- 默认：100
- 大声：120-150
- 小声：70-90

### 温度 (Temperature)

- 默认：0.3（更精准）
- 更精准：0.1-0.3
- 更随机：0.5-0.8
- 更创造性：0.8-1.0

**说明**：
- 较低的温度值（如0.3）使输出更加精准和一致
- 较高的温度值增加输出的多样性和随机性
- 对于TTS语音合成，建议使用0.1-0.3的温度值以获得最佳质量

### 停顿

- 默认：300ms
- 短停顿：100-200ms
- 长停顿：500-1000ms

## 测试和验证

### 测试流程

1. **生成测试**：使用不同长度的文本测试
2. **一致性测试**：检查多段文本生成的一致性
3. **拼接测试**：验证段落拼接效果
4. **校验测试**：使用ASR验证文本完整性

### 测试脚本

```javascript
// 测试不同长度的文本
const testCases = [
  { text: "短文本测试", length: "short" },
  { text: "中等长度文本测试...", length: "medium" },
  { text: "长文本测试...", length: "long" },
];

// 测试一致性
const consistencyTests = [
  { text: "相同的测试文本", times: 5 },
];

// 测试拼接
const concatenationTests = [
  { segments: 3, pauseMs: 300 },
  { segments: 5, pauseMs: 500 },
];
```

## 监控和日志

### 关键指标

- **相似度**：ASR识别结果与原始文本的相似度
- **处理时间**：每个段落的处理时间
- **错误率**：失败的段落数量
- **重试次数**：需要重试的段落数量

### 日志记录

```javascript
console.log(`[INFO] 开始生成语音: 文本长度=${text}字`);
console.log(`[DEBUG] 分割成 ${segments.length} 个段落`);
console.log(`[DEBUG] 段落 ${i + 1} 处理成功`);
console.log(`[WARN] 段落 ${i + 1} 处理失败，重试中...`);
console.log(`[INFO] 校验完成: 相似度=${similarity}%`);
```

## 故障排除

### 问题：漏掉句子

**解决方案**：
1. 检查分段逻辑是否正确
2. 增加一致性提示词
3. 使用校验功能检测
4. 调整段落长度

### 问题：重复句子

**解决方案**：
1. 检查是否有重复的段落
2. 调整分段参数
3. 使用更明确的提示词

### 问题：音色不一致

**解决方案**：
1. 使用相同的一致性提示词
2. 添加分段上下文信息
3. 调整语速、音高等参数

### 问题：拼接声音突兀

**解决方案**：
1. 启用淡入淡出效果
2. 使用自然静音
3. 调整停顿时间

### 问题：停顿不自然

**解决方案**：
1. 根据标点符号调整停顿
2. 使用智能停顿算法
3. 手动调整停顿参数

## 最佳实践

### 1. 长文本处理

- 分段长度：200-500字
- 使用一致性提示词
- 启用自动校验
- 设置合理的重试次数

### 2. 质量优先

- 优先使用WAV格式
- 适当降低语速以提高清晰度
- 使用校验功能确保完整性

### 3. 性能优化

- 缓存常用文本的音频
- 批量处理多个请求
- 使用异步处理

### 4. 用户体验

- 提供进度反馈
- 允许用户调整参数
- 保存用户偏好设置

## 配置示例

### 环境变量

```bash
# API配置
MIMO_API_KEY=your_api_key
MIMO_API_ENDPOINT=https://api.xiaomimimo.com/v1/chat/completions
MIMO_TTS_MODEL=mimo-v2-audio-tts

# 一致性提示词
MIMO_CONSISTENCY_PROMPT=请严格按照以下文本朗读，保持音色、语调、情绪、语气、语速完全一致。不要遗漏任何内容，不要重复任何内容，不要添加任何额外内容。

# 服务配置
PORT=3210
```

### 项目配置

```json
{
  "tts": {
    "defaultVoice": "mimo_default",
    "defaultSpeed": 1.0,
    "defaultPauseMs": 300,
    "maxSegmentLength": 200,
    "enableVerification": true,
    "similarityThreshold": 0.95
  }
}
```

## 性能基准

### 测试环境

- 文本长度：1000字
- 分段数：5段
- 停顿：300ms

### 预期结果

- 处理时间：< 30秒
- 相似度：> 95%
- 文件大小：~1MB（WAV格式）

## 更新记录

- **2026-03-21**：添加一致性提示词
- **2026-03-21**：优化拼接算法
- **2026-03-21**：添加自动校验功能