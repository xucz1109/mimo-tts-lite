#!/usr/bin/env node
/**
 * MiMo TTS Lite — Backend Server
 *
 * Env vars:
 *   MIMO_API_KEY          (required) MiMo platform API key
 *   MIMO_API_ENDPOINT     (optional) Override API endpoint
 *   MIMO_TTS_MODEL        (optional) Override TTS model name
 *   MIMO_PROOFREAD_MODEL  (optional) Override proofread text model (default: mimo-v2-pro)
 *   MIMO_CONSISTENCY_PROMPT (optional) Custom consistency prompt for TTS
 *   PORT                  (optional) HTTP port, default 3210
 */

const express = require('express');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

const app = express();
const PORT = process.env.PORT || 3210;

// ── 日志和音频输出目录 ───────────────────────────────────────────────────────
const LOGS_DIR = path.join(__dirname, 'logs');
const AUDIO_OUTPUT_DIR = path.join(__dirname, 'audio_output');

// 确保目录存在
if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}
if (!fs.existsSync(AUDIO_OUTPUT_DIR)) {
  fs.mkdirSync(AUDIO_OUTPUT_DIR, { recursive: true });
}

app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ── Health ─────────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  const hasKey = !!process.env.MIMO_API_KEY || hasOpenClawKey();
  res.json({ status: 'ok', hasApiKey: hasKey });
});

// ── 进度状态管理 ───────────────────────────────────────────────────────────
const progressStore = new Map();

// 清理过期的进度记录（5分钟前）
setInterval(() => {
  const now = Date.now();
  for (const [taskId, progress] of progressStore.entries()) {
    if (now - progress.updatedAt > 5 * 60 * 1000) {
      progressStore.delete(taskId);
    }
  }
}, 60000); // 每分钟清理一次

// 创建进度记录
function createProgress(taskId, totalSegments) {
  progressStore.set(taskId, {
    taskId,
    totalSegments,
    currentSegment: 0,
    currentSegmentText: '',
    status: 'initializing',
    message: '正在初始化...',
    percent: 0,
    startedAt: Date.now(),
    updatedAt: Date.now(),
    completed: false,
  });
}

// 更新进度
function updateProgress(taskId, updates) {
  const progress = progressStore.get(taskId);
  if (progress) {
    Object.assign(progress, updates, { updatedAt: Date.now() });
  }
}

// 获取进度
function getProgress(taskId) {
  return progressStore.get(taskId);
}

// ── 进度查询端点 ───────────────────────────────────────────────────────────
app.get('/api/progress/:taskId', (req, res) => {
  const { taskId } = req.params;
  const progress = getProgress(taskId);
  
  if (!progress) {
    return res.status(404).json({ error: '任务不存在或已过期' });
  }
  
  res.json(progress);
});

function hasOpenClawKey() {
  const p = path.join(os.homedir(), '.openclaw', 'openclaw.json');
  try {
    if (fs.existsSync(p)) {
      const cfg = JSON.parse(fs.readFileSync(p, 'utf8'));
      return !!cfg.models?.providers?.xiaomi?.apiKey;
    }
  } catch {}
  return false;
}

function getApiKey() {
  if (process.env.MIMO_API_KEY) return process.env.MIMO_API_KEY;
  const p = path.join(os.homedir(), '.openclaw', 'openclaw.json');
  try {
    const cfg = JSON.parse(fs.readFileSync(p, 'utf8'));
    return cfg.models?.providers?.xiaomi?.apiKey;
  } catch {}
  return null;
}

// ── 文本分割函数 ───────────────────────────────────────────────────────────
function splitTextByLines(text, maxCharsPerSegment = 150) {
  const lines = text.split('\n');
  const segments = [];
  let currentSegment = '';
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // 跳过空行
    if (!trimmedLine) {
      continue;
    }
    
    // 如果当前行加上现有内容超过限制，先保存当前段落
    if (currentSegment && (currentSegment.length + trimmedLine.length > maxCharsPerSegment)) {
      segments.push(currentSegment.trim());
      currentSegment = trimmedLine;
    } else {
      // 合并到当前段落
      currentSegment = currentSegment ? currentSegment + '\n' + trimmedLine : trimmedLine;
    }
  }
  
  // 保存最后一个段落
  if (currentSegment.trim()) {
    segments.push(currentSegment.trim());
  }
  
  return segments;
}

