import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'

const PLATFORM_SIZES: Record<string, { width: number; height: number }> = {
  facebook: { width: 1200, height: 628 },
  instagram: { width: 1080, height: 1080 },
  twitter: { width: 1200, height: 675 },
  linkedin: { width: 1200, height: 627 },
}

let dmSansRegular: ArrayBuffer | null = null
let dmSansBold: ArrayBuffer | null = null
let playfairBold: ArrayBuffer | null = null

async function loadFonts() {
  if (!dmSansRegular) {
    const [reg, bold, play] = await Promise.all([
      fetch('https://fonts.gstatic.com/s/dmsans/v17/rP2tp2ywxg089UriI5-g4vlH9VoD8CmcqZG40F9JadbnoEwAopxhTg.ttf').then(r => r.arrayBuffer()),
      fetch('https://fonts.gstatic.com/s/dmsans/v17/rP2tp2ywxg089UriI5-g4vlH9VoD8CmcqZG40F9JadbnoEwARZthTg.ttf').then(r => r.arrayBuffer()),
      fetch('https://fonts.gstatic.com/s/playfairdisplay/v40/nuFvD-vYSZviVYUb_rj3ij__anPXJzDwcbmjWBN2PKeiukDQ.ttf').then(r => r.arrayBuffer()),
    ])
    dmSansRegular = reg
    dmSansBold = bold
    playfairBold = play
  }
  return { dmSansRegular: dmSansRegular!, dmSansBold: dmSansBold!, playfairBold: playfairBold! }
}

interface LayoutProps {
  title: string
  author: string
  copyText: string
  price: string
  imageUrl: string
  width: number
  height: number
}

function CleanMinimal({ title, author, copyText, price, imageUrl, width, height }: LayoutProps) {
  const isSquare = Math.abs(width - height) < 100
  return (
    <div style={{
      display: 'flex',
      flexDirection: isSquare ? 'column' : 'row',
      width: '100%',
      height: '100%',
      background: '#FAFAFE',
      padding: '48px',
      fontFamily: 'DM Sans',
      alignItems: 'center',
      gap: '40px',
      position: 'relative',
    }}>
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '6px', background: 'linear-gradient(90deg, #8400B8, #AA00DD)', display: 'flex' }} />

      {imageUrl ? (
        <div style={{
          display: 'flex',
          flexShrink: 0,
          width: isSquare ? '280px' : '220px',
          height: isSquare ? '380px' : '320px',
          borderRadius: '8px',
          overflow: 'hidden',
          boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
        }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
      ) : <div style={{ display: 'none' }} />}

      <div style={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        gap: '12px',
        justifyContent: 'center',
      }}>
        <div style={{ fontFamily: 'Playfair Display', fontSize: isSquare ? '36px' : '42px', fontWeight: 700, color: '#1a1a2e', lineHeight: 1.2, display: 'flex' }}>
          {title}
        </div>
        {author ? (
          <div style={{ fontSize: '20px', color: '#6E6E6E', fontWeight: 400, display: 'flex' }}>
            by {author}
          </div>
        ) : <div style={{ display: 'none' }} />}
        <div style={{ fontSize: '18px', color: '#333', lineHeight: 1.5, marginTop: '8px', display: 'flex' }}>
          {copyText.slice(0, 200)}
        </div>
        {price ? (
          <div style={{ display: 'flex', alignItems: 'center', marginTop: '8px' }}>
            <div style={{ fontSize: '28px', fontWeight: 700, color: '#8400B8', display: 'flex' }}>{'$'}{price}</div>
          </div>
        ) : <div style={{ display: 'none' }} />}
      </div>

      <div style={{ position: 'absolute', bottom: '16px', right: '24px', fontSize: '13px', color: '#bbb', fontWeight: 300, display: 'flex' }}>
        PubInsights
      </div>
    </div>
  )
}

