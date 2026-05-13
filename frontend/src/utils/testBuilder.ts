export interface TestWord {
  wordId: string
  setId: string
  term: string
  definition: string
}

export interface Question {
  wordId: string
  setId: string
  term: string
  choices: string[]       // 4 варианта определений (перемешаны)
  correctAnswer: string   // правильное определение
}

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5)
}

export function buildQuestions(words: TestWord[], count?: number): Question[] {
  if (words.length < 2) return []

  const pool = shuffle(words).slice(0, count ?? words.length)

  return pool.map((word) => {
    const others = words.filter((w) => w.wordId !== word.wordId)
    const wrong = shuffle(others)
      .slice(0, 3)
      .map((w) => w.definition)

    const choices = shuffle([word.definition, ...wrong])

    return {
      wordId: word.wordId,
      setId: word.setId,
      term: word.term,
      choices,
      correctAnswer: word.definition,
    }
  })
}