// ── 请求日志记录函数 ───────────────────────────────────────────────────────
function writeRequestLog(taskId, logData) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const logFilename = `tts_log_${taskId}_${timestamp}.json`;
  const logPath = path.join(LOGS_DIR, logFilename);
  
  const logContent = {
    taskId,
    timestamp: new Date().toISOString(),
    ...logData
  };
  
  fs.writeFileSync(logPath, JSON.stringify(logContent, null, 2), 'utf8');
  console.log(`[LOG] 请求日志已保存: ${logFilename}`);
  return logFilename;
}

// ── 保存音频文件函数 ───────────────────────────────────────────────────────
function saveAudioFile(taskId, segmentIndex, audioBuffer, format = 'wav') {
  const filename = `${taskId}_segment_${String(segmentIndex).padStart(3, '0')}.${format}`;
  const filePath = path.join(AUDIO_OUTPUT_DIR, filename);
  fs.writeFileSync(filePath, audioBuffer);
  console.log(`[SAVE] 音频片段已保存: ${filename} (${(audioBuffer.length / 1024).toFixed(1)}KB)`);
  return { filename, filePath };
}

// ── 合并多个WAV音频文件 ────────────────────────────────────────────────────
function mergeWavFiles(wavBuffers, silenceDurationMs = 300) {
  if (wavBuffers.length === 0) return Buffer.alloc(0);
  if (wavBuffers.length === 1) return wavBuffers[0];
  
  // 提取所有PCM数据
  const pcmBuffers = [];
  for (const wavBuffer of wavBuffers) {
    const pcm = extractPcm(wavBuffer);
    if (pcm && pcm.length > 0) {
      pcmBuffers.push(pcm);
    }
  }
  
  if (pcmBuffers.length === 0) return Buffer.alloc(0);
  if (pcmBuffers.length === 1) return buildWav(pcmBuffers[0]);
  
  // 创建静音PCM
  const silenceSamples = Math.floor(SAMPLE_RATE * silenceDurationMs / 1000);
  const silencePcm = Buffer.alloc(silenceSamples * 2);
  
  // 合并所有PCM，中间加入静音
  const mergedPcm = smoothConcat(pcmBuffers, silencePcm);
  
  return buildWav(mergedPcm);
}

// ── 合并多个音频文件为单个MP3 ──────────────────────────────────────────────
function mergeAudioToMp3(wavBuffers, taskId) {
  const tmpDir = os.tmpdir();
  const tempFiles = [];
  
  try {
    // 保存所有WAV到临时文件
    for (let i = 0; i < wavBuffers.length; i++) {
      const wavPath = path.join(tmpDir, `merge_${taskId}_${i}.wav`);
      fs.writeFileSync(wavPath, wavBuffers[i]);
      tempFiles.push(wavPath);
    }
    
    // 创建ffmpeg输入文件列表
    const listPath = path.join(tmpDir, `merge_${taskId}_list.txt`);
    const listContent = tempFiles.map(p => `file '${p.replace(/'/g, "'\\''")}'`).join('\n');
    fs.writeFileSync(listPath, listContent);
    
    // 输出MP3路径
    const outputPath = path.join(AUDIO_OUTPUT_DIR, `${taskId}_merged.mp3`);
    
    // 使用ffmpeg合并
    execFileSync('ffmpeg', [
      '-y',
      '-f', 'concat',
      '-safe', '0',
      '-i', listPath,
      '-codec:a', 'libmp3lame',
      '-b:a', '128k',
      '-ar', '24000',
      '-ac', '1',
      outputPath
    ], { timeout: 60000, stdio: 'pipe' });
    
    const mergedBuffer = fs.readFileSync(outputPath);
    console.log(`[MERGE] 音频合并完成: ${taskId}_merged.mp3 (${(mergedBuffer.length / 1024).toFixed(1)}KB)`);
    
    return {
      filename: `${taskId}_merged.mp3`,
      filePath: outputPath,
      buffer: mergedBuffer
    };
  } finally {
    // 清理临时文件
    for (const tempFile of tempFiles) {
      try { fs.unlinkSync(tempFile); } catch {}
    }
    try { fs.unlinkSync(path.join(tmpDir, `merge_${taskId}_list.txt`)); } catch {}
  }
}

// ── WAV builder ────────────────────────────────────────────────────────────
const SAMPLE_RATE = 24000;
const BITS_PER_SAMPLE = 16;
const CHANNELS = 1;

