import type { Editor } from "@tiptap/react"

export function stripHighlightMarks(html: string): string {
  return (html || "").replace(/<\/?mark\b[^>]*>/gi, "")
}

/** Flatten HTML to a single preview string. Nested blocks cannot be line-clamped. */
export function htmlToPreviewText(html: string, skipTitle?: string): string {
  const source = stripHighlightMarks(html || "")
  let i = 0
  let plain = ""

  while (i < source.length) {
    if (source[i] === "<") {
      const close = source.indexOf(">", i)
      if (close === -1) break
      const rawTag = source.slice(i + 1, close).trim()
      const isClose = rawTag.startsWith("/")
      const name = (isClose ? rawTag.slice(1) : rawTag).split(/[\s/]/)[0].toLowerCase()
      if (name === "br" || (isClose && /^(p|div|h[1-6]|li|blockquote|tr|ul|ol)$/.test(name))) {
        plain += " "
      }
      i = close + 1
      continue
    }
    if (source[i] === "&") {
      const semi = source.indexOf(";", i)
      if (semi !== -1 && semi - i <= 8) {
        const entity = source.slice(i, semi + 1)
        const decoded = decodeHtmlEntity(entity)
        if (decoded !== entity || entity.startsWith("&#")) {
          plain += decoded
          i = semi + 1
          continue
        }
      }
    }
    plain += source[i]
    i++
  }

  let text = plain.replace(/\s+/g, " ").trim()
  const title = (skipTitle || "").replace(/\s+/g, " ").trim()
  if (title && text.toLowerCase().startsWith(title.toLowerCase())) {
    text = text.slice(title.length).replace(/^[:.\-\s]+/, "").trim()
  }
  return text
}

export function applyCommentHighlights(editor: Editor, needles: string[]) {
  const highlight = editor.schema.marks.highlight
  if (!highlight) return

  const tr = editor.state.tr.removeMark(0, editor.state.doc.content.size, highlight)

  for (const needle of needles) {
    const range = findTextRangeInDoc(tr.doc, needle)
    if (range) tr.addMark(range.from, range.to, highlight.create())
  }

  if (tr.steps.length > 0) editor.view.dispatch(tr)
}

function findTextRangeInDoc(
  doc: Editor["state"]["doc"],
  needle: string
): { from: number; to: number } | null {
  const target = needle.trim()
  if (!target) return null

  let haystack = ""
  const indexToPos: number[] = []

  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return
    for (let i = 0; i < node.text.length; i++) {
      haystack += node.text[i]
      indexToPos.push(pos + i)
    }
  })

  let idx = haystack.indexOf(target)
  let len = target.length
  if (idx === -1) {
    const snippet = target.slice(0, Math.min(48, target.length))
    if (snippet === target) return null
    idx = haystack.indexOf(snippet)
    len = snippet.length
  }
  if (idx === -1 || idx + len - 1 >= indexToPos.length) return null

  return { from: indexToPos[idx], to: indexToPos[idx + len - 1] + 1 }
}

function decodeHtmlEntity(entity: string): string {
  const named: Record<string, string> = {
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&nbsp;": " ",
    "&#39;": "'",
    "&apos;": "'",
  }
  const lower = entity.toLowerCase()
  if (named[lower]) return named[lower]
  const hex = entity.match(/^&#x([0-9a-f]+);$/i)
  if (hex) return String.fromCodePoint(parseInt(hex[1], 16))
  const dec = entity.match(/^&#(\d+);$/)
  if (dec) return String.fromCodePoint(parseInt(dec[1], 10))
  return entity
}

/** Locate a plain-text selection inside HTML, ignoring tags. */
export function findHtmlRangeForPlainText(
  html: string,
  selectedText: string
): { startIdx: number; endIdx: number } | null {
  const target = (selectedText || "").trim()
  if (!target || !html) return null

  const direct = html.indexOf(target)
  if (direct !== -1) return { startIdx: direct, endIdx: direct + target.length }

  const map: { start: number; end: number }[] = []
  let plain = ""
  let i = 0
  while (i < html.length) {
    if (html[i] === "<") {
      const close = html.indexOf(">", i)
      if (close === -1) break
      i = close + 1
      continue
    }
    if (html[i] === "&") {
      const semi = html.indexOf(";", i)
      if (semi !== -1 && semi - i <= 8) {
        const entity = html.slice(i, semi + 1)
        const decoded = decodeHtmlEntity(entity)
        if (decoded !== entity || entity.startsWith("&#")) {
          for (const ch of decoded) {
            plain += ch
            map.push({ start: i, end: semi + 1 })
          }
          i = semi + 1
          continue
        }
      }
    }
    plain += html[i]
    map.push({ start: i, end: i + 1 })
    i++
  }

  const idx = plain.indexOf(target)
  if (idx === -1 || idx + target.length - 1 >= map.length) return null

  return { startIdx: map[idx].start, endIdx: map[idx + target.length - 1].end }
}
