import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/app/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'
import { ContextBuilder } from '@/app/lib/context/context-builder'
import { reviseSection } from '@/app/lib/agents/revision-agent'

export const maxDuration = 120

export async function POST(request: NextRequest) {
  try {
    const { userId, projectId, manuscriptId, chapterId, sectionId, comments } =
      await request.json()

    if (!userId || !projectId || !manuscriptId || !chapterId || !sectionId) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, projectId, manuscriptId, chapterId, sectionId' },
        { status: 400 }
      )
    }

    if (!comments || !Array.isArray(comments) || comments.length === 0) {
      return NextResponse.json(
        { error: 'Comments array is required and must not be empty' },
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
        { error: `Section must be in "review" status to revise. Current status: ${sec.status}` },
        { status: 409 }
      )
    }

    // Build context
    const ctx = await ContextBuilder.forRevision(
      projectId,
      manuscriptId,
      chapterId,
      sectionId
    )

    // Call revision agent
    const result = await reviseSection(ctx)

    // If content unchanged, return early
    if (result.content === sec.content) {
      return NextResponse.json({
        content: sec.content,
        wordCount: sec.wordCount,
        changesApplied: [],
        message: 'No changes needed - the AI determined the content already addresses the feedback.',
      })
    }

    // Save old content to revisionHistory (cap at 10)
    const revisionEntry = {
      version: (sec.revisionCount || 0) + 1,
      content: sec.content,
      resolvedComments: comments.map((c: { id?: string }) => c.id).filter(Boolean),
      createdAt: FieldValue.serverTimestamp(),
    }

    let revisionHistory = sec.revisionHistory || []
    revisionHistory.push(revisionEntry)
    if (revisionHistory.length > 10) {
      revisionHistory = revisionHistory.slice(revisionHistory.length - 10)
    }

    // Mark addressed comments as resolved
    const updatedComments = (sec.comments || []).map(
      (c: { id?: string; status: string; selectedText: string; authorFeedback: string }) => {
        const wasAddressed = comments.some(
          (submitted: { selectedText?: string; id?: string }) =>
            submitted.id === c.id || submitted.selectedText === c.selectedText
        )
        if (wasAddressed) {
          return { ...c, status: 'resolved' }
        }
        return c
      }
    )

    // Update section
    await adminDb.doc(sectionPath).update({
      content: result.content,
      wordCount: result.wordCount,
      revisionCount: (sec.revisionCount || 0) + 1,
      revisionHistory,
      comments: updatedComments,
      updatedAt: FieldValue.serverTimestamp(),
    })

    console.log(`[revise-section] section=${sec.sectionNumber} changes=${result.changesApplied.length}`)

    return NextResponse.json({
      content: result.content,
      wordCount: result.wordCount,
      changesApplied: result.changesApplied,
    })
  } catch (error) {
    console.error('[revise-section] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to revise section' },
      { status: 500 }
    )
  }
}