function buildWav(pcmBuffer, sampleRate = SAMPLE_RATE, bitsPerSample = BITS_PER_SAMPLE, channels = CHANNELS) {
  const byteRate = sampleRate * channels * bitsPerSample / 8;
  const blockAlign = channels * bitsPerSample / 8;
  const dataSize = pcmBuffer.length;
  const headerSize = 44;
  const buf = Buffer.alloc(headerSize + dataSize);

  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(channels, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(byteRate, 28);
  buf.writeUInt16LE(blockAlign, 32);
  buf.writeUInt16LE(bitsPerSample, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(dataSize, 40);
  pcmBuffer.copy(buf, headerSize);

  return buf;
}

function buildSilenceWav(durationMs, sampleRate = SAMPLE_RATE) {
  const numSamples = Math.floor(sampleRate * durationMs / 1000);
  const pcmBuffer = Buffer.alloc(numSamples * 2);
  
  // 添加轻微的随机背景噪音，避免完全静音的突兀感
  for (let i = 0; i < numSamples; i++) {
    // 创建非常轻微的背景噪音（音量约为最大音量的0.1%）
    const noise = Math.random() * 65 - 32; // 范围-32到33，非常小
    const sample = Math.max(-32768, Math.min(32767, Math.round(noise)));
    pcmBuffer.writeInt16LE(sample, i * 2);
  }
  
  return buildWav(pcmBuffer, sampleRate);
}

function extractPcm(wavBuffer) {
  if (wavBuffer.slice(0, 4).toString() === 'RIFF') {
    return wavBuffer.slice(44);
  }
  return wavBuffer;
}

// ── 应用淡入淡出效果 ──────────────────────────────────────────────────────
function applyFadeInFadeOut(pcmBuffer, fadeInSamples = 480, fadeOutSamples = 480) {
  if (!pcmBuffer || pcmBuffer.length === 0) return pcmBuffer;
  
  const numSamples = pcmBuffer.length / 2;
  const result = Buffer.from(pcmBuffer);
  
  // 淡入效果
  const actualFadeIn = Math.min(fadeInSamples, numSamples);
  for (let i = 0; i < actualFadeIn; i++) {
    const gain = i / actualFadeIn;
    const sample = result.readInt16LE(i * 2);
    const faded = Math.round(sample * gain);
    result.writeInt16LE(Math.max(-32768, Math.min(32767, faded)), i * 2);
  }
  
  // 淡出效果
  const actualFadeOut = Math.min(fadeOutSamples, numSamples);
  const fadeOutStart = numSamples - actualFadeOut;
  for (let i = fadeOutStart; i < numSamples; i++) {
    const gain = (numSamples - i) / actualFadeOut;
    const sample = result.readInt16LE(i * 2);
    const faded = Math.round(sample * gain);
    result.writeInt16LE(Math.max(-32768, Math.min(32767, faded)), i * 2);
  }
  
  return result;
}

// ── 平滑拼接音频段 ────────────────────────────────────────────────────────
function smoothConcat(pcmBuffers, silenceBuffer = null) {
  if (pcmBuffers.length === 0) return Buffer.alloc(0);
  if (pcmBuffers.length === 1) return pcmBuffers[0];
  
  const result = [];
  
  for (let i = 0; i < pcmBuffers.length; i++) {
    const buffer = pcmBuffers[i];
    if (!buffer || buffer.length === 0) continue;
    
    // 为每个段落应用淡入淡出效果（除了第一个段落的淡入和最后一个段落的淡出）
    let processedBuffer = buffer;
    
    if (i > 0) {
      // 不是第一个段落，应用淡入效果
      processedBuffer = applyFadeInFadeOut(buffer, 480, 0);
    }
    
    if (i < pcmBuffers.length - 1) {
      // 不是最后一个段落，应用淡出效果
      processedBuffer = applyFadeInFadeOut(processedBuffer, 0, 480);
    }
    
    result.push(processedBuffer);
    
    // 添加静音停顿（除了最后一个段落）
    if (i < pcmBuffers.length - 1 && silenceBuffer && silenceBuffer.length > 0) {
      // 对静音也应用淡入淡出效果，使其更自然
      const processedSilence = applyFadeInFadeOut(silenceBuffer, 240, 240);
      result.push(processedSilence);
    }
  }
  
  return Buffer.concat(result);
}

// ── Core TTS function ──────────────────────────────────────────────────────
async function callTTS({ text, style, voice, apiKey, speed, pitch, volume }) {
  if (!text || text.trim().length === 0) {
    throw new Error('文本为空，无法生成语音');
  }
  
  const endpoint = process.env.MIMO_API_ENDPOINT || 'https://api.xiaomimimo.com/v1/chat/completions';
  const model = process.env.MIMO_TTS_MODEL || 'mimo-v2-tts';

  // 构建提示词
  let fullStyle = process.env.MIMO_CONSISTENCY_PROMPT || '语速稳定，保持匀速朗读，前后语速一致';
  if (style) {
    fullStyle = fullStyle ? `${fullStyle} ${style}` : style;
  }
  
  const body = {
    model,
    messages: [
      { role: 'user', content: `${fullStyle} 请朗读` },
      { role: 'assistant', content: text }
    ],
    modalities: ['text', 'audio'],
    audio: { format: 'wav', voice: voice || 'mimo_default' },
    temperature: 0.3,
  };

  if (speed && speed !== 1) body.audio.speed = speed;
  if (pitch && pitch !== 0) body.audio.pitch = pitch;
  if (volume && volume !== 100) body.audio.volume = volume;

  console.log(`[DEBUG] 调用TTS API: 模型=${model}, 文本长度=${text.length}字, 语音=${voice || 'mimo_default'}`);
  
  const startTime = Date.now();
  const resp = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': apiKey,
    },
    body: JSON.stringify(body),
  });
  const elapsed = Date.now() - startTime;

  if (!resp.ok) {
    const errText = await resp.text().catch(() => '');
    let errMsg = `API returned HTTP ${resp.status}`;
    try {
      const errJson = JSON.parse(errText);
      if (errJson.error) {
        errMsg = typeof errJson.error === 'string' ? errJson.error : JSON.stringify(errJson.error);
      }
    } catch {}
    const error = new Error(errMsg);
    error.httpStatus = resp.status;
    throw error;
  }

  const data = await resp.json();

  if (data.error) {
    throw new Error(typeof data.error === 'string' ? data.error : JSON.stringify(data.error));
  }

  const audioData = data?.choices?.[0]?.message?.audio?.data;
  if (!audioData) {
    throw new Error('API返回的音频数据为空');
  }

  const raw = Buffer.from(audioData, 'base64');
  
  if (raw.length === 0) {
    throw new Error('音频数据解码后为空');
  }
  
  console.log(`[DEBUG] TTS API调用成功: 音频大小=${(raw.length / 1024).toFixed(1)}KB, 耗时=${elapsed}ms`);

  let wavBuffer;
  if (raw.slice(0, 4).toString() === 'RIFF') {
    wavBuffer = raw;
  } else {
    wavBuffer = buildWav(raw);
  }

  // 返回结果包含请求信息，用于日志记录
  return {
    audioBuffer: wavBuffer,
    requestInfo: {
      endpoint,
      requestBody: body,
      responseTime: elapsed,
      audioSize: wavBuffer.length
    }
  };
}







