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
