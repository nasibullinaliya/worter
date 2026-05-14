/** Detect language by script: Cyrillic → ru-RU, otherwise → de-DE */
function detectLang(text: string): string {
  return /[а-яёА-ЯЁ]/.test(text) ? 'ru-RU' : 'de-DE'
}

export function speak(text: string, lang?: string) {
  if (!('speechSynthesis' in window)) return
  window.speechSynthesis.cancel()
  const utt = new SpeechSynthesisUtterance(text)
  utt.lang = lang ?? detectLang(text)
  utt.rate = 0.85
  window.speechSynthesis.speak(utt)
}

export function stopSpeech() {
  if ('speechSynthesis' in window) window.speechSynthesis.cancel()
}

export const isSpeechSupported = () => 'speechSynthesis' in window