// ── Convert WAV to MP3 via ffmpeg ──────────────────────────────────────────
function convertToMp3(wavBuffer) {
  const tmpDir = os.tmpdir();
  const id = crypto.randomUUID();
  const wavPath = path.join(tmpDir, `conv_${id}.wav`);
  const mp3Path = path.join(tmpDir, `conv_${id}.mp3`);

  try {
    fs.writeFileSync(wavPath, wavBuffer);
    execFileSync('ffmpeg', [
      '-y', '-i', wavPath,
      '-codec:a', 'libmp3lame',
      '-b:a', '128k',
      '-ar', '24000',
      '-ac', '1',
      mp3Path,
    ], { timeout: 30000, stdio: 'pipe' });

    return fs.readFileSync(mp3Path);
  } finally {
    try { fs.unlinkSync(wavPath); } catch {}
    try { fs.unlinkSync(mp3Path); } catch {}
  }
}

// ── Proofread endpoint ─────────────────────────────────────────────────────
app.post('/api/proofread', async (req, res) => {
  try {
    const { text, apiKey: bodyApiKey } = req.body;

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return res.status(400).json({ error: 'text is required' });
    }
    if (text.length > 10000) {
      return res.status(400).json({ error: 'text too long (max 10000 chars)' });
    }

    const apiKey = (bodyApiKey && bodyApiKey.trim()) || getApiKey();
    if (!apiKey) {
      return res.status(400).json({ error: 'API Key 未配置，请在页面输入 MiMo API Key' });
    }

    const endpoint = process.env.MIMO_API_ENDPOINT || 'https://api.xiaomimimo.com/v1/chat/completions';
    const model = process.env.MIMO_PROOFREAD_MODEL || 'mimo-v2-pro';

    const prompt = `你是一个中文文本校对助手。请对以下文本做两项检查：

1. **不通顺**：找出读起来拗口、搭配不当、语法有误的字词或短语，给出修改建议。
2. **多音字**：找出文中出现的所有多音字，标注其在当前语境下的读音，如果读音可能引起歧义则提示。

要求：
- 只返回 JSON，不要输出任何其他内容
- JSON 格式：
{
  "awkward":[{"position":"不通顺的位置","original":"原文","suggestion":"修改建议","reason":"原因"}],
  "polyphonic":[{"character":"多音字","pinyin":"当前读音","context":"所在词/句","note":"说明"}],
  "summary":"总体评价"
}
- 如果某类没有问题，对应数组为空
- 不通顺：只指出明确不通顺的地方，不要过度修改
- 多音字：列出文中所有多音字，不要遗漏

待校对文本：
${text.trim()}`;

    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      let errMsg = `API returned HTTP ${resp.status}`;
      try {
        const errJson = JSON.parse(errText);
        if (errJson.error) {
          errMsg = typeof errJson.error === 'string' ? errJson.error : JSON.stringify(errJson.error);
        }
      } catch {}
      const error = new Error(errMsg);
      error.httpStatus = resp.status;
      throw error;
    }

    const data = await resp.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('Unexpected API response: no content found');
    }

    let result;
    try {
      const jsonStr = content.replace(/```json?\s*/g, '').replace(/```/g, '').trim();
      result = JSON.parse(jsonStr);
    } catch {
      result = { awkward: [], polyphonic: [], summary: content };
    }

    return res.json({ success: true, ...result });
  } catch (err) {
    console.error('Proofread error:', err);
    let userMsg = err.message;
    const status = err.httpStatus;
    if (status === 402 || userMsg.includes('insufficient_balance') || userMsg.includes('Insufficient')) {
      userMsg = '❌ MiMo 账号余额不足，请前往 xiaomimimo.com 充值后重试';
    } else if (status === 401 || userMsg.includes('Unauthorized') || userMsg.includes('invalid')) {
      userMsg = '❌ API Key 无效，请检查输入是否正确';
    } else if (status === 429 || userMsg.includes('rate')) {
      userMsg = '❌ 请求过于频繁，请稍后重试';
    }
    return res.status(500).json({ error: userMsg });
  }
});

