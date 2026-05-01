import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/app/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'
import { ContextBuilder } from '@/app/lib/context/context-builder'
import { generateSectionDraft } from '@/app/lib/agents/section-writer-agent'
import { checkAndIncrementUsage } from '@/app/lib/billing/usage'

export const maxDuration = 120

export async function POST(request: NextRequest) {
  try {
    const { userId, projectId, manuscriptId, chapterId, sectionId, authorNotes, regenerate } =
      await request.json()

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

    // Status checks
    if (sec.status === 'approved') {
      return NextResponse.json(
        { error: 'Cannot write to an approved section. Create a new revision instead.' },
        { status: 409 }
      )
    }
    if (sec.status === 'review' && !regenerate) {
      return NextResponse.json(
        { error: 'Section already has content in review. Set regenerate=true to overwrite.' },
        { status: 409 }
      )
    }
    if (sec.status === 'generating') {
      return NextResponse.json(
        { error: 'Section is currently being generated. Please wait.' },
        { status: 409 }
      )
    }

    // Linear flow: section N requires section N-1 to be approved
    if (sec.sectionNumber > 1) {
      const prevSecSnap = await adminDb
        .collection(`${basePath}/chapters/${chapterId}/sections`)
        .where('sectionNumber', '==', sec.sectionNumber - 1)
        .limit(1)
        .get()

      if (!prevSecSnap.empty) {
        const prevSec = prevSecSnap.docs[0].data()
        if (prevSec.status !== 'approved') {
          return NextResponse.json(
            { error: `Section ${sec.sectionNumber - 1} must be approved before writing section ${sec.sectionNumber}` },
            { status: 409 }
          )
        }
      }
    }

    // Check usage
    const usageResult = await checkAndIncrementUsage(userId, 'sections')
    if (!usageResult.allowed) {
      return NextResponse.json(
        {
          error: 'Monthly section generation limit reached',
          tier: usageResult.tier,
          current: usageResult.current,
          limit: usageResult.limit,
        },
        { status: 429 }
      )
    }

    // If regenerating: save current content to revisionHistory
    if (regenerate && sec.content) {
      const revisionEntry = {
        version: (sec.revisionCount || 0) + 1,
        content: sec.content,
        resolvedComments: [],
        createdAt: FieldValue.serverTimestamp(),
      }

      let revisionHistory = sec.revisionHistory || []
      revisionHistory.push(revisionEntry)
      // Cap at 10
      if (revisionHistory.length > 10) {
        revisionHistory = revisionHistory.slice(revisionHistory.length - 10)
      }

      await adminDb.doc(sectionPath).update({
        revisionHistory,
        comments: [],
        updatedAt: FieldValue.serverTimestamp(),
      })
    }

    // Set status to generating
    await adminDb.doc(sectionPath).update({
      status: 'generating',
      updatedAt: FieldValue.serverTimestamp(),
    })

    try {
      // Build context
      const ctx = await ContextBuilder.forSectionGeneration(
        projectId,
        manuscriptId,
        chapterId,
        sec.sectionNumber
      )

      // Inject author notes
      if (authorNotes) {
        ctx.currentSection.authorNotes = authorNotes
      }

      // Generate draft
      const { content, wordCount } = await generateSectionDraft(ctx)

      // Update section
      await adminDb.doc(sectionPath).update({
        content,
        wordCount,
        status: 'review',
        aiGenerated: true,
        authorNotes: authorNotes || sec.authorNotes || '',
        revisionCount: regenerate ? (sec.revisionCount || 0) + 1 : 0,
        updatedAt: FieldValue.serverTimestamp(),
      })

      // Check for word count warning
      const estimatedWords = sec.estimatedWords || 1000
      let warning: string | undefined
      if (wordCount < estimatedWords * 0.5) {
        warning = `Generated ${wordCount} words, significantly below the target of ${estimatedWords}. Consider adding author notes for more detail.`
      } else if (wordCount > estimatedWords * 2) {
        warning = `Generated ${wordCount} words, significantly above the target of ${estimatedWords}. The section may need trimming.`
      }

      console.log(`[write-section] section=${sec.sectionNumber} words=${wordCount}`)

      return NextResponse.json({ content, wordCount, ...(warning ? { warning } : {}) })
    } catch (genError) {
      // Reset status on generation failure
      await adminDb.doc(sectionPath).update({
        status: sec.content ? 'review' : 'not_started',
        updatedAt: FieldValue.serverTimestamp(),
      })
      throw genError
    }
  } catch (error) {
    console.error('[write-section] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to write section' },
      { status: 500 }
    )
  }
}
