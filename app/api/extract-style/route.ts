import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/app/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'
import { ContextBuilder } from '@/app/lib/context/context-builder'
import { extractStyleProfile } from '@/app/lib/agents/style-extractor-agent'
import { checkAndIncrementUsage } from '@/app/lib/billing/usage'

export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    const { userId, projectId, manuscriptId, sectionIds } = await request.json()

    if (!userId || !projectId || !manuscriptId) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, projectId, manuscriptId' },
        { status: 400 }
      )
    }

    if (!sectionIds || !Array.isArray(sectionIds) || sectionIds.length < 2) {
      return NextResponse.json(
        { error: 'At least 2 section IDs are required for style extraction' },
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

    // Read existing author overrides from manuscript
    const msDoc = await adminDb.doc(basePath).get()
    if (!msDoc.exists) {
      return NextResponse.json({ error: 'Manuscript not found' }, { status: 404 })
    }
    const ms = msDoc.data()!
    const authorOverrides = ms.styleProfile?.authorOverrides || undefined

    // Get section content via ContextBuilder
    const { sections } = await ContextBuilder.forStyleExtraction(
      projectId,
      manuscriptId,
      sectionIds
    )

    if (sections.length < 2) {
      return NextResponse.json(
        { error: 'Could not find enough sections with content for style extraction' },
        { status: 400 }
      )
    }

    // Call style extractor agent
    const styleResult = await extractStyleProfile(sections, authorOverrides)

    // Save to manuscript doc
    const styleProfile = {
      ...styleResult,
      extractedFromSections: sectionIds,
      authorOverrides: authorOverrides || null,
      lastExtractedAt: FieldValue.serverTimestamp(),
    }

    await adminDb.doc(basePath).update({
      styleProfile,
      updatedAt: FieldValue.serverTimestamp(),
    })

    console.log(`[extract-style] sections=${sectionIds.length} profile extracted`)

    return NextResponse.json({ styleProfile })
  } catch (error) {
    console.error('[extract-style] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to extract style' },
      { status: 500 }
    )
  }
}
