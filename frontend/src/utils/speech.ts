/** Detect language by script: Cyrillic → ru-RU, otherwise → de-DE */
export function detectLang(text: string): string {
  return /[а-яёА-ЯЁ]/.test(text) ? 'ru-RU' : 'de-DE'
}

let currentUtterance: SpeechSynthesisUtterance | null = null

export function speak(text: string, lang?: string): void {
  if (!('speechSynthesis' in window)) return
  const resolvedLang = lang ?? detectLang(text)
  window.speechSynthesis.cancel()
  currentUtterance = new SpeechSynthesisUtterance(text)
  currentUtterance.lang = resolvedLang
  currentUtterance.rate = 0.85
  window.speechSynthesis.speak(currentUtterance)
}

export function stopSpeech(): void {
  if ('speechSynthesis' in window) window.speechSynthesis.cancel()
  currentUtterance = null
}

export const isSpeechSupported = () => 'speechSynthesis' in window