// ── 验证音频是否包含所有文本内容（简单估算） ──────────────────────────────
function validateAudioCoverage(text, audioBuffer) {
  // 简单的验证：根据文本长度估算音频应有的最小大小
  // 中文平均语速约250字/分钟，24kHz采样率，16bit，单声道
  // 每字约 24000 * 2 / (250/60) ≈ 11520 字节/字
  const minBytesPerChar = 200; // 考虑压缩，实际会小一些
  const expectedMinSize = text.length * minBytesPerChar;
  
  const actualSize = audioBuffer.length;
  const coverageRatio = actualSize / expectedMinSize;
  
  console.log(`[DEBUG] 音频验证: 文本=${text.length}字, 音频=${(actualSize/1024).toFixed(1)}KB, 覆盖率=${(coverageRatio*100).toFixed(1)}%`);
  
  // 如果音频大小明显小于预期，可能漏掉了内容
  if (coverageRatio < 0.3) {
    console.warn(`[WARN] 音频大小可能过小，可能漏掉了部分内容`);
    return false;
  }
  
  return true;
}



// ── 文本相似度计算 ─────────────────────────────────────────────────────────
function calculateTextSimilarity(text1, text2) {
  if (!text1 || !text2) return 0;
  
  // 去除标点符号和空白字符
  const normalize = (text) => {
    return text.replace(/[。！？!?；;…，,：:（）()【】[\]《》<>""]/g, '')
               .replace(/\s+/g, '')
               .replace(/\n/g, '')
               .replace(/\t/g, '')
               .trim();
  };
  
  const norm1 = normalize(text1);
  const norm2 = normalize(text2);
  
  if (norm1 === norm2) return 1;
  if (norm1.length === 0 || norm2.length === 0) return 0;
  
  // 使用编辑距离计算相似度
  const matrix = [];
  const len1 = norm1.length;
  const len2 = norm2.length;
  
  // 初始化矩阵
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }
  
  // 计算编辑距离
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = norm1[i - 1] === norm2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  
  const distance = matrix[len1][len2];
  const maxLength = Math.max(len1, len2);
  
  return 1 - distance / maxLength;
}

