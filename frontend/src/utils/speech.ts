import client from '../api/client'

/** Detect language by script: Cyrillic → ru-RU, otherwise → de-DE */
export function detectLang(text: string): string {
  return /[а-яёА-ЯЁ]/.test(text) ? 'ru-RU' : 'de-DE'
}

// ── Client-side audio cache: avoids re-fetching the same word ────────────────
const audioCache = new Map<string, string>() // "lang:text" → data URL

let currentAudio: HTMLAudioElement | null = null

function stopCurrent() {
  if (currentAudio) {
    currentAudio.pause()
    currentAudio.currentTime = 0
    currentAudio = null
  }
}

// ── Cloud TTS via backend proxy ───────────────────────────────────────────────
async function speakCloud(text: string, lang: string): Promise<void> {
  const key = `${lang}:${text}`

  let dataUrl = audioCache.get(key)
  if (!dataUrl) {
    const res = await client.post<{ audioContent: string }>('/api/tts', { text, lang })
    dataUrl = `data:audio/mpeg;base64,${res.data.audioContent}`
    audioCache.set(key, dataUrl)
  }

  stopCurrent()
  currentAudio = new Audio(dataUrl)
  await currentAudio.play()
}

// ── Web Speech API fallback ───────────────────────────────────────────────────
function speakLocal(text: string, lang: string): void {
  if (!('speechSynthesis' in window)) return
  window.speechSynthesis.cancel()
  const utt = new SpeechSynthesisUtterance(text)
  utt.lang = lang
  utt.rate = 0.85
  window.speechSynthesis.speak(utt)
}

// ── Public API ────────────────────────────────────────────────────────────────
export async function speak(text: string, lang?: string): Promise<void> {
  const resolvedLang = lang ?? detectLang(text)
  try {
    await speakCloud(text, resolvedLang)
  } catch {
    // Fall back to browser TTS if cloud unavailable
    speakLocal(text, resolvedLang)
  }
}

export function stopSpeech(): void {
  stopCurrent()
  if ('speechSynthesis' in window) window.speechSynthesis.cancel()
}

export const isSpeechSupported = () =>
  'speechSynthesis' in window || typeof Audio !== 'undefined'
