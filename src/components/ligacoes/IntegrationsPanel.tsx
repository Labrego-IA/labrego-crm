'use client'

import { useState, useCallback } from 'react'
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline'
import type { OrgIntegrations, IntegrationStatus } from '@/types/callRouting'

interface IntegrationsPanelProps {
  orgId: string
  integrations: OrgIntegrations
  onSave: (integrations: OrgIntegrations) => void
}

const STATUS_CONFIG: Record<IntegrationStatus | 'none', { label: string; color: string; dot: string }> = {
  connected: { label: 'Conectado', color: 'text-emerald-600', dot: 'bg-emerald-500' },
  untested: { label: 'Nao testado', color: 'text-amber-600', dot: 'bg-amber-500' },
  error: { label: 'Erro', color: 'text-red-600', dot: 'bg-red-500' },
  none: { label: 'Nao configurado', color: 'text-neutral-400', dot: 'bg-neutral-300' },
}

const HELP_LINKS: Record<string, string> = {
  vapi: 'https://dashboard.vapi.ai/',
  twilio: 'https://console.twilio.com/',
  elevenLabs: 'https://elevenlabs.io/',
  google: 'https://calendar.google.com/calendar/r/settings',
}

function StatusBadge({ status }: { status?: IntegrationStatus }) {
  const config = STATUS_CONFIG[status || 'none']
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${config.color}`}>
      <span className={`w-2 h-2 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  )
}

interface CardProps {
  title: string
  service: string
  status?: IntegrationStatus
  children: React.ReactNode
  defaultOpen?: boolean
}

function IntegrationCard({ title, service, status, children, defaultOpen = false }: CardProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-slate-800">{title}</span>
          <StatusBadge status={status} />
        </div>
        <div className="flex items-center gap-2">
          <a
            href={HELP_LINKS[service]}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-xs text-primary-600 hover:underline"
          >
            Onde encontrar?
          </a>
          {open ? (
            <ChevronUpIcon className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronDownIcon className="w-4 h-4 text-slate-400" />
          )}
        </div>
      </button>
      {open && (
        <div className="px-5 pb-5 pt-1 border-t border-slate-100 space-y-3">
          {children}
        </div>
      )}
    </div>
  )
}

function FieldInput({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400"
      />
    </div>
  )
}

export default function IntegrationsPanel({ orgId, integrations, onSave }: IntegrationsPanelProps) {
  const [local, setLocal] = useState<OrgIntegrations>(integrations)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState<string | null>(null)

  const updateField = useCallback((service: keyof OrgIntegrations, field: string, value: string) => {
    setLocal(prev => ({
      ...prev,
      [service]: {
        ...(prev[service] || {}),
        [field]: value,
        status: 'untested' as IntegrationStatus,
      },
    }))
  }, [])

  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      const resp = await fetch('/api/call-routing/integrations', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-org-id': orgId,
        },
        body: JSON.stringify(local),
      })
      if (resp.ok) {
        onSave(local)
      }
    } finally {
      setSaving(false)
    }
  }, [local, orgId, onSave])

  const handleTest = useCallback(async (service: string) => {
    setTesting(service)
    try {
      const resp = await fetch('/api/call-routing/integrations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-org-id': orgId,
        },
        body: JSON.stringify({ service }),
      })
      const data = await resp.json()
      setLocal(prev => ({
        ...prev,
        [service]: {
          ...(prev[service as keyof OrgIntegrations] || {}),
          status: data.status as IntegrationStatus,
          lastTestedAt: new Date().toISOString(),
        },
      }))
    } finally {
      setTesting(null)
    }
  }, [orgId])

  const vapi = local.vapi || { apiKey: '', assistantId: '', phoneNumberId: '' }
  const twilio = local.twilio || { accountSid: '', authToken: '', phoneNumber: '' }
  const elevenLabs = local.elevenLabs || { apiKey: '' }
  const google = local.google || { calendarId: '' }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h3 className="text-base font-semibold text-slate-800">Integracoes</h3>
          <p className="text-xs text-slate-500 mt-0.5">Configure suas chaves de API para cada servico.</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-primary text-sm"
        >
          {saving ? 'Salvando...' : 'Salvar Integracoes'}
        </button>
      </div>

      {/* VAPI */}
      <IntegrationCard title="VAPI — Agente de Voz" service="vapi" status={vapi.status} defaultOpen>
        <FieldInput
          label="Chave da API"
          value={vapi.apiKey}
          onChange={(v) => updateField('vapi', 'apiKey', v)}
          placeholder="Insira sua chave VAPI"
          type="password"
        />
        <FieldInput
          label="ID do Assistente de Voz"
          value={vapi.assistantId}
          onChange={(v) => updateField('vapi', 'assistantId', v)}
          placeholder="ID do assistente no VAPI"
        />
        <FieldInput
          label="ID do Numero de Telefone"
          value={vapi.phoneNumberId}
          onChange={(v) => updateField('vapi', 'phoneNumberId', v)}
          placeholder="ID do telefone no VAPI"
        />
        <button
          onClick={() => handleTest('vapi')}
          disabled={testing === 'vapi' || !vapi.apiKey || vapi.apiKey.startsWith('••••')}
          className="btn-secondary text-xs"
        >
          {testing === 'vapi' ? 'Testando...' : 'Testar Conexao'}
        </button>
      </IntegrationCard>

      {/* Twilio */}
      <IntegrationCard title="WhatsApp / Twilio" service="twilio" status={twilio.status}>
        <FieldInput
          label="SID da Conta"
          value={twilio.accountSid}
          onChange={(v) => updateField('twilio', 'accountSid', v)}
          placeholder="SID da conta Twilio"
        />
        <FieldInput
          label="Token de Acesso"
          value={twilio.authToken}
          onChange={(v) => updateField('twilio', 'authToken', v)}
          placeholder="Auth token Twilio"
          type="password"
        />
        <FieldInput
          label="Numero WhatsApp"
          value={twilio.phoneNumber}
          onChange={(v) => updateField('twilio', 'phoneNumber', v)}
          placeholder="+5511999999999"
        />
      </IntegrationCard>

      {/* ElevenLabs */}
      <IntegrationCard title="ElevenLabs (Opcional)" service="elevenLabs" status={elevenLabs.status}>
        <FieldInput
          label="Chave da API"
          value={elevenLabs.apiKey}
          onChange={(v) => updateField('elevenLabs', 'apiKey', v)}
          placeholder="Chave da API ElevenLabs"
          type="password"
        />
        <p className="text-xs text-slate-400">Opcional. Usada para vozes personalizadas do agente.</p>
      </IntegrationCard>

      {/* Google Calendar */}
      <IntegrationCard title="Google Calendar" service="google" status={google.status}>
        <FieldInput
          label="ID do Calendario"
          value={google.calendarId}
          onChange={(v) => updateField('google', 'calendarId', v)}
          placeholder="seu-email@gmail.com ou ID do calendario"
        />
        <p className="text-xs text-slate-400">O ID geralmente e seu e-mail ou esta nas configuracoes do calendario.</p>
      </IntegrationCard>
    </div>
  )
}