// ── 使用Whisper API进行语音识别（可替换为其他ASR服务） ───────────────────
async function transcribeAudio(audioBuffer, apiKey, provider = 'whisper') {
  console.log(`[DEBUG] 开始语音识别，音频大小: ${(audioBuffer.length / 1024).toFixed(1)}KB，提供商: ${provider}`);
  
  if (provider === 'whisper' && apiKey) {
    // 使用OpenAI Whisper API
    const endpoint = 'https://api.openai.com/v1/audio/transcriptions';
    
    // 创建FormData
    const formData = new FormData();
    formData.append('file', new Blob([audioBuffer], { type: 'audio/wav' }), 'audio.wav');
    formData.append('model', 'whisper-1');
    formData.append('language', 'zh');
    
    try {
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
        body: formData,
      });
      
      if (!resp.ok) {
        const errText = await resp.text().catch(() => '');
        throw new Error(`Whisper API错误 (${resp.status}): ${errText}`);
      }
      
      const data = await resp.json();
      return {
        text: data.text || '',
        confidence: 1, // Whisper不返回置信度
      };
    } catch (err) {
      console.error('Whisper API调用失败:', err.message);
      throw err;
    }
  }
  
  if (provider === 'baidu' && apiKey) {
    // 使用百度语音识别API
    // 需要配置 app_id 和 app_key
    const [appId, appKey] = apiKey.split(':');
    if (!appId || !appKey) {
      throw new Error('百度API需要格式: app_id:app_key');
    }
    
    // 百度API实现（简化版本）
    // 实际使用时需要实现完整的百度API调用
    throw new Error('百度语音识别API尚未实现，请使用Whisper或本地识别');
  }
  
  // 默认：返回错误，提示用户配置ASR
  throw new Error('未配置ASR API。请提供asrApiKey参数，或使用asrProvider指定其他提供商');
}

// ── 使用本地Whisper进行语音识别（需要安装whisper-cpp或openai-whisper） ────
async function transcribeAudioLocal(audioBuffer) {
  const { execFileSync } = require('child_process');
  const fs = require('fs');
  const path = require('path');
  const os = require('os');
  
  const tmpDir = os.tmpdir();
  const id = crypto.randomUUID();
  const wavPath = path.join(tmpDir, `verify_${id}.wav`);
  
  try {
    // 保存音频到临时文件
    fs.writeFileSync(wavPath, audioBuffer);
    
    // 尝试使用whisper命令行工具
    // 需要安装: https://github.com/ggerganov/whisper.cpp
    try {
      const result = execFileSync('whisper', [
        wavPath,
        '--model', 'base',
        '--language', 'zh',
        '--output-format', 'txt',
        '--output-dir', tmpDir,
      ], { timeout: 60000, stdio: 'pipe' });
      
      // 读取输出文件
      const txtPath = path.join(tmpDir, path.basename(wavPath, '.wav') + '.txt');
      if (fs.existsSync(txtPath)) {
        const text = fs.readFileSync(txtPath, 'utf8').trim();
        fs.unlinkSync(txtPath);
        return { text, confidence: 0.8 };
      }
    } catch (err) {
      console.log('whisper命令行不可用，尝试其他方法...');
    }
    
    // 如果whisper命令行不可用，尝试使用Python的whisper
    try {
      const result = execFileSync('python', [
        '-c',
        `
import whisper
import sys
model = whisper.load_model("base")
result = model.load_audio("${wavPath.replace(/\\/g, '\\\\')}")
transcription = model.transcribe(result, language="zh")
print(transcription["text"])
        `
      ], { timeout: 120000, encoding: 'utf8' });
      
      const text = result.trim();
      return { text, confidence: 0.8 };
    } catch (err) {
      console.log('Python whisper不可用:', err.message);
    }
    
    throw new Error('未找到可用的语音识别工具。请安装whisper或配置API');
  } finally {
    // 清理临时文件
    try { fs.unlinkSync(wavPath); } catch {}
  }
}