function BoldPromotional({ title, author, copyText, price, imageUrl, width, height }: LayoutProps) {
  const isSquare = Math.abs(width - height) < 100
  return (
    <div style={{
      display: 'flex',
      flexDirection: isSquare ? 'column' : 'row',
      width: '100%',
      height: '100%',
      background: 'linear-gradient(135deg, #3D0066 0%, #5C0099 50%, #7B00CC 100%)',
      padding: '48px',
      fontFamily: 'DM Sans',
      alignItems: 'center',
      gap: '36px',
      position: 'relative',
    }}>
      {imageUrl ? (
        <div style={{
          display: 'flex',
          flexShrink: 0,
          width: isSquare ? '300px' : '230px',
          height: isSquare ? '400px' : '330px',
          borderRadius: '12px',
          overflow: 'hidden',
          boxShadow: '0 0 60px rgba(170, 0, 221, 0.4), 0 12px 40px rgba(0,0,0,0.3)',
        }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
      ) : <div style={{ display: 'none' }} />}

      <div style={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        gap: '14px',
        justifyContent: 'center',
      }}>
        <div style={{ fontFamily: 'Playfair Display', fontSize: isSquare ? '40px' : '46px', fontWeight: 700, color: '#FFFFFF', lineHeight: 1.15, display: 'flex' }}>
          {title}
        </div>
        {author ? (
          <div style={{ fontSize: '20px', color: 'rgba(255,255,255,0.75)', fontWeight: 400, display: 'flex' }}>
            by {author}
          </div>
        ) : <div style={{ display: 'none' }} />}
        <div style={{ fontSize: '17px', color: 'rgba(255,255,255,0.85)', lineHeight: 1.5, marginTop: '4px', display: 'flex' }}>
          {copyText.slice(0, 180)}
        </div>
        {price ? (
          <div style={{ display: 'flex', alignItems: 'center', marginTop: '12px' }}>
            <div style={{
              display: 'flex',
              background: 'linear-gradient(135deg, #FFD700, #FFA500)',
              padding: '10px 24px',
              borderRadius: '30px',
              fontSize: '24px',
              fontWeight: 700,
              color: '#3D0066',
            }}>
              {'$'}{price}
            </div>
          </div>
        ) : <div style={{ display: 'none' }} />}
      </div>

      <div style={{ position: 'absolute', bottom: '16px', right: '24px', fontSize: '13px', color: 'rgba(255,255,255,0.35)', fontWeight: 300, display: 'flex' }}>
        PubInsights
      </div>
    </div>
  )
}

function QuoteReview({ title, author, copyText, width, height }: LayoutProps) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      height: '100%',
      background: 'linear-gradient(180deg, #1a1a2e 0%, #2d1b4e 100%)',
      fontFamily: 'DM Sans',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '60px',
      position: 'relative',
    }}>
      <div style={{ fontSize: '80px', color: '#AA00DD', lineHeight: 1, marginBottom: '-10px', fontFamily: 'Playfair Display', display: 'flex' }}>
        {'\u201C'}
      </div>

      <div style={{
        fontFamily: 'Playfair Display',
        fontSize: Math.abs(width - height) < 100 ? '32px' : '36px',
        fontWeight: 700,
        color: '#FFFFFF',
        lineHeight: 1.4,
        textAlign: 'center',
        maxWidth: '85%',
        display: 'flex',
      }}>
        {copyText.slice(0, 200)}
      </div>

      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        marginTop: '28px',
        gap: '8px',
      }}>
        <div style={{ width: '40px', height: '2px', background: '#AA00DD', display: 'flex' }} />
        <div style={{ fontFamily: 'Playfair Display', fontSize: '24px', color: '#FFFFFF', fontWeight: 700, display: 'flex' }}>
          {title}
        </div>
        {author ? (
          <div style={{ fontSize: '18px', color: 'rgba(255,255,255,0.65)', display: 'flex' }}>
            by {author}
          </div>
        ) : <div style={{ display: 'none' }} />}
      </div>

      <div style={{ position: 'absolute', bottom: '16px', right: '24px', fontSize: '13px', color: 'rgba(255,255,255,0.3)', fontWeight: 300, display: 'flex' }}>
        PubInsights
      </div>
    </div>
  )
}

type StyleName = 'clean' | 'bold' | 'quote'

const STYLE_RENDERERS: Record<StyleName, (props: LayoutProps) => React.JSX.Element> = {
  clean: CleanMinimal,
  bold: BoldPromotional,
  quote: QuoteReview,
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { title, author, price, imageUrl, copyText, platform, style } = body as {
      title: string
      author?: string
      price?: string
      imageUrl?: string
      copyText: string
      platform: string
      style: string
    }

    if (!title || !copyText) {
      return new Response(JSON.stringify({ error: 'Title and copyText are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const size = PLATFORM_SIZES[platform.toLowerCase()] ?? PLATFORM_SIZES.facebook
    const styleName = (style?.toLowerCase() ?? 'clean') as StyleName
    const Renderer = STYLE_RENDERERS[styleName] ?? STYLE_RENDERERS.clean

    let fontData: { dmSansRegular: ArrayBuffer; dmSansBold: ArrayBuffer; playfairBold: ArrayBuffer } | null = null
    try {
      fontData = await loadFonts()
    } catch (fontError) {
      console.warn('Font loading failed, using defaults:', fontError)
    }

    const imageOptions: ConstructorParameters<typeof ImageResponse>[1] = {
      width: size.width,
      height: size.height,
    }

    if (fontData) {
      imageOptions.fonts = [
        { name: 'DM Sans', data: fontData.dmSansRegular, weight: 400 as const, style: 'normal' as const },
        { name: 'DM Sans', data: fontData.dmSansBold, weight: 700 as const, style: 'normal' as const },
        { name: 'Playfair Display', data: fontData.playfairBold, weight: 700 as const, style: 'normal' as const },
      ]
    }

    return new ImageResponse(
      <Renderer
        title={title}
        author={author || ''}
        copyText={copyText}
        price={price || ''}
        imageUrl={imageUrl || ''}
        width={size.width}
        height={size.height}
      />,
      imageOptions
    )
  } catch (error) {
    console.error('Error generating image:', error)
    return new Response(JSON.stringify({
      error: 'Failed to generate image',
      details: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
