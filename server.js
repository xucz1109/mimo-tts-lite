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
const { execFileSync } = require('child_process');
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
  const pcmBuffer = Buffer.alloc(numSamples * 2); // 16-bit = 2 bytes per sample
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
async function callTTS({ text, style, apiKey, voiceAudioBase64, speed, pitch, volume }) {
  const endpoint = process.env.MIMO_API_ENDPOINT || 'https://api.xiaomimimo.com/v1/chat/completions';
  const model = process.env.MIMO_TTS_MODEL || 'mimo-v2-audio-tts';

  const content = style ? `<style>${style}</style>${text}` : text;

  const body = {
    model,
    messages: [{ role: 'assistant', content }],
  };

  if (voiceAudioBase64) {
    body.audio = { format: 'wav', voice_audio: { format: 'wav', data: voiceAudioBase64 } };
  } else {
    body.audio = { format: 'wav', voice: 'mimo_default' };
  }

  // Pass audio params if provided
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

// ── Parse per-line bracket tags: [男声][鸣人][愤怒][快速][停顿500ms] text... ──
function parseLineTags(line) {
  const tags = [];
  let pauseMs = 0;
  let rest = line.trimStart();
  // Match leading [tag] groups
  const re = /^\[([^\]]+)\]\s*/;
  let m;
  while ((m = rest.match(re))) {
    const tag = m[1].trim();
    // Check if it's a pause tag: [停顿500ms] [pause500ms] etc.
    const pauseMatch = tag.match(/^(?:停顿|pause)\s*(\d+)\s*(?:ms|毫秒)?$/i);
    if (pauseMatch) {
      pauseMs = parseInt(pauseMatch[1]);
    } else {
      tags.push(tag);
    }
    rest = rest.slice(m[0].length);
  }
  return { tags, pauseMs, text: rest.trim() };
}

// ── Paragraph pause: synthesize segments with silence between ───────────────
// Supports per-line bracket tags that override the global style
async function callTTSWithPause({ text, style, apiKey, voiceAudioBase64, pauseMs, speed, pitch, volume }) {
  const rawLines = text.split(/\n/).filter(s => s.trim().length > 0);

  if (rawLines.length <= 1 && !rawLines[0]?.trim().startsWith('[')) {
    return callTTS({ text, style, apiKey, voiceAudioBase64, speed, pitch, volume });
  }

  const silenceWav = buildSilenceWav(pauseMs);
  const silencePcm = extractPcm(silenceWav);
  const parts = [];

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i].trim();
    const { tags, pauseMs: linePause, text: lineText } = parseLineTags(line);

    if (!lineText && tags.length === 0) continue;

    // Per-line style: if tags present, join them as style override
    const lineStyle = tags.length > 0 ? tags.join(' ') : style;

    const wav = await callTTS({
      text: lineText || line, // fallback: if no text after tags, use raw line
      style: lineStyle,
      apiKey,
      voiceAudioBase64: voiceAudioBase64,
      speed,
      pitch,
      volume,
    });
    parts.push(extractPcm(wav));

    if (i < rawLines.length - 1) {
      // Use per-line pause if set, otherwise use global pauseMs
      const gapMs = linePause > 0 ? linePause : pauseMs;
      if (gapMs > 0) {
        const gapSilence = buildSilenceWav(gapMs);
        parts.push(extractPcm(gapSilence));
      }
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

// ── Resolve singing lyrics ─────────────────────────────────────────────────
function resolveLyrics(text) {
  if (text.startsWith('LYRICS:')) {
    return text.slice(7);
  }
  if (singDict[text]) return singDict[text];
  for (const [key, lyrics] of Object.entries(singDict)) {
    if (key.includes(text) || text.includes(key)) return lyrics;
  }
  return null;
}

// ── TTS endpoint ───────────────────────────────────────────────────────────
app.post('/api/tts', async (req, res) => {
  try {
    const {
      text, style, voiceAudioBase64,
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

    let finalText = text.trim();
    let finalStyle = style;
    if (style === '唱歌') {
      const lyrics = resolveLyrics(finalText);
      if (lyrics) finalText = lyrics;
    }

    const id = crypto.randomUUID();
    const voiceB64 = voiceAudioBase64 || null;
    const pause = Math.max(0, Math.min(5000, parseInt(pauseMs) || 0));
    const outFormat = format === 'mp3' ? 'mp3' : 'wav';

    // Detect multi-role: any line starting with [tag]
    const hasMultiRole = finalText.split('\n').some(l => /^\s*\[/.test(l));

    let wavBuffer;
    try {
      if (pause > 0 || hasMultiRole) {
        wavBuffer = await callTTSWithPause({
          text: finalText, style, apiKey,
          voiceAudioBase64: voiceB64,
          pauseMs: pause,
          speed, pitch, volume,
        });
      } else {
        wavBuffer = await callTTS({
          text: finalText, style, apiKey,
          voiceAudioBase64: voiceB64,
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

    // Convert to MP3 if requested
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
        // Fall back to WAV
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
  console.log(`🎙️  MiMo TTS Web listening on http://localhost:${PORT}`);
});
