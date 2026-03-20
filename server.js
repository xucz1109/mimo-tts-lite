#!/usr/bin/env node
/**
 * MiMo TTS Lite — Backend Server
 *
 * Env vars:
 *   MIMO_API_KEY          (required) MiMo platform API key
 *   MIMO_API_ENDPOINT     (optional) Override API endpoint
 *   MIMO_TTS_MODEL        (optional) Override TTS model name
 *   MIMO_PROOFREAD_MODEL  (optional) Override proofread text model (default: mimo-v2-pro)
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

app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ── Health ─────────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  const hasKey = !!process.env.MIMO_API_KEY || hasOpenClawKey();
  res.json({ status: 'ok', hasApiKey: hasKey });
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

// ── WAV builder (wrap raw PCM into WAV) ────────────────────────────────────
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

// Generate silent WAV of given duration (ms)
function buildSilenceWav(durationMs, sampleRate = SAMPLE_RATE) {
  const numSamples = Math.floor(sampleRate * durationMs / 1000);
  const pcmBuffer = Buffer.alloc(numSamples * 2);
  return buildWav(pcmBuffer, sampleRate);
}

// Extract PCM data from WAV buffer (skip 44-byte header)
function extractPcm(wavBuffer) {
  if (wavBuffer.slice(0, 4).toString() === 'RIFF') {
    return wavBuffer.slice(44);
  }
  return wavBuffer;
}

// ── Core TTS function ──────────────────────────────────────────────────────
async function callTTS({ text, apiKey, speed, pitch, volume }) {
  const endpoint = process.env.MIMO_API_ENDPOINT || 'https://api.xiaomimimo.com/v1/chat/completions';
  const model = process.env.MIMO_TTS_MODEL || 'mimo-v2-audio-tts';

  const body = {
    model,
    messages: [{ role: 'assistant', content: text }],
    audio: { format: 'wav', voice: 'mimo_default' },
  };

  if (speed && speed !== 1) body.audio.speed = speed;
  if (pitch && pitch !== 0) body.audio.pitch = pitch;
  if (volume && volume !== 100) body.audio.volume = volume;

  const resp = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': apiKey,
    },
    body: JSON.stringify(body),
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

  if (data.error) {
    throw new Error(typeof data.error === 'string' ? data.error : JSON.stringify(data.error));
  }

  const audioData = data?.choices?.[0]?.message?.audio?.data;
  if (!audioData) {
    throw new Error('Unexpected API response: no audio data found');
  }

  const raw = Buffer.from(audioData, 'base64');

  if (raw.slice(0, 4).toString() === 'RIFF') {
    return raw;
  }
  return buildWav(raw);
}

// ── Multi-line with pause between segments ─────────────────────────────────
async function callTTSWithPause({ text, apiKey, pauseMs, speed, pitch, volume }) {
  const lines = text.split(/\n/).filter(s => s.trim().length > 0);

  if (lines.length <= 1) {
    return callTTS({ text, apiKey, speed, pitch, volume });
  }

  const silencePcm = extractPcm(buildSilenceWav(pauseMs));
  const parts = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const wav = await callTTS({ text: line, apiKey, speed, pitch, volume });
    parts.push(extractPcm(wav));

    if (i < lines.length - 1 && pauseMs > 0) {
      parts.push(silencePcm);
    }
  }

  if (parts.length === 0) {
    throw new Error('No valid text content found');
  }

  const combinedPcm = Buffer.concat(parts);
  return buildWav(combinedPcm);
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

// ── Proofread endpoint (use LLM to check text before TTS) ──────────────────
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

    const prompt = `你是一个中文文本校对专家。请检查以下文本，找出以下问题：
1. 错别字（用字错误）
2. 多音字误用（读音/语境不匹配）
3. 重复字词（连续重复或无意义重复）
4. 语句不通顺（语法错误、搭配不当）

要求：
- 只返回 JSON，不要输出任何其他内容
- JSON 格式：{"issues":[{"type":"错别字|多音字|重复|不通顺","position":"出错位置","original":"原文","suggestion":"建议修改","reason":"原因"}],"summary":"总体评价"}
- 如果没有问题，issues 数组为空
- 只指出明确的问题，不要过度修改

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

    // Parse JSON from model response (may have markdown code fences)
    let result;
    try {
      const jsonStr = content.replace(/```json?\s*/g, '').replace(/```/g, '').trim();
      result = JSON.parse(jsonStr);
    } catch {
      // Fallback: return raw text as summary
      result = { issues: [], summary: content };
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

// ── TTS endpoint ───────────────────────────────────────────────────────────
app.post('/api/tts', async (req, res) => {
  try {
    const {
      text,
      apiKey: bodyApiKey,
      speed, pitch, volume,
      pauseMs,
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
    const id = crypto.randomUUID();
    const pause = Math.max(0, Math.min(5000, parseInt(pauseMs) || 0));
    const outFormat = format === 'mp3' ? 'mp3' : 'wav';

    let wavBuffer;
    try {
      if (pause > 0) {
        wavBuffer = await callTTSWithPause({
          text: finalText, apiKey, pauseMs: pause,
          speed, pitch, volume,
        });
      } else {
        wavBuffer = await callTTS({
          text: finalText, apiKey,
          speed, pitch, volume,
        });
      }
    } catch (err) {
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

    if (!wavBuffer || wavBuffer.length === 0) {
      return res.status(500).json({ error: 'TTS returned empty audio' });
    }

    let finalBuffer = wavBuffer;
    let ext = 'wav';
    let mimeType = 'audio/wav';

    if (outFormat === 'mp3') {
      try {
        finalBuffer = convertToMp3(wavBuffer);
        ext = 'mp3';
        mimeType = 'audio/mpeg';
      } catch (err) {
        console.error('MP3 conversion failed:', err.message);
      }
    }

    return res.json({
      success: true,
      audio: finalBuffer.toString('base64'),
      size: finalBuffer.length,
      filename: `tts_${id}.${ext}`,
      format: ext,
      mimeType,
    });
  } catch (err) {
    console.error('TTS error:', err);
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🎙️  MiMo TTS Lite listening on http://localhost:${PORT}`);
});
