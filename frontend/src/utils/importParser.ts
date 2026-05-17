export function parseImportText(
  text: string,
  separator = '-',
): { term: string; definition: string }[] {
  const sep = separator.trim() || '-'
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      // Tab is always recognised as a separator regardless of the setting
      const tabIdx = line.indexOf('\t')
      if (tabIdx !== -1) {
        return [{ term: line.slice(0, tabIdx).trim(), definition: line.slice(tabIdx + 1).trim() }]
      }
      // User-defined separator
      const sepIdx = line.indexOf(sep)
      if (sepIdx !== -1) {
        return [{
          term: line.slice(0, sepIdx).trim(),
          definition: line.slice(sepIdx + sep.length).trim(),
        }]
      }
      return []
    })
    .filter((p) => p.term && p.definition)
}

export interface ImportWarnings {
  /** Terms that appear more than once with the exact same definition */
  duplicates: string[]
  /** Terms that appear more than once with different definitions */
  conflicts: { term: string; defs: string[] }[]
  /** Terms already present in other sets of the user */
  existingInOtherSets: { term: string; setTitles: string[] }[]
}

export function analyzeImport(
  parsed: { term: string; definition: string }[],
  allUserWords: { term: string; setId: string; setTitle: string }[],
  currentSetId?: string,
): ImportWarnings {
  // ── 1. Duplicates & conflicts within the import ──────────────────────────
  const termMap = new Map<string, string[]>() // normalised term → [definitions]
  for (const { term, definition } of parsed) {
    const key = term.toLowerCase().trim()
    if (!termMap.has(key)) termMap.set(key, [])
    termMap.get(key)!.push(definition.trim())
  }

  const duplicates: string[] = []
  const conflicts: { term: string; defs: string[] }[] = []

  for (const [key, defs] of termMap) {
    if (defs.length <= 1) continue
    const uniqueDefs = [...new Set(defs.map((d) => d.toLowerCase()))]
    if (uniqueDefs.length === 1) {
      duplicates.push(key)
    } else {
      conflicts.push({ term: key, defs: [...new Set(defs)] })
    }
  }

  // ── 2. Already in other sets ─────────────────────────────────────────────
  const parsedTermsLower = new Set(parsed.map((p) => p.term.toLowerCase().trim()))
  const byTerm = new Map<string, Set<string>>() // normalised term → set of setTitles

  for (const w of allUserWords) {
    if (currentSetId && w.setId === currentSetId) continue
    const key = w.term.toLowerCase().trim()
    if (!parsedTermsLower.has(key)) continue
    if (!byTerm.has(key)) byTerm.set(key, new Set())
    byTerm.get(key)!.add(w.setTitle)
  }

  const existingInOtherSets = [...byTerm.entries()].map(([term, titles]) => ({
    term,
    setTitles: [...titles],
  }))

  return { duplicates, conflicts, existingInOtherSets }
}
