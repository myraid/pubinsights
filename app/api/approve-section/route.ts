import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/app/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'
import { summarizeSection } from '@/app/lib/agents/section-summarizer-agent'
import { summarizeChapter } from '@/app/lib/agents/chapter-summarizer-agent'

export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    const { userId, projectId, manuscriptId, chapterId, sectionId } = await request.json()

    if (!userId || !projectId || !manuscriptId || !chapterId || !sectionId) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, projectId, manuscriptId, chapterId, sectionId' },
        { status: 400 }
      )
    }

    // Verify ownership
    const projectDoc = await adminDb.doc(`projects/${projectId}`).get()
    if (!projectDoc.exists || projectDoc.data()!.userId !== userId) {
      return NextResponse.json({ error: 'Project not found or access denied' }, { status: 403 })
    }

    const basePath = `projects/${projectId}/manuscripts/${manuscriptId}`
    const sectionPath = `${basePath}/chapters/${chapterId}/sections/${sectionId}`

    // Read section
    const secDoc = await adminDb.doc(sectionPath).get()
    if (!secDoc.exists) {
      return NextResponse.json({ error: 'Section not found' }, { status: 404 })
    }
    const sec = secDoc.data()!

    if (sec.status !== 'review') {
      return NextResponse.json(
        { error: `Section must be in "review" status to approve. Current status: ${sec.status}` },
        { status: 409 }
      )
    }

    // Summarize section (non-fatal)
    let approvedSummary = ''
    let lastParagraph = ''
    try {
      const summaryResult = await summarizeSection(sec.title, sec.content)
      approvedSummary = summaryResult.summary
      lastParagraph = summaryResult.lastParagraph
    } catch (err) {
      console.warn('[approve-section] Section summarization failed (non-fatal):', err)
    }

    // Update section
    await adminDb.doc(sectionPath).update({
      status: 'approved',
      approvedSummary,
      lastParagraph,
      approvedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })

    // Read chapter to update counts
    const chapDoc = await adminDb.doc(`${basePath}/chapters/${chapterId}`).get()
    const chap = chapDoc.data()!
    const newCompletedSections = (chap.completedSections || 0) + 1

    // Calculate chapter word count from all sections
    const allSectionsSnap = await adminDb
      .collection(`${basePath}/chapters/${chapterId}/sections`)
      .get()
    let chapterWordCount = 0
    for (const sDoc of allSectionsSnap.docs) {
      chapterWordCount += sDoc.data().wordCount || 0
    }

    const isLastSection = newCompletedSections >= (chap.totalSections || 0)
    let chapterComplete = false
    let shouldExtractStyle = false

    if (isLastSection) {
      // Assemble chapter content from ordered sections
      const orderedSections = allSectionsSnap.docs
        .map(d => {
          const data = d.data()
          return {
            id: d.id,
            sectionNumber: data.sectionNumber as number,
            title: data.title as string,
            content: data.content as string,
            approvedSummary: (data.approvedSummary || '') as string,
          }
        })
        .sort((a, b) => a.sectionNumber - b.sectionNumber)

      const chapterContent = orderedSections.map(s => s.content).join('\n\n')

      // Summarize chapter (non-fatal)
      let chapterSummary = ''
      try {
        const sectionSummaries = orderedSections.map(s => ({
          title: s.title,
          summary: s.approvedSummary || '',
        }))
        const chapSummaryResult = await summarizeChapter(chap.title, sectionSummaries)
        chapterSummary = chapSummaryResult.chapterSummary
      } catch (err) {
        console.warn('[approve-section] Chapter summarization failed (non-fatal):', err)
      }

      // Update chapter to complete
      await adminDb.doc(`${basePath}/chapters/${chapterId}`).update({
        completedSections: newCompletedSections,
        wordCount: chapterWordCount,
        content: chapterContent,
        chapterSummary,
        status: 'complete',
        updatedAt: FieldValue.serverTimestamp(),
      })

      chapterComplete = true

      // Update manuscript progress
      const msDoc = await adminDb.doc(basePath).get()
      const ms = msDoc.data()!
      const newCompletedChapters = (ms.completedChapters || 0) + 1

      // Calculate total word count across all chapters
      const allChapsSnap = await adminDb.collection(`${basePath}/chapters`).get()
      let totalWordCount = 0
      for (const cDoc of allChapsSnap.docs) {
        totalWordCount += cDoc.data().wordCount || 0
      }

      const allDone = newCompletedChapters >= (ms.totalChapters || 0)
      await adminDb.doc(basePath).update({
        completedChapters: newCompletedChapters,
        totalWordCount,
        ...(allDone ? { status: 'complete' } : {}),
        updatedAt: FieldValue.serverTimestamp(),
      })
    } else {
      // Just update section counts
      await adminDb.doc(`${basePath}/chapters/${chapterId}`).update({
        completedSections: newCompletedSections,
        wordCount: chapterWordCount,
        updatedAt: FieldValue.serverTimestamp(),
      })
    }

    // Count total approved sections across manuscript for style trigger
    const allChapsSnap = await adminDb.collection(`${basePath}/chapters`).get()
    let totalApproved = 0
    for (const cDoc of allChapsSnap.docs) {
      const sectionsSnap = await adminDb
        .collection(`${basePath}/chapters/${cDoc.id}/sections`)
        .where('status', '==', 'approved')
        .get()
      totalApproved += sectionsSnap.size
    }

    // Extract style at 3 approved sections, then every 5th
    if (totalApproved === 3 || (totalApproved > 3 && (totalApproved - 3) % 5 === 0)) {
      shouldExtractStyle = true
    }

    console.log(`[approve-section] section=${sec.sectionNumber} isLast=${isLastSection} chapterComplete=${chapterComplete} totalApproved=${totalApproved}`)

    return NextResponse.json({
      summary: approvedSummary,
      isLastSection,
      chapterComplete,
      shouldExtractStyle,
    })
  } catch (error) {
    console.error('[approve-section] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to approve section' },
      { status: 500 }
    )
  }
}
