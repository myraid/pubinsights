import { adminDb } from '@/app/lib/firebase/admin'
import type { StyleProfile, SectionPlanEntry } from '@/app/types/firebase'

export interface WritingContext {
  bookTitle: string
  fullOutline: { chapterNumber: number; title: string; summary: string }[]
  styleProfile: StyleProfile | null
  /** Manuscript-level author guidance (free-form). Highest-priority override after style profile. */
  authorContext?: string

  currentChapter: {
    number: number
    title: string
    summary: string
    keyTopics: string[]
    sectionPlan: SectionPlanEntry[]
  }

  currentSection: {
    number: number
    title: string
    outlineContext: string
    estimatedWords: number
    currentContent?: string
    comments?: { selectedText: string; authorFeedback: string }[]
    authorNotes?: string
  }

  previousSectionsInChapter: {
    sectionNumber: number
    title: string
    approvedSummary: string
    lastParagraph: string
  }[]

  previousChapters: {
    chapterNumber: number
    title: string
    chapterSummary: string
  }[]
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

function truncateToWords(text: string, maxWords: number): string {
  const words = text.split(/\s+/)
  if (words.length <= maxWords) return text
  return words.slice(0, maxWords).join(' ') + '...'
}

export class ContextBuilder {
  static async forSectionGeneration(
    projectId: string,
    manuscriptId: string,
    chapterId: string,
    sectionNumber: number
  ): Promise<WritingContext> {
    const basePath = `projects/${projectId}/manuscripts/${manuscriptId}`

    // Read 1: Manuscript
    const msDoc = await adminDb.doc(basePath).get()
    const ms = msDoc.data()!
    const bookTitle = ms.outlineSnapshot.Title || ms.title
    const fullOutline = (ms.outlineSnapshot.Chapters || []).map((ch: Record<string, unknown>) => ({
      chapterNumber: ch.Chapter as number,
      title: ch.Title as string,
      summary: (ch.Summary as string) || '',
    }))
    const styleProfile: StyleProfile | null = ms.styleProfile || null
    const authorContext: string | undefined =
      typeof ms.aiContext === 'string' && ms.aiContext.trim().length > 0
        ? ms.aiContext.trim()
        : undefined

    // Read 2: Current chapter
    const chapDoc = await adminDb.doc(`${basePath}/chapters/${chapterId}`).get()
    const chap = chapDoc.data()!
    const currentChapter = {
      number: chap.chapterNumber,
      title: chap.title,
      summary: chap.outlineContext?.summary || '',
      keyTopics: chap.outlineContext?.keyTopics || [],
      sectionPlan: chap.sectionPlan || [],
    }

    // Find current section from plan
    const sectionPlanEntry = currentChapter.sectionPlan.find(
      (s: SectionPlanEntry) => s.sectionNumber === sectionNumber
    )
    const currentSection = {
      number: sectionNumber,
      title: sectionPlanEntry?.title || `Section ${sectionNumber}`,
      outlineContext: sectionPlanEntry?.outlineContext || '',
      estimatedWords: sectionPlanEntry?.estimatedWords || 1000,
    }

    // Read 3: Approved sections in this chapter
    const approvedSnap = await adminDb
      .collection(`${basePath}/chapters/${chapterId}/sections`)
      .where('status', '==', 'approved')
      .orderBy('sectionNumber', 'asc')
      .get()

    const previousSectionsInChapter = approvedSnap.docs
      .filter(d => d.data().sectionNumber < sectionNumber)
      .map(d => {
        const data = d.data()
        let summary = data.approvedSummary || ''
        if (!summary && data.content) {
          summary = truncateToWords(stripHtml(data.content), 200)
        }
        return {
          sectionNumber: data.sectionNumber,
          title: data.title,
          approvedSummary: summary,
          lastParagraph: data.lastParagraph || '',
        }
      })

    // Read 4: Completed chapters before this one
    const completedSnap = await adminDb
      .collection(`${basePath}/chapters`)
      .where('status', '==', 'complete')
      .orderBy('chapterNumber', 'asc')
      .get()

    let previousChapters = completedSnap.docs
      .filter(d => d.data().chapterNumber < currentChapter.number)
      .map(d => {
        const data = d.data()
        return {
          chapterNumber: data.chapterNumber,
          title: data.title,
          chapterSummary: data.chapterSummary || '',
        }
      })

    // Overflow: if > 20 chapters, compress oldest to title-only, keep last 5 full
    if (previousChapters.length > 20) {
      const cutoff = previousChapters.length - 5
      previousChapters = previousChapters.map((ch, i) => {
        if (i < cutoff) {
          return { ...ch, chapterSummary: ch.title }
        }
        return ch
      })
    }

    return {
      bookTitle,
      fullOutline,
      styleProfile,
      authorContext,
      currentChapter,
      currentSection,
      previousSectionsInChapter,
      previousChapters,
    }
  }

  static async forRevision(
    projectId: string,
    manuscriptId: string,
    chapterId: string,
    sectionId: string
  ): Promise<WritingContext> {
    const basePath = `projects/${projectId}/manuscripts/${manuscriptId}`

    // Read section to get its number, content, and comments
    const secDoc = await adminDb.doc(`${basePath}/chapters/${chapterId}/sections/${sectionId}`).get()
    const sec = secDoc.data()!

    // Reuse forSectionGeneration for the base context
    const ctx = await this.forSectionGeneration(
      projectId, manuscriptId, chapterId, sec.sectionNumber
    )

    // Augment with current content and comments
    ctx.currentSection.currentContent = sec.content
    ctx.currentSection.comments = (sec.comments || [])
      .filter((c: Record<string, unknown>) => c.status === 'pending')
      .map((c: Record<string, unknown>) => ({
        selectedText: c.selectedText as string,
        authorFeedback: c.authorFeedback as string,
      }))
    ctx.currentSection.authorNotes = sec.authorNotes || undefined

    return ctx
  }

  static async forStyleExtraction(
    projectId: string,
    manuscriptId: string,
    sectionIds: string[]
  ): Promise<{ sections: { title: string; content: string }[] }> {
    const basePath = `projects/${projectId}/manuscripts/${manuscriptId}`

    // Need to find sections across all chapters
    const chapSnap = await adminDb.collection(`${basePath}/chapters`).get()
    const sections: { title: string; content: string }[] = []

    for (const chapDoc of chapSnap.docs) {
      for (const sectionId of sectionIds) {
        const secDoc = await adminDb
          .doc(`${basePath}/chapters/${chapDoc.id}/sections/${sectionId}`)
          .get()
        if (secDoc.exists) {
          const data = secDoc.data()!
          sections.push({ title: data.title, content: data.content })
        }
      }
    }

    return { sections }
  }
}
