#!/usr/bin/env node
/**
 * MiMo TTS Web — Backend Server
 *
 * Env vars:
 *   MIMO_API_KEY      (required) MiMo platform API key
 *   MIMO_API_ENDPOINT (optional) Override API endpoint
 *   MIMO_TTS_MODEL    (optional) Override model name
 *   PORT              (optional) HTTP port, default 3210
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

const app = express();
const PORT = process.env.PORT || 3210;

app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ── Song lyrics dictionary ────────────────────────────────────────────────
let singDict = {};
try {
  const dictPath = path.join(__dirname, 'sing0301_dict.json');
  singDict = JSON.parse(fs.readFileSync(dictPath, 'utf8'));
  console.log(`📖 Loaded ${Object.keys(singDict).length} songs from dictionary`);
} catch {
  console.warn('⚠️  sing0301_dict.json not found, singing mode with preset songs disabled');
}

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
function buildWav(pcmBuffer, sampleRate = 24000, bitsPerSample = 16, channels = 1) {
  const byteRate = sampleRate * channels * bitsPerSample / 8;
  const blockAlign = channels * bitsPerSample / 8;
  const dataSize = pcmBuffer.length;
  const headerSize = 44;
  const buf = Buffer.alloc(headerSize + dataSize);

  // RIFF header
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVE', 8);

  // fmt sub-chunk
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);          // sub-chunk size
  buf.writeUInt16LE(1, 20);           // PCM format
  buf.writeUInt16LE(channels, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(byteRate, 28);
  buf.writeUInt16LE(blockAlign, 32);
  buf.writeUInt16LE(bitsPerSample, 34);

  // data sub-chunk
  buf.write('data', 36);
  buf.writeUInt32LE(dataSize, 40);
  pcmBuffer.copy(buf, headerSize);

  return buf;
}

// ── Core TTS function ──────────────────────────────────────────────────────
async function callTTS({ text, style, apiKey, voiceAudioBase64 }) {
  const endpoint = process.env.MIMO_API_ENDPOINT || 'https://api.xiaomimimo.com/v1/chat/completions';
  const model = process.env.MIMO_TTS_MODEL || 'mimo-v2-audio-tts';

  // Build content with style tag
  const content = style ? `<style>${style}</style>${text}` : text;

  // Build request body
  const body = {
    model,
    messages: [{ role: 'assistant', content }],
  };

  if (voiceAudioBase64) {
    body.audio = { format: 'wav', voice_audio: { format: 'wav', data: voiceAudioBase64 } };
  } else {
    body.audio = { format: 'wav', voice: 'mimo_default' };
  }

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

  // Extract audio data
  const audioData = data?.choices?.[0]?.message?.audio?.data;
  if (!audioData) {
    throw new Error('Unexpected API response: no audio data found');
  }

  const raw = Buffer.from(audioData, 'base64');

  // Check if already WAV (RIFF header) or raw PCM
  if (raw.slice(0, 4).toString() === 'RIFF') {
    return raw;
  }
  // Wrap raw PCM into WAV
  return buildWav(raw);
}

// ── Resolve singing lyrics ─────────────────────────────────────────────────
function resolveLyrics(text) {
  if (text.startsWith('LYRICS:')) {
    return text.slice(7);
  }
  // Direct lookup
  if (singDict[text]) return singDict[text];
  // Fuzzy match
  for (const [key, lyrics] of Object.entries(singDict)) {
    if (key.includes(text) || text.includes(key)) return lyrics;
  }
  return null;
}

// ── TTS endpoint ───────────────────────────────────────────────────────────
app.post('/api/tts', async (req, res) => {
  try {
    const { text, style, voiceAudioBase64, apiKey: bodyApiKey } = req.body;

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return res.status(400).json({ error: 'text is required' });
    }
    if (text.length > 10000) {
      return res.status(400).json({ error: 'text too long (max 10000 chars)' });
    }

    // Priority: request body > env var > openclaw config
    const apiKey = (bodyApiKey && bodyApiKey.trim()) || getApiKey();
    if (!apiKey) {
      return res.status(400).json({ error: 'API Key 未配置，请在页面输入 MiMo API Key' });
    }

    // Handle singing mode
    let finalText = text.trim();
    let finalStyle = style;
    if (style === '唱歌') {
      const lyrics = resolveLyrics(finalText);
      if (lyrics) {
        finalText = lyrics;
      }
      // If no lyrics found and not prefixed with LYRICS:, let it through as-is
    }

    const id = crypto.randomUUID();
    const tmpDir = os.tmpdir();

    // Voice clone: write temp wav file, read as base64
    let voiceB64 = voiceAudioBase64 || null;
    if (!voiceB64) {
      // Check if a voice sample file was provided via multipart or other means
      // (not applicable in current JSON API, but placeholder for future)
    }

    let wavBuffer;
    try {
      wavBuffer = await callTTS({
        text: finalText,
        style: finalStyle,
        apiKey,
        voiceAudioBase64: voiceB64,
      });
    } catch (err) {
      // Friendly error messages for common API errors
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

    return res.json({
      success: true,
      audio: wavBuffer.toString('base64'),
      size: wavBuffer.length,
      filename: `tts_${id}.wav`,
    });
  } catch (err) {
    console.error('TTS error:', err);
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🎙️  MiMo TTS Web listening on http://localhost:${PORT}`);
});
