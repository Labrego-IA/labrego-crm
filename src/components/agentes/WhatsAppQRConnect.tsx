'use client'

import { useState, useEffect, useCallback } from 'react'
import type { WhatsAppConnectionStatus } from '@/types/agentConfig'

interface WhatsAppQRConnectProps {
  orgId: string
  onStatusChange?: (status: WhatsAppConnectionStatus) => void
}

export default function WhatsAppQRConnect({ orgId, onStatusChange }: WhatsAppQRConnectProps) {
  const [status, setStatus] = useState<WhatsAppConnectionStatus>('disconnected')
  const [qrCode, setQrCode] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const updateStatus = useCallback((newStatus: WhatsAppConnectionStatus) => {
    setStatus(newStatus)
    onStatusChange?.(newStatus)
  }, [onStatusChange])

  // Polling de status quando conectando/qr_ready
  useEffect(() => {
    if (status !== 'connecting' && status !== 'qr_ready') return

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/agent/whatsapp/status?orgId=${orgId}`)
        const data = await res.json()

        if (data.status === 'connected') {
          updateStatus('connected')
          setPhoneNumber(data.phoneNumber || '')
          setQrCode('')
        } else if (data.qrCode) {
          setQrCode(data.qrCode)
          updateStatus('qr_ready')
        }
      } catch {
        // Silencioso — polling continua
      }
    }, 5000)

    return () => clearInterval(interval)
  }, [status, orgId, updateStatus])

  // Carregar status inicial
  useEffect(() => {
    async function loadStatus() {
      try {
        const res = await fetch(`/api/agent/whatsapp/status?orgId=${orgId}`)
        const data = await res.json()
        updateStatus(data.status || 'disconnected')
        setPhoneNumber(data.phoneNumber || '')
        if (data.qrCode) setQrCode(data.qrCode)
      } catch {
        updateStatus('disconnected')
      }
    }
    loadStatus()
  }, [orgId, updateStatus])

  const handleConnect = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/agent/whatsapp/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Erro ao conectar')
        return
      }

      if (data.qrCode) {
        setQrCode(data.qrCode)
        updateStatus('qr_ready')
      } else {
        updateStatus('connecting')
      }
    } catch (err) {
      setError('Erro ao conectar WhatsApp')
    } finally {
      setLoading(false)
    }
  }

  const handleDisconnect = async () => {
    setLoading(true)
    try {
      await fetch('/api/agent/whatsapp/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId }),
      })
      updateStatus('disconnected')
      setQrCode('')
      setPhoneNumber('')
    } catch {
      setError('Erro ao desconectar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
          <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 24 24">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
            <path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492a.75.75 0 00.917.918l4.462-1.496A11.945 11.945 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-2.24 0-4.326-.724-6.022-1.95l-.42-.315-2.647.887.888-2.649-.315-.42A9.956 9.956 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
          </svg>
          Conexao WhatsApp
        </h3>
        <StatusBadge status={status} />
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-300 rounded-xl text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Desconectado */}
      {status === 'disconnected' && (
        <div className="text-center py-8">
          <p className="text-slate-600 mb-4">Conecte seu WhatsApp para ativar o agente de atendimento.</p>
          <button
            onClick={handleConnect}
            disabled={loading}
            className="px-6 py-3 bg-green-600 hover:bg-green-500 text-slate-800 font-medium rounded-xl transition-colors disabled:opacity-50"
          >
            {loading ? 'Conectando...' : 'Conectar WhatsApp'}
          </button>
        </div>
      )}

      {/* QR Code */}
      {(status === 'qr_ready' || status === 'connecting') && (
        <div className="text-center py-4">
          <p className="text-slate-600 mb-4">Escaneie o QR Code com seu WhatsApp para conectar:</p>
          {qrCode ? (
            <div className="inline-block p-4 bg-white rounded-2xl mb-4">
              <img
                src={qrCode.startsWith('data:') ? qrCode : `data:image/png;base64,${qrCode}`}
                alt="QR Code WhatsApp"
                className="w-64 h-64"
              />
            </div>
          ) : (
            <div className="inline-flex items-center justify-center w-64 h-64 bg-slate-100 rounded-2xl mb-4">
              <div className="animate-spin w-8 h-8 border-2 border-cyan-600 border-t-transparent rounded-full" />
            </div>
          )}
          <p className="text-slate-400 text-sm">Aguardando escaneamento...</p>
          <button
            onClick={handleDisconnect}
            className="mt-4 px-4 py-2 text-slate-500 hover:text-slate-600 text-sm transition-colors"
          >
            Cancelar
          </button>
        </div>
      )}

      {/* Conectado */}
      {status === 'connected' && (
        <div className="py-4">
          <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-300 rounded-xl mb-4">
            <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse" />
            <div>
              <p className="text-green-400 font-medium">WhatsApp conectado</p>
              {phoneNumber && <p className="text-slate-500 text-sm">{phoneNumber}</p>}
            </div>
          </div>
          <button
            onClick={handleDisconnect}
            disabled={loading}
            className="px-4 py-2 bg-red-50 hover:bg-red-500/30 text-red-400 font-medium rounded-xl transition-colors text-sm disabled:opacity-50"
          >
            {loading ? 'Desconectando...' : 'Desconectar'}
          </button>
        </div>
      )}

      {/* Erro */}
      {status === 'error' && (
        <div className="text-center py-8">
          <p className="text-red-400 mb-4">Erro na conexao. Tente reconectar.</p>
          <button
            onClick={handleConnect}
            disabled={loading}
            className="px-6 py-3 bg-green-600 hover:bg-green-500 text-slate-800 font-medium rounded-xl transition-colors disabled:opacity-50"
          >
            {loading ? 'Reconectando...' : 'Reconectar'}
          </button>
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: WhatsAppConnectionStatus }) {
  const config = {
    disconnected: { label: 'Desconectado', bg: 'bg-slate-500/20', text: 'text-slate-400' },
    connecting: { label: 'Conectando...', bg: 'bg-yellow-500/20', text: 'text-yellow-400' },
    qr_ready: { label: 'Aguardando QR', bg: 'bg-yellow-500/20', text: 'text-yellow-400' },
    connected: { label: 'Conectado', bg: 'bg-green-500/20', text: 'text-green-400' },
    error: { label: 'Erro', bg: 'bg-red-50', text: 'text-red-400' },
  }

  const c = config[status]
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-medium ${c.bg} ${c.text}`}>
      {c.label}
    </span>
  )
}
