import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/app/lib/firebase/admin'
import { validateSection } from '@/app/lib/agents/validation-agent'
import { checkAndIncrementUsage } from '@/app/lib/billing/usage'

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

    // Check usage limits
    const usageCheck = await checkAndIncrementUsage(userId, 'sections')
    if (!usageCheck.allowed) {
      return NextResponse.json(
        { error: 'usage_limit_exceeded', tier: usageCheck.tier, current: usageCheck.current, limit: usageCheck.limit },
        { status: 429 }
      )
    }

    const basePath = `projects/${projectId}/manuscripts/${manuscriptId}`
    const sectionPath = `${basePath}/chapters/${chapterId}/sections/${sectionId}`

    // Read section
    const secDoc = await adminDb.doc(sectionPath).get()
    if (!secDoc.exists) {
      return NextResponse.json({ error: 'Section not found' }, { status: 404 })
    }
    const sec = secDoc.data()!

    if (!sec.content || sec.content.trim().length === 0) {
      return NextResponse.json({ error: 'Section has no content to validate' }, { status: 400 })
    }

    // Get previous section summary for transition context
    let previousSectionSummary: string | undefined
    if (sec.sectionNumber > 1) {
      const prevSecSnap = await adminDb
        .collection(`${basePath}/chapters/${chapterId}/sections`)
        .where('sectionNumber', '==', sec.sectionNumber - 1)
        .limit(1)
        .get()
      if (!prevSecSnap.empty) {
        const prevSec = prevSecSnap.docs[0].data()
        previousSectionSummary = prevSec.approvedSummary || undefined
      }
    }

    const result = await validateSection(sec.title, sec.content, previousSectionSummary)

    return NextResponse.json(result)
  } catch (error) {
    console.error('[validate-section] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to validate section' },
      { status: 500 }
    )
  }
}
