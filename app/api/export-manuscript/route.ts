import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/app/lib/firebase/admin'
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, NumberFormat } from 'docx'
import { htmlToDocxParagraphs } from '@/app/lib/export/html-to-docx'

export const maxDuration = 30

export async function POST(req: NextRequest) {
  try {
    const { userId, projectId, manuscriptId, draft } = await req.json()

    if (!userId || !projectId || !manuscriptId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const basePath = `projects/${projectId}/manuscripts/${manuscriptId}`

    // Read manuscript
    const msDoc = await adminDb.doc(basePath).get()
    if (!msDoc.exists) {
      return NextResponse.json({ error: 'Manuscript not found' }, { status: 404 })
    }
    const ms = msDoc.data()!

    if (ms.status !== 'complete' && !draft) {
      return NextResponse.json(
        { error: 'Manuscript must be complete to export. Pass draft: true for partial export.' },
        { status: 403 }
      )
    }

    // Read chapters
    const chapSnap = await adminDb
      .collection(`${basePath}/chapters`)
      .orderBy('chapterNumber', 'asc')
      .get()

    // Get author name from user profile
    const userDoc = await adminDb.doc(`users/${userId}`).get()
    const authorName = userDoc.exists ? (userDoc.data()?.displayName || 'Author') : 'Author'

    const bookTitle = ms.outlineSnapshot?.Title || ms.title

    // Build chapter sections
    const chapterSections = chapSnap.docs
      .filter(d => draft || d.data().status === 'complete')
      .filter(d => d.data().content)
      .map(d => {
        const ch = d.data()
        return {
          properties: {},
          children: [
            new Paragraph({
              children: [new TextRun({ text: `Chapter ${ch.chapterNumber}: ${ch.title}`, bold: true, size: 48, font: 'Georgia' })],
              heading: HeadingLevel.HEADING_1,
              pageBreakBefore: true,
              spacing: { after: 400 },
            }),
            ...htmlToDocxParagraphs(ch.content),
          ],
        }
      })

    // Title page
    const titleSection = {
      properties: {},
      children: [
        new Paragraph({ spacing: { before: 3000 } }),
        new Paragraph({
          children: [new TextRun({ text: bookTitle, bold: true, size: 72, font: 'Georgia' })],
          alignment: AlignmentType.CENTER,
        }),
        new Paragraph({ spacing: { before: 400 } }),
        new Paragraph({
          children: [new TextRun({ text: authorName, size: 36, font: 'Georgia' })],
          alignment: AlignmentType.CENTER,
        }),
        ...(draft ? [
          new Paragraph({ spacing: { before: 800 } }),
          new Paragraph({
            children: [new TextRun({ text: 'DRAFT', bold: true, size: 28, font: 'Georgia', color: '999999' })],
            alignment: AlignmentType.CENTER,
          }),
        ] : []),
      ],
    }

    const doc = new Document({
      styles: {
        default: {
          document: {
            run: { font: 'Georgia', size: 24 },
            paragraph: { spacing: { after: 200, line: 360 } },
          },
        },
      },
      numbering: {
        config: [
          {
            reference: 'bullet-list',
            levels: [{ level: 0, format: NumberFormat.BULLET, text: '\u2022', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }],
          },
          {
            reference: 'ordered-list',
            levels: [{ level: 0, format: NumberFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }],
          },
        ],
      },
      sections: [titleSection, ...chapterSections],
    })

    const buffer = await Packer.toBuffer(doc)
    const filename = bookTitle.replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-')

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${filename}.docx"`,
      },
    })
  } catch (error) {
    console.error('[export-manuscript] error:', error)
    return NextResponse.json(
      { error: 'Failed to export manuscript', details: String(error) },
      { status: 500 }
    )
  }
}
