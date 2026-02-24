import { NextRequest, NextResponse } from 'next/server'
import { getCallRoutingConfig } from '@/lib/callRouting'
import { resolveOrgByEmail, getOrgIdFromHeaders } from '@/lib/orgResolver'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function resolveOrgId(req: NextRequest): Promise<string> {
  const email = req.headers.get('x-user-email')
  if (email) {
    const ctx = await resolveOrgByEmail(email)
    if (ctx) return ctx.orgId
  }
  const fromHeader = getOrgIdFromHeaders(req.headers)
  if (fromHeader) return fromHeader
  return process.env.DEFAULT_ORG_ID || ''
}

interface VoiceResponse {
  voiceId: string
  name: string
  description?: string
  gender?: string
  language?: string
  previewUrl?: string
  provider: string
}

// Curated list of PT-BR native ElevenLabs voices with Portuguese preview audio (Story 24.4)
// These are community-shared Professional Voice Clones with verified PT-BR locale and Brazilian accent.
// Preview URLs confirmed accessible and in Portuguese.
const FALLBACK_PT_VOICES: VoiceResponse[] = [
  { voiceId: '33B4UnXyTNbgLmdEDh5P', name: 'Keren', gender: 'female', language: 'pt-BR', provider: '11labs', description: 'Voz feminina doce, vibrante e rítmica', previewUrl: 'https://storage.googleapis.com/eleven-public-prod/custom/voices/33B4UnXyTNbgLmdEDh5P/ArnzDsFaz6KDoDcDD8V2.mp3' },
  { voiceId: '36rVQA1AOIPwpA3Hg1tC', name: 'Matheus', gender: 'male', language: 'pt-BR', provider: '11labs', description: 'Voz masculina amigável e enérgica', previewUrl: 'https://storage.googleapis.com/eleven-public-prod/custom/voices/36rVQA1AOIPwpA3Hg1tC/ewP6z1S1gE5Mb9nBSNaV.mp3' },
  { voiceId: 'RGymW84CSmfVugnA5tvA', name: 'Roberta', gender: 'female', language: 'pt-BR', provider: '11labs', description: 'Voz feminina suave e confiante', previewUrl: 'https://storage.googleapis.com/eleven-public-prod/database/user/t1nBFVlw8ahi8WVJ0bXtyohGNAI2/voices/RGymW84CSmfVugnA5tvA/u9w6JI45LSUeTYX8mZnR.mp3' },
  { voiceId: 'ZxhW0J5Q17DnNxZM6VDC', name: 'Gabriel', gender: 'male', language: 'pt-BR', provider: '11labs', description: 'Voz masculina neutra e profissional', previewUrl: 'https://storage.googleapis.com/eleven-public-prod/database/user/PSGn8w01FadRYcS02dNKq1u8sX03/voices/ZxhW0J5Q17DnNxZM6VDC/9f1e5b53-77e9-4a01-80cc-d016d5694513.mp3' },
  { voiceId: 'CstacWqMhJQlnfLPxRG4', name: 'Will', gender: 'male', language: 'pt-BR', provider: '11labs', description: 'Voz masculina grave, suave e afetuosa', previewUrl: 'https://storage.googleapis.com/eleven-public-prod/database/user/FjJ1S0dyr4ceeNIPe2rWGz4lcH53/voices/CstacWqMhJQlnfLPxRG4/4jr0jR4qABSfo2InZ89w.mp3' },
]

function getElevenLabsApiKey(config: { integrations?: { elevenLabs?: { apiKey?: string } } } | null): string {
  return config?.integrations?.elevenLabs?.apiKey || process.env.ELEVENLABS_API_KEY || ''
}

// GET - Listar vozes disponiveis (ElevenLabs API)
export async function GET(req: NextRequest) {
  try {
    const orgId = await resolveOrgId(req)
    const config = orgId ? await getCallRoutingConfig(orgId) : null
    const elevenLabsKey = getElevenLabsApiKey(config)

    const lang = req.nextUrl.searchParams.get('lang') || ''
    const gender = req.nextUrl.searchParams.get('gender') || ''

    // If no ElevenLabs key, return curated fallback list
    if (!elevenLabsKey) {
      let filtered = FALLBACK_PT_VOICES
      if (gender) {
        filtered = filtered.filter(v => v.gender?.toLowerCase() === gender.toLowerCase())
      }
      return NextResponse.json(filtered)
    }

    // Fetch voices from ElevenLabs API
    const response = await fetch('https://api.elevenlabs.io/v1/voices', {
      headers: { 'xi-api-key': elevenLabsKey },
    })

    if (!response.ok) {
      console.error(`[VAPI VOICES] ElevenLabs API error: ${response.status}`)
      // Fallback to curated list on error
      let filtered = FALLBACK_PT_VOICES
      if (gender) {
        filtered = filtered.filter(v => v.gender?.toLowerCase() === gender.toLowerCase())
      }
      return NextResponse.json(filtered)
    }

    const data = await response.json()
    const voices: VoiceResponse[] = (data.voices || []).map((v: {
      voice_id: string
      name: string
      labels?: { description?: string; gender?: string; language?: string; accent?: string }
      preview_url?: string
    }) => ({
      voiceId: v.voice_id,
      name: v.name,
      description: v.labels?.description || '',
      gender: v.labels?.gender || '',
      language: v.labels?.language || v.labels?.accent || '',
      previewUrl: v.preview_url || '',
      provider: '11labs',
    }))

    // Filter by language
    let filtered = voices
    if (lang) {
      filtered = filtered.filter(v =>
        v.language?.toLowerCase().includes(lang.toLowerCase()) ||
        v.name?.toLowerCase().includes(lang.toLowerCase())
      )
    }
    if (gender) {
      filtered = filtered.filter(v =>
        v.gender?.toLowerCase() === gender.toLowerCase()
      )
    }

    // If no voices match the language filter, return the fallback list
    if (filtered.length === 0 && lang) {
      filtered = FALLBACK_PT_VOICES
      if (gender) {
        filtered = filtered.filter(v => v.gender?.toLowerCase() === gender.toLowerCase())
      }
    }

    return NextResponse.json(filtered)
  } catch (error) {
    console.error('[VAPI VOICES] Error:', error)
    return NextResponse.json({ error: 'Failed to fetch voices' }, { status: 500 })
  }
}
