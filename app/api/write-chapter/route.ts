import { NextResponse } from 'next/server'
import { generateChapterDraft } from '@/app/lib/agents/writer-agent'
import { adminDb } from '@/app/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'
import { checkAndIncrementUsage } from '@/app/lib/billing/usage'

// GPT-4o writing 2000–3000 words can take up to 90 seconds
export const maxDuration = 120

export async function POST(request: Request) {
  try {
    const body = await request.json()

    const {
      bookTitle,
      chapterNumber,
      chapterTitle,
      summary,
      keyTopics,
      previousChapterSummary,
      totalChapters,
      projectId,
      manuscriptId,
      chapterId,
      userId,
    } = body

    if (
      !bookTitle ||
      chapterNumber == null ||
      !chapterTitle ||
      summary == null ||
      !keyTopics ||
      totalChapters == null ||
      !projectId ||
      !manuscriptId ||
      !chapterId ||
      !userId
    ) {
      return NextResponse.json(
        {
          error:
            'Missing required fields: bookTitle, chapterNumber, chapterTitle, summary, keyTopics, totalChapters, projectId, manuscriptId, chapterId, userId',
        },
        { status: 400 }
      )
    }

    // Verify ownership
    const projectDoc = await adminDb.doc(`projects/${projectId}`).get()
    if (!projectDoc.exists || projectDoc.data()!.userId !== userId) {
      return NextResponse.json({ error: 'Project not found or access denied' }, { status: 403 })
    }

    // Check usage limits
    const usageCheck = await checkAndIncrementUsage(userId, 'sections')
    if (!usageCheck.allowed) {
      return NextResponse.json(
        { error: 'usage_limit_exceeded', tier: usageCheck.tier, current: usageCheck.current, limit: usageCheck.limit },
        { status: 429 }
      )
    }

    const draft = await generateChapterDraft({
      bookTitle,
      chapterNumber,
      chapterTitle,
      summary: summary || '',
      keyTopics,
      previousChapterSummary,
      totalChapters,
    })

    // Use Admin SDK to bypass Firestore security rules in server context
    const chapterRef = adminDb
      .collection('projects')
      .doc(projectId)
      .collection('manuscripts')
      .doc(manuscriptId)
      .collection('chapters')
      .doc(chapterId)

    await chapterRef.update({
      content: draft.content,
      wordCount: draft.wordCount,
      status: 'draft',
      aiGenerated: true,
      updatedAt: FieldValue.serverTimestamp(),
    })

    const chaptersSnap = await adminDb
      .collection('projects')
      .doc(projectId)
      .collection('manuscripts')
      .doc(manuscriptId)
      .collection('chapters')
      .orderBy('chapterNumber', 'asc')
      .get()

    let totalWordCount = 0
    let completedChapters = 0
    for (const doc of chaptersSnap.docs) {
      const c = doc.data()
      if (typeof c.wordCount === 'number') totalWordCount += c.wordCount
      if (c.status === 'draft' || c.status === 'complete') completedChapters += 1
    }

    await adminDb
      .collection('projects')
      .doc(projectId)
      .collection('manuscripts')
      .doc(manuscriptId)
      .update({
        completedChapters,
        totalWordCount,
        status: 'in_progress',
        updatedAt: FieldValue.serverTimestamp(),
      })

    return NextResponse.json({ content: draft.content, wordCount: draft.wordCount })
  } catch (error) {
    console.error('Error in write-chapter API route:', error)
    return NextResponse.json(
      {
        error: 'Failed to generate chapter',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