// ── 校验端点 ───────────────────────────────────────────────────────────────
app.post('/api/verify', async (req, res) => {
  try {
    const { originalText, audioBase64, asrApiKey, asrProvider = 'local' } = req.body;
    
    if (!originalText || !audioBase64) {
      return res.status(400).json({ error: '需要提供原始文本和音频数据' });
    }
    
    console.log(`[INFO] 开始校验: 原始文本长度=${originalText.length}字, ASR提供商=${asrProvider}`);
    
    // 解码音频
    const audioBuffer = Buffer.from(audioBase64, 'base64');
    
    if (audioBuffer.length === 0) {
      return res.status(400).json({ error: '音频数据为空' });
    }
    
    // 使用ASR转换音频为文字
    let asrResult;
    if (asrProvider === 'local') {
      asrResult = await transcribeAudioLocal(audioBuffer);
    } else {
      asrResult = await transcribeAudio(audioBuffer, asrApiKey, asrProvider);
    }
    
    if (!asrResult.text || asrResult.text.trim().length === 0) {
      return res.status(500).json({ error: '语音识别失败，无法提取文字' });
    }
    
    // 计算相似度
    const similarity = calculateTextSimilarity(originalText, asrResult.text);
    
    // 详细分析差异
    const normalizeForCompare = (text) => {
      return text.replace(/[。！？!?；;…，,：:（）()【】[\]《》<>""]/g, '')
                 .replace(/\s+/g, '')
                 .replace(/\n/g, '');
    };
    
    const normOriginal = normalizeForCompare(originalText);
    const normRecognized = normalizeForCompare(asrResult.text);
    
    // 使用字符级对比
    const originalChars = normOriginal.split('');
    const recognizedChars = normRecognized.split('');
    
    // 统计缺失和多余的内容
    const charCount = {};
    for (const char of originalChars) {
      charCount[char] = (charCount[char] || 0) + 1;
    }
    
    for (const char of recognizedChars) {
      if (charCount[char]) {
        charCount[char]--;
      }
    }
    
    const missingChars = [];
    for (const [char, count] of Object.entries(charCount)) {
      if (count > 0) {
        missingChars.push({ char, count });
      }
    }
    
    // 统计重复内容
    const repeatedPattern = /(.{2,})\1+/g;
    const repeatedMatches = asrResult.text.match(repeatedPattern) || [];
    
    console.log(`[INFO] 校验完成: 相似度=${(similarity * 100).toFixed(1)}%`);
    
    return res.json({
      success: true,
      similarity: Math.round(similarity * 100) / 100,
      similarityPercent: `${(similarity * 100).toFixed(1)}%`,
      originalText: originalText.substring(0, 500) + (originalText.length > 500 ? '...' : ''),
      recognizedText: asrResult.text,
      originalLength: originalText.length,
      recognizedLength: asrResult.text.length,
      lengthDiff: asrResult.text.length - originalText.length,
      asrConfidence: asrResult.confidence,
      missingChars: missingChars.slice(0, 20),
      repeatedPatterns: repeatedMatches.slice(0, 10),
      quality: similarity >= 0.9 ? 'excellent' : 
               similarity >= 0.7 ? 'good' : 
               similarity >= 0.5 ? 'fair' : 'poor',
      issues: [
        ...(similarity < 0.7 ? ['相似度较低，可能存在漏读或重复'] : []),
        ...(repeatedMatches.length > 0 ? ['检测到重复内容'] : []),
        ...(missingChars.length > 10 ? ['缺失较多字符'] : []),
        ...(Math.abs(asrResult.text.length - originalText.length) > originalText.length * 0.3 ? ['文本长度差异较大'] : []),
      ],
    });
  } catch (err) {
    console.error('校验错误:', err);
    return res.status(500).json({ error: err.message || '校验失败' });
  }
});

