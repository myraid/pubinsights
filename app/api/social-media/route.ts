import { NextResponse } from 'next/server'
import { getTemplateById, DEFAULT_TEMPLATE_ID } from '../../config/bannerbear'

const WEBHOOK_URL = process.env.SOCIAL_MEDIA_WEBHOOK_URL || 'https://hook.us2.make.com/32r31gedjy6b7wpqumi99eisb726lhqs'

if (!process.env.SOCIAL_MEDIA_WEBHOOK_URL) {
  console.warn('SOCIAL_MEDIA_WEBHOOK_URL environment variable not set, using default')
}

export async function POST(request: Request) {
  try {
    // Check if this is a book ad generation request or regular form submission
    const contentType = request.headers.get('content-type')
    
    if (contentType && contentType.includes('application/json')) {
      // Handle book ad generation request
      const { title, price, coverUrl, author, description } = await request.json()

      if (!title || !price || !coverUrl) {
        return NextResponse.json(
          { error: 'Title, price, and cover URL are required' },
          { status: 400 }
        )
      }

      // Create payload for book ad generation
      const payload = {
        type: 'book_ad_generation',
        bookData: {
          title,
          price,
          coverUrl,
          author: author || 'Unknown Author',
          description: description || 'Unknown Description'
        },
        timestamp: new Date().toISOString()
      }

      // Send data to Make.com webhook with timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout

      try {
        const webhookResponse = await fetch(WEBHOOK_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        })

        clearTimeout(timeoutId)

        if (!webhookResponse.ok) {
          const errorText = await webhookResponse.text()
          throw new Error(`Webhook returned ${webhookResponse.status}: ${errorText}`)
        }

        const webhookData = await webhookResponse.json()
        const template = getTemplateById(DEFAULT_TEMPLATE_ID)

        return NextResponse.json({
          success: true,
          message: 'Book ad generation request sent successfully',
          requestId: webhookData.requestId || Date.now().toString(),
          template: {
            id: template.id,
            name: template.name,
            dimensions: template.dimensions,
            platform: template.platform
          }
        })
      } catch (fetchError) {
        clearTimeout(timeoutId)
        if (fetchError instanceof Error && fetchError.name === 'AbortError') {
          throw new Error('Webhook request timed out after 30 seconds')
        }
        throw fetchError
      }

    } else {
      // Handle regular form submission (existing functionality)
      const formData = await request.formData()
      
      // Extract form data
      const title = formData.get('title')
      const postText = formData.get('postText')
      const bookDescription = formData.get('bookDescription')
      const bookCoverImage = formData.get('bookCoverImage')

      if (!title || !postText || !bookDescription || !bookCoverImage) {
        return NextResponse.json(
          { error: 'Missing required fields' },
          { status: 400 }
        )
      }

      // Convert book cover image to base64 if it's a File
      let bookCoverBase64 = null
      if (bookCoverImage instanceof File) {
        const arrayBuffer = await bookCoverImage.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        bookCoverBase64 = `data:${bookCoverImage.type};base64,${buffer.toString('base64')}`
      }

      // Create payload for the webhook
      const payload = {
        type: 'social_media_post',
        title,
        postText,
        bookDescription,
        bookCoverImage: bookCoverBase64,
        timestamp: new Date().toISOString()
      }

      // Send data to Make.com webhook with timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout

      try {
        const webhookResponse = await fetch(WEBHOOK_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        })

        clearTimeout(timeoutId)

        if (!webhookResponse.ok) {
          const errorText = await webhookResponse.text()
          throw new Error(`Webhook returned ${webhookResponse.status}: ${errorText}`)
        }

        const webhookData = await webhookResponse.json()

        return NextResponse.json({ 
          success: true, 
          message: 'Data successfully sent to webhook',
          requestId: webhookData.requestId || Date.now().toString()
        })
      } catch (fetchError) {
        clearTimeout(timeoutId)
        if (fetchError instanceof Error && fetchError.name === 'AbortError') {
          throw new Error('Webhook request timed out after 30 seconds')
        }
        throw fetchError
      }
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