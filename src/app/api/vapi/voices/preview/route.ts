import { NextRequest, NextResponse } from 'next/server'
import { getCallRoutingConfig } from '@/lib/callRouting'
import { requireOrgId } from '@/lib/orgResolver'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function getElevenLabsApiKey(config: { integrations?: { elevenLabs?: { apiKey?: string } } } | null): string {
  return config?.integrations?.elevenLabs?.apiKey || process.env.ELEVENLABS_API_KEY || ''
}

const PT_BR_PREVIEW_TEXT = 'Olá! Eu sou a voz do seu assistente virtual. Como posso ajudá-lo hoje?'

// GET - Gerar preview de voz em PT-BR via ElevenLabs TTS
export async function GET(req: NextRequest) {
  try {
    const voiceId = req.nextUrl.searchParams.get('voiceId')
    if (!voiceId) {
      return NextResponse.json({ error: 'voiceId é obrigatório' }, { status: 400 })
    }

    const orgCtx = await requireOrgId(req.headers)
    if (!orgCtx) {
      return NextResponse.json({ error: 'orgId is required' }, { status: 401 })
    }
    const orgId = orgCtx.orgId
    const config = orgId ? await getCallRoutingConfig(orgId) : null
    const elevenLabsKey = getElevenLabsApiKey(config)

    if (!elevenLabsKey) {
      return NextResponse.json({ error: 'ElevenLabs não configurado' }, { status: 400 })
    }

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': elevenLabsKey,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg',
      },
      body: JSON.stringify({
        text: PT_BR_PREVIEW_TEXT,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
        },
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[VOICE PREVIEW] ElevenLabs TTS error ${response.status}:`, errorText)
      return NextResponse.json({ error: `ElevenLabs retornou status ${response.status}` }, { status: response.status })
    }

    const audioBuffer = await response.arrayBuffer()

    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'public, max-age=86400',
      },
    })
  } catch (error) {
    console.error('[VOICE PREVIEW] Error:', error)
    return NextResponse.json({ error: 'Failed to generate preview' }, { status: 500 })
  }
}
