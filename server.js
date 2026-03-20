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

// ── TTS endpoint ───────────────────────────────────────────────────────────
app.post('/api/tts', async (req, res) => {
  try {
    const { text, style, voiceAudioBase64 } = req.body;

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return res.status(400).json({ error: 'text is required' });
    }
    if (text.length > 10000) {
      return res.status(400).json({ error: 'text too long (max 10000 chars)' });
    }

    const apiKey = getApiKey();
    if (!apiKey) {
      return res.status(500).json({ error: 'MIMO_API_KEY not configured' });
    }

    const id = crypto.randomUUID();
    const tmpDir = os.tmpdir();
    const outPath = path.join(tmpDir, `tts_${id}.wav`);

    // Build script args
    const scriptPath = path.join(__dirname, 'scripts', 'tts_to_wav.sh');
    const args = [scriptPath, text.trim(), outPath];
    if (style && typeof style === 'string' && style.trim()) {
      args.push(style.trim());
    }

    // Voice clone: write temp wav file
    let voiceSamplePath = null;
    if (voiceAudioBase64) {
      voiceSamplePath = path.join(tmpDir, `voice_${id}.wav`);
      fs.writeFileSync(voiceSamplePath, Buffer.from(voiceAudioBase64, 'base64'));
      args.push(voiceSamplePath);
    }

    const env = { ...process.env, MIMO_API_KEY: apiKey };

    try {
      execFileSync('bash', args, {
        env,
        timeout: 120000,
        maxBuffer: 50 * 1024 * 1024,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch (err) {
      const stderr = (err.stderr || err.message || '').toString();
      try { fs.unlinkSync(outPath); } catch {}
      try { if (voiceSamplePath) fs.unlinkSync(voiceSamplePath); } catch {}
      return res.status(500).json({ error: stderr || 'TTS generation failed' });
    }

    // Cleanup voice sample
    try { if (voiceSamplePath) fs.unlinkSync(voiceSamplePath); } catch {}

    if (!fs.existsSync(outPath) || fs.statSync(outPath).size === 0) {
      return res.status(500).json({ error: 'TTS returned empty file' });
    }

    const wavBuffer = fs.readFileSync(outPath);
    try { fs.unlinkSync(outPath); } catch {}

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
