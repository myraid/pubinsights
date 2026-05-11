import { NextResponse } from 'next/server'
import { generateAdCopy, generateSocialPost } from '@/app/lib/agents/social-agent'
import { logGeneration } from '@/app/lib/agents/generation-logger'
import { MODEL } from '@/app/lib/agents/openai-client'
import { checkAndIncrementUsage } from '@/app/lib/billing/usage'

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get('content-type')

    if (contentType && contentType.includes('application/json')) {
      const { title, price, author, description, salePrice, userId } = await request.json()

      if (!userId) {
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
      }

      if (!title) {
        return NextResponse.json(
          { error: 'Title is required' },
          { status: 400 }
        )
      }

      // Check usage limits
      const usageCheck = await checkAndIncrementUsage(userId, 'social')
      if (!usageCheck.allowed) {
        return NextResponse.json(
          { error: 'usage_limit_exceeded', tier: usageCheck.tier, current: usageCheck.current, limit: usageCheck.limit },
          { status: 429 }
        )
      }

      const generatedContent = await generateAdCopy(
        { title, price, author, description },
        salePrice || price || '0'
      )

      if (userId) {
        logGeneration(userId, 'social_ad', { title, salePrice }, { generatedContent } as Record<string, unknown>, MODEL);
      }

      return NextResponse.json({
        success: true,
        generatedContent,
      })
    } else {
      const formData = await request.formData()

      const title = formData.get('title') as string
      const bookDescription = formData.get('bookDescription') as string
      const contentTypeField = formData.get('contentType') as string
      const salePrice = formData.get('salePrice') as string | null
      const postInfo = formData.get('postInfo') as string | null
      const userId = formData.get('userId') as string | null

      if (!userId) {
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
      }

      if (!title || !bookDescription) {
        return NextResponse.json(
          { error: 'Title and book description are required' },
          { status: 400 }
        )
      }

      // Check usage limits
      const usageCheck2 = await checkAndIncrementUsage(userId, 'social')
      if (!usageCheck2.allowed) {
        return NextResponse.json(
          { error: 'usage_limit_exceeded', tier: usageCheck2.tier, current: usageCheck2.current, limit: usageCheck2.limit },
          { status: 429 }
        )
      }

      let generatedContent;
      let logType: 'social_ad' | 'social_post';

      if (contentTypeField === 'ad') {
        generatedContent = await generateAdCopy(
          { title, description: bookDescription },
          salePrice || '0'
        )
        logType = 'social_ad';
      } else {
        generatedContent = await generateSocialPost(
          title,
          bookDescription,
          postInfo || ''
        )
        logType = 'social_post';
      }

      if (userId) {
        logGeneration(userId, logType, { title, bookDescription, contentType: contentTypeField }, { generatedContent } as Record<string, unknown>, MODEL);
      }

      return NextResponse.json({
        success: true,
        generatedContent,
      })
    }
  } catch (error) {
    console.error('Error in social-media API route:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process request',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
