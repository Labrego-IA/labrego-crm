'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  PlayIcon,
  PauseIcon,
  SpeakerWaveIcon,
} from '@heroicons/react/24/outline'
import Skeleton from '@/components/shared/Skeleton'

interface VoiceOption {
  voiceId: string
  name: string
  description?: string
  gender?: string
  language?: string
  previewUrl?: string
  provider?: string
}

interface VoiceSelectorProps {
  orgId: string
  selectedVoiceId?: string
  onSelect: (voiceId: string, provider: string) => void
}

export default function VoiceSelector({ orgId, selectedVoiceId, onSelect }: VoiceSelectorProps) {
  const [voices, setVoices] = useState<VoiceOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [genderFilter, setGenderFilter] = useState<string>('')
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [loadingPreview, setLoadingPreview] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    async function fetchVoices() {
      setLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams()
        params.set('lang', 'pt')
        if (genderFilter) params.set('gender', genderFilter)

        const resp = await fetch(`/api/vapi/voices?${params.toString()}`, {
          headers: { 'x-org-id': orgId },
        })

        if (!resp.ok) {
          const data = await resp.json()
          setError(data.error || 'Falha ao carregar vozes')
          return
        }

        const data = await resp.json()
        setVoices(Array.isArray(data) ? data : [])
      } catch {
        setError('Erro de conexao')
      } finally {
        setLoading(false)
      }
    }
    fetchVoices()
  }, [orgId, genderFilter])

  // Play PT-BR preview via TTS endpoint, fallback to static previewUrl
  const playPreview = useCallback(async (voice: VoiceOption) => {
    // If already playing this voice, pause it
    if (playingId === voice.voiceId) {
      audioRef.current?.pause()
      setPlayingId(null)
      return
    }

    // Stop any currently playing audio
    if (audioRef.current) {
      audioRef.current.pause()
    }

    setLoadingPreview(voice.voiceId)

    try {
      // Try PT-BR TTS preview first
      const resp = await fetch(`/api/vapi/voices/preview?voiceId=${voice.voiceId}`, {
        headers: { 'x-org-id': orgId },
      })

      if (resp.ok && resp.headers.get('content-type')?.includes('audio')) {
        const blob = await resp.blob()
        const url = URL.createObjectURL(blob)
        const audio = new Audio(url)
        audio.onended = () => {
          setPlayingId(null)
          URL.revokeObjectURL(url)
        }
        audio.onerror = () => {
          setPlayingId(null)
          URL.revokeObjectURL(url)
        }
        await audio.play()
        audioRef.current = audio
        setPlayingId(voice.voiceId)
        setLoadingPreview(null)
        return
      }
    } catch {
      // PT-BR preview failed, try fallback
    }

    // Fallback: use static previewUrl (PT-BR native voices — Story 24.4)
    if (voice.previewUrl) {
      const audio = new Audio(voice.previewUrl)
      audio.onended = () => setPlayingId(null)
      audio.onerror = () => setPlayingId(null)
      audio.play().catch(() => setPlayingId(null))
      audioRef.current = audio
      setPlayingId(voice.voiceId)
    }

    setLoadingPreview(null)
  }, [playingId, orgId])

  const handleSelectVoice = useCallback((voice: VoiceOption) => {
    onSelect(voice.voiceId, voice.provider || '11labs')
    // Auto-play PT-BR preview when selecting a voice
    if (playingId !== voice.voiceId) {
      playPreview(voice)
    }
  }, [onSelect, playingId, playPreview])

  useEffect(() => {
    return () => {
      audioRef.current?.pause()
    }
  }, [])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SpeakerWaveIcon className="w-5 h-5 text-primary-600" />
          <h3 className="text-sm font-semibold text-slate-800 dark:text-white">Voz do Agente</h3>
        </div>
        <select
          value={genderFilter}
          onChange={(e) => setGenderFilter(e.target.value)}
          className="text-xs border border-slate-200 dark:border-white/10 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
        >
          <option value="">Todos</option>
          <option value="female">Feminino</option>
          <option value="male">Masculino</option>
        </select>
      </div>

      {!selectedVoiceId && (
        <p className="text-xs text-slate-400">Usando voz padrao do assistente</p>
      )}

      {selectedVoiceId && !loading && voices.length > 0 && !voices.some(v => v.voiceId === selectedVoiceId) && (
        <div className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg border border-amber-200">
          A voz selecionada anteriormente nao esta mais disponivel. Selecione uma nova voz abaixo.
        </div>
      )}

      {loading ? (
        <Skeleton variant="card" count={3} />
      ) : error ? (
        <div className="text-sm text-red-500 bg-red-50 px-4 py-3 rounded-lg">{error}</div>
      ) : voices.length === 0 ? (
        <p className="text-sm text-slate-400 py-6 text-center">Nenhuma voz encontrada para os filtros selecionados.</p>
      ) : (
        <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
          {voices.map((voice) => {
            const isSelected = voice.voiceId === selectedVoiceId
            const isPlaying = playingId === voice.voiceId
            const isLoadingPreview = loadingPreview === voice.voiceId

            return (
              <button
                key={voice.voiceId}
                onClick={() => handleSelectVoice(voice)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                  isSelected
                    ? 'border-primary-500 bg-primary-50 ring-1 ring-primary-500/30'
                    : 'border-slate-200 hover:border-primary-300 hover:bg-slate-50 dark:bg-white/5'
                }`}
              >
                {/* Play/Pause indicator */}
                <span
                  onClick={(e) => {
                    e.stopPropagation()
                    playPreview(voice)
                  }}
                  className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-colors cursor-pointer ${
                    isPlaying
                      ? 'bg-primary-600 text-white animate-pulse'
                      : isLoadingPreview
                        ? 'bg-primary-100 text-primary-400'
                        : isSelected
                          ? 'bg-primary-100 text-primary-600'
                          : 'bg-slate-100 dark:bg-white/10 text-slate-500 hover:bg-primary-100 hover:text-primary-600'
                  }`}
                >
                  {isLoadingPreview ? (
                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : isPlaying ? (
                    <PauseIcon className="w-4 h-4" />
                  ) : (
                    <PlayIcon className="w-4 h-4" />
                  )}
                </span>

                {/* Voice info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-800 dark:text-white truncate">{voice.name}</span>
                    {voice.gender && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-white/10 text-slate-500 capitalize">
                        {voice.gender === 'female' ? 'Feminina' : voice.gender === 'male' ? 'Masculina' : voice.gender}
                      </span>
                    )}
                  </div>
                  {voice.description && (
                    <p className="text-xs text-slate-400 truncate">{voice.description}</p>
                  )}
                </div>

                {/* Selected indicator */}
                {isSelected && (
                  <span className="w-5 h-5 rounded-full bg-primary-600 flex items-center justify-center flex-shrink-0">
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