// ── TTS endpoint ───────────────────────────────────────────────────────────
app.post('/api/tts', async (req, res) => {
  const taskId = crypto.randomUUID();
  const startTime = Date.now();
  
  try {
    const {
      text, style, voice,
      apiKey: bodyApiKey,
      speed, pitch, volume,
      format,
    } = req.body;

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return res.status(400).json({ error: 'text is required' });
    }
    if (text.length > 10000) {
      return res.status(400).json({ error: 'text too long (max 10000 chars)' });
    }

    const apiKey = (bodyApiKey && bodyApiKey.trim()) || getApiKey();
    if (!apiKey) {
      return res.status(400).json({ error: 'API Key 未配置，请在页面输入 MiMo API Key' });
    }

    const finalText = text.trim();
    const outFormat = format === 'mp3' ? 'mp3' : 'wav';

    // 分割文本：按换行分割，累计超过150字作为一个请求
    const segments = splitTextByLines(finalText, 150);
    
    console.log(`[INFO] 开始生成语音: 文本长度=${finalText.length}字, 分段数=${segments.length}, 格式=${outFormat}`);

    // 创建进度记录
    createProgress(taskId, segments.length);
    updateProgress(taskId, {
      status: 'initializing',
      message: '正在初始化...',
      percent: 0,
    });

    // 存储所有生成的音频和日志
    const audioBuffers = [];
    const requestLogs = [];
    const segmentFiles = [];

    try {
      // 逐段生成语音
      for (let i = 0; i < segments.length; i++) {
        const segmentText = segments[i];
        const segmentIndex = i + 1;
        
        // 更新进度
        updateProgress(taskId, {
          status: 'generating',
          message: `正在生成第 ${segmentIndex}/${segments.length} 段...`,
          currentSegment: segmentIndex,
          currentSegmentText: segmentText.substring(0, 80) + (segmentText.length > 80 ? '...' : ''),
          percent: Math.round((i / segments.length) * 90),
        });

        console.log(`[INFO] 生成第 ${segmentIndex}/${segments.length} 段: ${segmentText.length}字`);

        // 调用TTS API
        const result = await callTTS({
          text: segmentText,
          style,
          voice,
          apiKey,
          speed,
          pitch,
          volume,
        });

        // 保存音频到本地
        const savedFile = saveAudioFile(taskId, segmentIndex, result.audioBuffer, 'wav');
        segmentFiles.push(savedFile);
        audioBuffers.push(result.audioBuffer);

        // 记录请求日志
        requestLogs.push({
          segmentIndex,
          text: segmentText,
          textLength: segmentText.length,
          audioFilename: savedFile.filename,
          audioSize: result.audioBuffer.length,
          ...result.requestInfo
        });

        // 短暂延迟，避免请求过于频繁
        if (i < segments.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      // 更新进度 - 合并阶段
      updateProgress(taskId, {
        status: 'merging',
        message: '正在合并音频...',
        percent: 95,
      });

      // 合并所有音频
      let finalBuffer;
      let finalFilename;
      
      if (audioBuffers.length === 1) {
        // 只有一个片段，直接转换格式
        if (outFormat === 'mp3') {
          finalBuffer = convertToMp3(audioBuffers[0]);
          finalFilename = `${taskId}_merged.mp3`;
          // 保存合并后的MP3
          fs.writeFileSync(path.join(AUDIO_OUTPUT_DIR, finalFilename), finalBuffer);
        } else {
          finalBuffer = audioBuffers[0];
          finalFilename = segmentFiles[0].filename;
        }
      } else {
        // 多个片段，合并后转换
        const mergeResult = mergeAudioToMp3(audioBuffers, taskId);
        if (outFormat === 'mp3') {
          finalBuffer = mergeResult.buffer;
          finalFilename = mergeResult.filename;
        } else {
          // 合并为WAV
          const mergedWav = mergeWavFiles(audioBuffers);
          finalBuffer = mergedWav;
          finalFilename = `${taskId}_merged.wav`;
          fs.writeFileSync(path.join(AUDIO_OUTPUT_DIR, finalFilename), finalBuffer);
        }
      }

      // 写入完整的请求日志
      const logFilename = writeRequestLog(taskId, {
        totalSegments: segments.length,
        totalTextLength: finalText.length,
        outputFormat: outFormat,
        finalAudioFilename: finalFilename,
        finalAudioSize: finalBuffer.length,
        totalTimeMs: Date.now() - startTime,
        segments: requestLogs,
        settings: { style, voice, speed, pitch, volume }
      });

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`[INFO] 语音生成完成: ${segments.length}段, 文件大小=${(finalBuffer.length/1024).toFixed(1)}KB, 格式=${outFormat}, 耗时=${elapsed}s`);

      // 更新进度 - 完成
      updateProgress(taskId, {
        status: 'completed',
        message: '生成完成！',
        percent: 100,
        completed: true,
      });

      return res.json({
        success: true,
        audio: finalBuffer.toString('base64'),
        size: finalBuffer.length,
        filename: finalFilename,
        format: outFormat,
        mimeType: outFormat === 'mp3' ? 'audio/mpeg' : 'audio/wav',
        taskId: taskId,
        segments: segments.length,
        logFilename: logFilename,
      });

    } catch (err) {
      // 更新进度 - 错误
      updateProgress(taskId, {
        status: 'error',
        message: `错误: ${err.message}`,
        percent: 100,
        completed: true,
      });
      
      // 写入错误日志
      writeRequestLog(taskId, {
        error: true,
        errorMessage: err.message,
        totalSegments: segments.length,
        completedSegments: audioBuffers.length,
        totalTimeMs: Date.now() - startTime,
        segments: requestLogs,
      });
      
      let userMsg = err.message;
      const status = err.httpStatus;
      if (status === 402 || userMsg.includes('insufficient_balance') || userMsg.includes('Insufficient')) {
        userMsg = '❌ MiMo 账号余额不足，请前往 xiaomimimo.com 充值后重试';
      } else if (status === 401 || userMsg.includes('Unauthorized') || userMsg.includes('invalid')) {
        userMsg = '❌ API Key 无效，请检查输入是否正确';
      } else if (status === 429 || userMsg.includes('rate')) {
        userMsg = '❌ 请求过于频繁，请稍后重试';
      }
      return res.status(500).json({ error: userMsg });
    }

  } catch (err) {
    console.error('TTS错误:', err);
    return res.status(500).json({ error: err.message || '内部错误' });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🎙️  MiMo TTS Lite listening on http://localhost:${PORT}`);
});
