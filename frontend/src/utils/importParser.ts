export function parseImportText(text: string): { term: string; definition: string }[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      const tabIdx = line.indexOf('\t')
      if (tabIdx !== -1) {
        return [{ term: line.slice(0, tabIdx).trim(), definition: line.slice(tabIdx + 1).trim() }]
      }
      const dashIdx = line.indexOf(' - ')
      if (dashIdx !== -1) {
        return [{ term: line.slice(0, dashIdx).trim(), definition: line.slice(dashIdx + 3).trim() }]
      }
      return []
    })
    .filter((p) => p.term && p.definition)
}
