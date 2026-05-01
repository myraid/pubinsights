import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/app/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'
import { planSections } from '@/app/lib/agents/section-planner-agent'

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

    // Read manuscript
    const msDoc = await adminDb.doc(basePath).get()
    if (!msDoc.exists) {
      return NextResponse.json({ error: 'Manuscript not found' }, { status: 404 })
    }
    const ms = msDoc.data()!

    // Read chapter
    const chapDoc = await adminDb.doc(`${basePath}/chapters/${chapterId}`).get()
    if (!chapDoc.exists) {
      return NextResponse.json({ error: 'Chapter not found' }, { status: 404 })
    }
    const chap = chapDoc.data()!

    // Check if sections already exist
    if (chap.sectionPlan && chap.sectionPlan.length > 0) {
      return NextResponse.json(
        { error: 'Section plan already exists for this chapter. Delete existing sections first.' },
        { status: 409 }
      )
    }

    // Cross-chapter enforcement: chapter N requires chapter N-1 to be 'complete'
    if (chap.chapterNumber > 1) {
      const prevChapSnap = await adminDb
        .collection(`${basePath}/chapters`)
        .where('chapterNumber', '==', chap.chapterNumber - 1)
        .limit(1)
        .get()

      if (!prevChapSnap.empty) {
        const prevChap = prevChapSnap.docs[0].data()
        if (prevChap.status !== 'complete') {
          return NextResponse.json(
            { error: `Chapter ${chap.chapterNumber - 1} must be completed before planning chapter ${chap.chapterNumber}` },
            { status: 409 }
          )
        }
      }
    }

    // Get previous chapter titles
    const allChapsSnap = await adminDb
      .collection(`${basePath}/chapters`)
      .where('chapterNumber', '<', chap.chapterNumber)
      .orderBy('chapterNumber', 'asc')
      .get()
    const previousChapterTitles = allChapsSnap.docs.map(d => d.data().title)

    // Get book title and outline
    const bookTitle = ms.outlineSnapshot?.Title || ms.title
    const outlineChapters = ms.outlineSnapshot?.Chapters || []
    const currentOutlineChapter = outlineChapters.find(
      (c: { Chapter: number }) => c.Chapter === chap.chapterNumber
    )

    // Call planner agent
    const sections = await planSections({
      bookTitle,
      chapterNumber: chap.chapterNumber,
      chapterTitle: chap.title,
      chapterSummary: chap.outlineContext?.summary || currentOutlineChapter?.Summary || '',
      keyTopics: chap.outlineContext?.keyTopics || currentOutlineChapter?.KeyTopics || [],
      totalChapters: ms.totalChapters,
      previousChapterTitles,
    })

    // Write section plan to chapter doc
    const now = FieldValue.serverTimestamp()
    await adminDb.doc(`${basePath}/chapters/${chapterId}`).update({
      sectionPlan: sections,
      totalSections: sections.length,
      completedSections: 0,
      status: 'writing',
      updatedAt: now,
    })

    // Create empty section subdocs
    const batch = adminDb.batch()
    for (const sec of sections) {
      const secRef = adminDb
        .collection(`${basePath}/chapters/${chapterId}/sections`)
        .doc()
      batch.set(secRef, {
        sectionNumber: sec.sectionNumber,
        title: sec.title,
        status: 'not_started',
        content: '',
        wordCount: 0,
        outlineContext: sec.outlineContext,
        estimatedWords: sec.estimatedWords,
        comments: [],
        revisionCount: 0,
        revisionHistory: [],
        authorNotes: '',
        aiGenerated: false,
        createdAt: now,
        updatedAt: now,
      })
    }
    await batch.commit()

    console.log(`[plan-sections] chapter=${chap.chapterNumber} sections=${sections.length}`)

    return NextResponse.json({ sections })
  } catch (error) {
    console.error('[plan-sections] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to plan sections' },
      { status: 500 }
    )
  }
}
