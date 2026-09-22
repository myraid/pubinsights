import type { Editor } from "@tiptap/react"

export interface TypewriterHandle {
  /** Stops the animation and snaps the editor to the finished content. */
  cancel: () => void
}

interface TypewriterOptions {
  charsPerTick?: number
  tickMs?: number
  onDone?: () => void
}

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;" }
const escapeText = (text: string) => text.replace(/[&<>]/g, (c) => ESCAPES[c])

/**
 * Reveals `html` in a Tiptap editor as if it were being typed.
 *
 * Types the plain text of one block at a time, then swaps in that block's real markup
 * before starting the next. Typing the raw HTML character by character would put broken
 * tags on screen mid-word and lose inline formatting; this way the document is valid at
 * every step and ends byte-identical to `html`.
 *
 * The caller owns the returned handle — cancel it when the section changes or unmounts,
 * otherwise a stale animation will keep writing into a reused editor.
 */
export function typeHtmlInto(
  editor: Editor,
  html: string,
  { charsPerTick = 10, tickMs = 16, onDone }: TypewriterOptions = {},
): TypewriterHandle {
  const finish = () => {
    editor.commands.setContent(html)
    onDone?.()
  }

  // DOMParser is browser-only, and there is nothing to animate for empty content.
  if (typeof window === "undefined" || !html.trim()) {
    finish()
    return { cancel: () => {} }
  }

  const blocks = Array.from(
    new DOMParser().parseFromString(html, "text/html").body.children,
  ) as HTMLElement[]

  if (blocks.length === 0) {
    finish()
    return { cancel: () => {} }
  }

  // Only blocks that legitimately hold raw text get typed out. A <ul> or <table> cannot
  // contain a bare string, so animating one would emit markup ProseMirror has to coerce;
  // those appear whole instead.
  const TYPEABLE = new Set(["p", "h1", "h2", "h3", "h4", "h5", "h6", "blockquote"])
  const isTypeable = (el: HTMLElement) =>
    TYPEABLE.has(el.tagName.toLowerCase()) &&
    !el.querySelector("p, ul, ol, li, table, pre, blockquote, img")

  let cancelled = false
  let timer: ReturnType<typeof setTimeout> | null = null
  let blockIndex = 0
  let charIndex = 0
  let settled = "" // completed blocks, as their real markup

  const step = () => {
    if (cancelled) return

    const block = blocks[blockIndex]
    const tag = block.tagName.toLowerCase()
    const text = block.textContent ?? ""

    if (!isTypeable(block)) {
      settled += block.outerHTML
      editor.commands.setContent(settled)
      blockIndex += 1
      charIndex = 0
      if (blockIndex >= blocks.length) {
        finish()
        return
      }
      timer = setTimeout(step, tickMs)
      return
    }

    charIndex = Math.min(charIndex + charsPerTick, text.length)
    editor.commands.setContent(
      `${settled}<${tag}>${escapeText(text.slice(0, charIndex))}</${tag}>`,
    )

    if (charIndex >= text.length) {
      settled += block.outerHTML // restores bold/italic/links for the finished block
      blockIndex += 1
      charIndex = 0
      if (blockIndex >= blocks.length) {
        finish()
        return
      }
    }
    timer = setTimeout(step, tickMs)
  }

  timer = setTimeout(step, tickMs)

  return {
    cancel: () => {
      if (cancelled) return
      cancelled = true
      if (timer) clearTimeout(timer)
      finish()
    },
  }
}
