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
  const [needsCredentials, setNeedsCredentials] = useState(false)
  const [instanceId, setInstanceId] = useState('')
  const [instanceToken, setInstanceToken] = useState('')
  const [autoMode, setAutoMode] = useState(true)

  const updateStatus = useCallback((newStatus: WhatsAppConnectionStatus) => {
    setStatus(newStatus)
    onStatusChange?.(newStatus)
  }, [onStatusChange])

  // Polling de status
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
      } catch { /* polling silencioso */ }
    }, 5000)
    return () => clearInterval(interval)
  }, [status, orgId, updateStatus])

  // Status inicial
  useEffect(() => {
    async function loadStatus() {
      try {
        const res = await fetch(`/api/agent/whatsapp/status?orgId=${orgId}`)
        const data = await res.json()
        updateStatus(data.status || 'disconnected')
        setPhoneNumber(data.phoneNumber || '')
        if (data.qrCode) setQrCode(data.qrCode)
        if (data.needsCredentials) setNeedsCredentials(true)
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
      const body: Record<string, string> = { orgId }
      // Modo manual: usuario insere credenciais
      if (!autoMode && instanceId && instanceToken) {
        body.instanceId = instanceId
        body.instanceToken = instanceToken
      }
      // Modo automatico: API cria instancia (precisa de Client-Token de integrador)

      const res = await fetch('/api/agent/whatsapp/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Erro ao conectar')
        return
      }

      if (data.status === 'needs_credentials') {
        setNeedsCredentials(true)
        setAutoMode(false)
        return
      }

      if (data.status === 'connected') {
        updateStatus('connected')
        setNeedsCredentials(false)
        return
      }

      setNeedsCredentials(false)
      if (data.qrCode) {
        setQrCode(data.qrCode)
        updateStatus('qr_ready')
      } else {
        updateStatus('connecting')
      }
    } catch {
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
        <h3 className="text-lg font-semibold text-slate-800">Conexao WhatsApp</h3>
        <StatusBadge status={status} />
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
          {error}
        </div>
      )}

      {/* Estado: desconectado */}
      {(status === 'disconnected' || needsCredentials) && status !== 'connected' && (
        <div className="space-y-4">
          {/* Botao rapido (modo automatico) */}
          {!needsCredentials && (
            <div className="text-center py-6">
              <p className="text-slate-500 mb-4">Conecte seu WhatsApp para ativar o agente de atendimento.</p>
              <button
                onClick={handleConnect}
                disabled={loading}
                className="px-8 py-3 bg-green-600 hover:bg-green-500 text-white font-medium rounded-xl transition-colors disabled:opacity-50"
              >
                {loading ? 'Conectando...' : 'Conectar WhatsApp'}
              </button>
            </div>
          )}

          {/* Formulario manual (quando auto falha ou nao tem integrador) */}
          {needsCredentials && (
            <>
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <p className="text-blue-800 text-sm font-medium mb-1">Como conectar</p>
                <ol className="text-blue-700 text-xs space-y-1 list-decimal pl-4">
                  <li>Acesse <a href="https://developer.z-api.io/" target="_blank" rel="noopener" className="underline font-medium">developer.z-api.io</a> e crie uma conta</li>
                  <li>Crie uma nova instancia no painel</li>
                  <li>Copie o <strong>Instance ID</strong> e o <strong>Token</strong></li>
                  <li>Cole nos campos abaixo</li>
                </ol>
              </div>
              <div>
                <label className="block text-slate-600 text-sm font-medium mb-1">Instance ID</label>
                <input type="text" value={instanceId} onChange={e => setInstanceId(e.target.value)}
                  placeholder="Cole o ID da instancia"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 text-sm placeholder:text-slate-400 focus:outline-none focus:border-cyan-500" />
              </div>
              <div>
                <label className="block text-slate-600 text-sm font-medium mb-1">Token</label>
                <input type="password" value={instanceToken} onChange={e => setInstanceToken(e.target.value)}
                  placeholder="Cole o token da instancia"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 text-sm placeholder:text-slate-400 focus:outline-none focus:border-cyan-500" />
              </div>
              <button
                onClick={handleConnect}
                disabled={loading || !instanceId || !instanceToken}
                className="w-full px-6 py-3 bg-green-600 hover:bg-green-500 text-white font-medium rounded-xl transition-colors disabled:opacity-50"
              >
                {loading ? 'Conectando...' : 'Conectar'}
              </button>
            </>
          )}
        </div>
      )}

      {/* QR Code */}
      {(status === 'qr_ready' || status === 'connecting') && !needsCredentials && (
        <div className="text-center py-4">
          <p className="text-slate-600 mb-4">Escaneie o QR Code com seu WhatsApp:</p>
          {qrCode ? (
            <div className="inline-block p-4 bg-white border border-slate-200 rounded-2xl mb-4 shadow-sm">
              <img
                src={qrCode.startsWith('data:') ? qrCode : `data:image/png;base64,${qrCode}`}
                alt="QR Code WhatsApp" className="w-64 h-64" />
            </div>
          ) : (
            <div className="inline-flex items-center justify-center w-64 h-64 bg-slate-50 rounded-2xl mb-4">
              <div className="animate-spin w-8 h-8 border-2 border-cyan-600 border-t-transparent rounded-full" />
            </div>
          )}
          <p className="text-slate-400 text-sm">Aguardando escaneamento...</p>
          <button onClick={handleDisconnect} className="mt-4 px-4 py-2 text-slate-500 hover:text-slate-700 text-sm">Cancelar</button>
        </div>
      )}

      {/* Conectado */}
      {status === 'connected' && (
        <div className="py-4">
          <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl mb-4">
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
            <div>
              <p className="text-green-700 font-medium">WhatsApp conectado</p>
              {phoneNumber && <p className="text-green-600 text-sm">{phoneNumber}</p>}
            </div>
          </div>
          <button onClick={handleDisconnect} disabled={loading}
            className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 font-medium rounded-xl transition-colors text-sm disabled:opacity-50">
            {loading ? 'Desconectando...' : 'Desconectar'}
          </button>
        </div>
      )}

      {/* Erro */}
      {status === 'error' && !needsCredentials && (
        <div className="text-center py-8">
          <p className="text-red-600 mb-4">Erro na conexao. Verifique as credenciais.</p>
          <button onClick={() => { setNeedsCredentials(true); updateStatus('disconnected') }}
            className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl transition-colors">
            Reconfigurar
          </button>
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: WhatsAppConnectionStatus }) {
  const config = {
    disconnected: { label: 'Desconectado', bg: 'bg-slate-100', text: 'text-slate-500' },
    connecting: { label: 'Conectando...', bg: 'bg-amber-50', text: 'text-amber-600' },
    qr_ready: { label: 'Aguardando QR', bg: 'bg-amber-50', text: 'text-amber-600' },
    connected: { label: 'Conectado', bg: 'bg-green-50', text: 'text-green-600' },
    error: { label: 'Erro', bg: 'bg-red-50', text: 'text-red-600' },
  }
  const c = config[status]
  return <span className={`px-3 py-1 rounded-full text-xs font-medium ${c.bg} ${c.text}`}>{c.label}</span>
}
