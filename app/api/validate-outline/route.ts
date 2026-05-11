import { NextResponse } from 'next/server'
import { validateOutline } from '@/app/lib/agents/outline-agent'
import { checkAndIncrementUsage } from '@/app/lib/billing/usage'

export async function POST(request: Request) {
  try {
    const { userId, outline } = await request.json()

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    if (!outline || !outline.Title || !Array.isArray(outline.Chapters)) {
      return NextResponse.json({ error: 'Valid outline with Title and Chapters is required' }, { status: 400 })
    }

    // Check usage limits (counts as an outline generation)
    const usageCheck = await checkAndIncrementUsage(userId, 'outlines')
    if (!usageCheck.allowed) {
      return NextResponse.json(
        {
          error: 'usage_limit_exceeded',
          tier: usageCheck.tier,
          current: usageCheck.current,
          limit: usageCheck.limit,
        },
        { status: 429 }
      )
    }

    const content = await validateOutline(outline)
    const result = JSON.parse(content)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error validating outline:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to validate outline'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
