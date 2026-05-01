import { Paragraph, TextRun, HeadingLevel } from 'docx'
import * as htmlparser2 from 'htmlparser2'

type HeadingLevelValue = (typeof HeadingLevel)[keyof typeof HeadingLevel]

interface TextFragment {
  text: string
  bold: boolean
  italics: boolean
}

export function htmlToDocxParagraphs(html: string): Paragraph[] {
  const paragraphs: Paragraph[] = []
  let currentFragments: TextFragment[] = []
  let bold = false
  let italics = false
  let currentHeading: HeadingLevelValue | null = null
  let inList = false
  let isOrderedList = false

  function flushParagraph() {
    if (currentFragments.length === 0) return
    const runs = currentFragments.map(
      f => new TextRun({ text: f.text, bold: f.bold, italics: f.italics })
    )

    const options: Record<string, unknown> = { children: runs }
    if (currentHeading) options.heading = currentHeading
    if (inList) {
      options.numbering = isOrderedList
        ? { reference: 'ordered-list', level: 0 }
        : { reference: 'bullet-list', level: 0 }
    }

    paragraphs.push(new Paragraph(options as ConstructorParameters<typeof Paragraph>[0]))
    currentFragments = []
    currentHeading = null
  }

  const parser = new htmlparser2.Parser({
    onopentag(name) {
      switch (name) {
        case 'h1': currentHeading = HeadingLevel.HEADING_1; break
        case 'h2': currentHeading = HeadingLevel.HEADING_2; break
        case 'h3': currentHeading = HeadingLevel.HEADING_3; break
        case 'strong': case 'b': bold = true; break
        case 'em': case 'i': italics = true; break
        case 'ul': inList = true; isOrderedList = false; break
        case 'ol': inList = true; isOrderedList = true; break
        case 'li': break
        case 'p': break
        case 'br':
          currentFragments.push({ text: '\n', bold, italics })
          break
      }
    },
    ontext(text) {
      const trimmed = text.replace(/\s+/g, ' ')
      if (trimmed && trimmed !== ' ') {
        currentFragments.push({ text: trimmed, bold, italics })
      }
    },
    onclosetag(name) {
      switch (name) {
        case 'h1': case 'h2': case 'h3': case 'p': case 'li':
          flushParagraph()
          break
        case 'strong': case 'b': bold = false; break
        case 'em': case 'i': italics = false; break
        case 'ul': case 'ol': inList = false; break
      }
    },
  })

  parser.write(html)
  parser.end()
  flushParagraph()

  return paragraphs
}
