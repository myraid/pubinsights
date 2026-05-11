import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/app/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'
import { summarizeChapter } from '@/app/lib/agents/chapter-summarizer-agent'
import { checkAndIncrementUsage } from '@/app/lib/billing/usage'

export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    const { userId, projectId, manuscriptId, chapterId } = await request.json()

    if (!userId || !projectId || !manuscriptId || !chapterId) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, projectId, manuscriptId, chapterId' },
        { status: 400 }
      )
    }

    // Verify ownership
    const projectDoc = await adminDb.doc(`projects/${projectId}`).get()
    if (!projectDoc.exists || projectDoc.data()!.userId !== userId) {
      return NextResponse.json({ error: 'Project not found or access denied' }, { status: 403 })
    }

    const basePath = `projects/${projectId}/manuscripts/${manuscriptId}`

    // Read chapter
    const chapDoc = await adminDb.doc(`${basePath}/chapters/${chapterId}`).get()
    if (!chapDoc.exists) {
      return NextResponse.json({ error: 'Chapter not found' }, { status: 404 })
    }
    const chap = chapDoc.data()!

    // Read all sections
    const sectionsSnap = await adminDb
      .collection(`${basePath}/chapters/${chapterId}/sections`)
      .orderBy('sectionNumber', 'asc')
      .get()

    if (sectionsSnap.empty) {
      return NextResponse.json(
        { error: 'No sections found for this chapter' },
        { status: 400 }
      )
    }

    // Check usage limits
    const usageCheck = await checkAndIncrementUsage(userId, 'sections')
    if (!usageCheck.allowed) {
      return NextResponse.json(
        { error: 'usage_limit_exceeded', tier: usageCheck.tier, current: usageCheck.current, limit: usageCheck.limit },
        { status: 429 }
      )
    }

    // Verify all sections are approved
    const sections = sectionsSnap.docs.map(d => {
      const data = d.data()
      return {
        id: d.id,
        sectionNumber: data.sectionNumber as number,
        title: (data.title || '') as string,
        status: (data.status || '') as string,
        content: (data.content || '') as string,
        wordCount: (data.wordCount || 0) as number,
        approvedSummary: (data.approvedSummary || '') as string,
      }
    })
    const unapproved = sections.filter(s => s.status !== 'approved')
    if (unapproved.length > 0) {
      return NextResponse.json(
        {
          error: `All sections must be approved. ${unapproved.length} section(s) are not yet approved.`,
        },
        { status: 409 }
      )
    }

    // Assemble content from ordered sections
    const chapterContent = sections
      .map(s => s.content)
      .join('\n\n')

    const totalWordCount = sections.reduce(
      (sum, s) => sum + s.wordCount,
      0
    )

    // Summarize via summarizeChapter (non-fatal)
    let chapterSummary = ''
    try {
      const sectionSummaries = sections.map(s => ({
        title: s.title,
        summary: s.approvedSummary,
      }))
      const result = await summarizeChapter(chap.title, sectionSummaries)
      chapterSummary = result.chapterSummary
    } catch (err) {
      console.warn('[complete-chapter] Chapter summarization failed (non-fatal):', err)
    }

    // Update chapter
    await adminDb.doc(`${basePath}/chapters/${chapterId}`).update({
      content: chapterContent,
      wordCount: totalWordCount,
      chapterSummary,
      status: 'complete',
      completedSections: sections.length,
      updatedAt: FieldValue.serverTimestamp(),
    })

    // Update manuscript progress
    const msDoc = await adminDb.doc(basePath).get()
    const ms = msDoc.data()!

    // Count completed chapters
    const allChapsSnap = await adminDb.collection(`${basePath}/chapters`).get()
    let completedChapters = 0
    let manuscriptTotalWordCount = 0
    for (const cDoc of allChapsSnap.docs) {
      const cData = cDoc.data()
      if (cDoc.id === chapterId) {
        // Use the new values for this chapter
        completedChapters += 1
        manuscriptTotalWordCount += totalWordCount
      } else {
        if (cData.status === 'complete') completedChapters += 1
        manuscriptTotalWordCount += cData.wordCount || 0
      }
    }

    const allDone = completedChapters >= (ms.totalChapters || 0)
    await adminDb.doc(basePath).update({
      completedChapters,
      totalWordCount: manuscriptTotalWordCount,
      ...(allDone ? { status: 'complete' } : {}),
      updatedAt: FieldValue.serverTimestamp(),
    })

    console.log(`[complete-chapter] chapter=${chap.chapterNumber} words=${totalWordCount} allDone=${allDone}`)

    return NextResponse.json({ chapterSummary, totalWordCount })
  } catch (error) {
    console.error('[complete-chapter] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to complete chapter' },
      { status: 500 }
    )
  }
}
