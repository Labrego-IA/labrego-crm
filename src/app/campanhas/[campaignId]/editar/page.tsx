'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useCrmUser } from '@/contexts/CrmUserContext'
import { db } from '@/lib/firebaseClient'
import { doc, onSnapshot } from 'firebase/firestore'
import PlanGate from '@/components/PlanGate'
import { useFreePlanGuard } from '@/hooks/useFreePlanGuard'
import FreePlanDialog from '@/components/FreePlanDialog'
import dynamic from 'next/dynamic'
import { toast } from 'sonner'
import {
  type Campaign,
  type CampaignType,
  type RecurrenceFrequency,
  CAMPAIGN_STATUS_LABELS,
  CAMPAIGN_STATUS_COLORS,
  CAMPAIGN_TYPE_LABELS,
  RECURRENCE_LABELS,
  TEMPLATE_VARIABLES,
} from '@/types/campaign'
import {
  ArrowLeftIcon,
  CheckIcon,
} from '@heroicons/react/24/outline'

const RichTextEditor = dynamic(() => import('@/components/RichTextEditor'), { ssr: false })

/* ================================= Component ================================= */

function EditCampaignContent() {
  const router = useRouter()
  const params = useParams()
  const campaignId = params.campaignId as string
  const { orgId } = useCrmUser()
  const { guard, showDialog: showFreePlanDialog, closeDialog: closeFreePlanDialog } = useFreePlanGuard()

  /* ----------------------------- State ---------------------------------- */

  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Editable fields
  const [name, setName] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [sendType, setSendType] = useState<CampaignType>('immediate')
  const [scheduledDate, setScheduledDate] = useState('')
  const [scheduledTime, setScheduledTime] = useState('')
  const [recurrenceFreq, setRecurrenceFreq] = useState<RecurrenceFrequency>('weekly')
  const [recurrenceDayOfWeek, setRecurrenceDayOfWeek] = useState(1)
  const [recurrenceDayOfMonth, setRecurrenceDayOfMonth] = useState(1)
  const [recurrenceTime, setRecurrenceTime] = useState('09:00')
  const [recurrenceStartDate, setRecurrenceStartDate] = useState('')
  const [recurrenceEndDate, setRecurrenceEndDate] = useState('')

  /* ---------------------- Load campaign data ---------------------------- */

  useEffect(() => {
    if (!orgId || !campaignId) {
      setLoading(false)
      return
    }

    const ref = doc(db, 'organizations', orgId, 'campaigns', campaignId)
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          const data = { id: snap.id, ...snap.data() } as Campaign
          setCampaign(data)

          // Populate form fields from campaign
          setName(data.name)
          setSubject(data.subject)
          setBody(data.body)
          setSendType(data.type)

          if (data.scheduledAt) {
            const dt = new Date(data.scheduledAt)
            setScheduledDate(dt.toISOString().split('T')[0])
            setScheduledTime(dt.toTimeString().slice(0, 5))
          }

          if (data.recurrence) {
            setRecurrenceFreq(data.recurrence.frequency)
            if (data.recurrence.dayOfWeek !== undefined) setRecurrenceDayOfWeek(data.recurrence.dayOfWeek)
            if (data.recurrence.dayOfMonth !== undefined) setRecurrenceDayOfMonth(data.recurrence.dayOfMonth)
            setRecurrenceTime(data.recurrence.timeOfDay || '09:00')
            setRecurrenceStartDate(data.recurrence.startDate || '')
            setRecurrenceEndDate(data.recurrence.endDate || '')
          }
        }
        setLoading(false)
      },
      (error) => {
        console.error('Error loading campaign:', error)
        toast.error('Erro ao carregar campanha')
        setLoading(false)
      },
    )
    return () => unsub()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, campaignId])

  /* ----------------------------- Save handler --------------------------- */

  const handleSave = async () => {
    if (!orgId || !campaignId || !campaign) return

    if (!name.trim()) {
      toast.error('Nome da campanha é obrigatório')
      return
    }
    if (!subject.trim()) {
      toast.error('Assunto do email é obrigatório')
      return
    }
    if (!body.trim()) {
      toast.error('Corpo do email é obrigatório')
      return
    }

    setSaving(true)
    try {
      const updateData: Record<string, unknown> = {
        orgId,
        name: name.trim(),
        subject: subject.trim(),
        body,
        bodyPlainText: body.replace(/<[^>]*>/g, ''),
        type: sendType,
      }

      // Handle scheduling
      if (sendType === 'scheduled') {
        if (!scheduledDate || !scheduledTime) {
          toast.error('Informe data e hora do agendamento')
          setSaving(false)
          return
        }
        updateData.scheduledAt = new Date(`${scheduledDate}T${scheduledTime}`).toISOString()
        updateData.status = 'scheduled'
      } else if (sendType === 'recurring') {
        if (!recurrenceStartDate) {
          toast.error('Informe a data de início da recorrência')
          setSaving(false)
          return
        }
        const nextRunAt = new Date(`${recurrenceStartDate}T${recurrenceTime}`).toISOString()
        updateData.recurrence = {
          frequency: recurrenceFreq,
          ...(recurrenceFreq === 'weekly' || recurrenceFreq === 'biweekly'
            ? { dayOfWeek: recurrenceDayOfWeek }
            : {}),
          ...(recurrenceFreq === 'monthly' ? { dayOfMonth: recurrenceDayOfMonth } : {}),
          timeOfDay: recurrenceTime,
          startDate: recurrenceStartDate,
          endDate: recurrenceEndDate || undefined,
          nextRunAt,
        }
        updateData.status = 'scheduled'
      } else {
        updateData.status = 'draft'
      }

      const res = await fetch(`/api/campaigns/${campaignId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Erro ao salvar')
      }

      toast.success('Campanha atualizada com sucesso')
      router.push(`/campanhas/${campaignId}`)
    } catch (error) {
      console.error('Error saving campaign:', error)
      toast.error(error instanceof Error ? error.message : 'Erro ao salvar campanha')
    }
    setSaving(false)
  }

  /* ================================= Render ================================= */

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
      </div>
    )
  }

  if (!campaign) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-500">Campanha não encontrada</p>
        <button onClick={() => router.push('/campanhas')} className="mt-4 text-primary-600 font-medium text-sm">
          Voltar para campanhas
        </button>
      </div>
    )
  }

  if (!['draft', 'scheduled'].includes(campaign.status)) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-500">Só é possível editar campanhas com status rascunho ou agendada</p>
        <button onClick={() => router.push(`/campanhas/${campaignId}`)} className="mt-4 text-primary-600 font-medium text-sm">
          Voltar para detalhes
        </button>
      </div>
    )
  }

  const DAYS_OF_WEEK = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push(`/campanhas/${campaignId}`)}
            className="rounded-lg p-2 hover:bg-slate-100 transition-colors"
          >
            <ArrowLeftIcon className="h-5 w-5 text-slate-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Editar Campanha</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${CAMPAIGN_STATUS_COLORS[campaign.status]}`}>
                {CAMPAIGN_STATUS_LABELS[campaign.status]}
              </span>
              <span className="text-sm text-slate-500">{campaign.totalRecipients} destinatários</span>
            </div>
          </div>
        </div>
        <button
          onClick={() => guard(handleSave)}
          disabled={saving}
          className="flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-primary-700 disabled:opacity-50 transition-colors"
        >
          <CheckIcon className="h-4 w-4" />
          {saving ? 'Salvando...' : 'Salvar'}
        </button>
      </div>

      {/* Campaign Name */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <h3 className="text-sm font-semibold text-slate-700">Informações gerais</h3>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Nome da campanha</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
            placeholder="Ex: Newsletter de Março"
          />
        </div>
      </div>

      {/* Email Content */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <h3 className="text-sm font-semibold text-slate-700">Conteúdo do email</h3>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Assunto</label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
            placeholder="Ex: Novidades para você!"
          />
        </div>

        {/* Template variables */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-slate-500">Variáveis:</span>
          {TEMPLATE_VARIABLES.map((v) => (
            <button
              key={v.key}
              type="button"
              onClick={() => setSubject((prev) => prev + ' ' + v.key)}
              className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-200 transition-colors"
            >
              {v.key}
            </button>
          ))}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Corpo do email</label>
          <RichTextEditor value={body} onChange={setBody} />
        </div>
      </div>

      {/* Send Type */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <h3 className="text-sm font-semibold text-slate-700">Tipo de envio</h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {(['immediate', 'scheduled', 'recurring'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setSendType(type)}
              className={`rounded-xl border p-4 text-left transition-all ${
                sendType === type
                  ? 'border-primary-500 bg-primary-50 ring-1 ring-primary-500'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <p className="text-sm font-medium text-slate-900">{CAMPAIGN_TYPE_LABELS[type]}</p>
              <p className="text-xs text-slate-500 mt-1">
                {type === 'immediate' ? 'Salva como rascunho para envio manual' : type === 'scheduled' ? 'Envio automático em data/hora' : 'Envio recorrente automático'}
              </p>
            </button>
          ))}
        </div>

        {/* Scheduled fields */}
        {sendType === 'scheduled' && (
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Data</label>
              <input
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Hora</label>
              <input
                type="time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
              />
            </div>
          </div>
        )}

        {/* Recurring fields */}
        {sendType === 'recurring' && (
          <div className="space-y-3 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Frequência</label>
                <select
                  value={recurrenceFreq}
                  onChange={(e) => setRecurrenceFreq(e.target.value as RecurrenceFrequency)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
                >
                  {(Object.entries(RECURRENCE_LABELS) as [RecurrenceFrequency, string][]).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Horário</label>
                <input
                  type="time"
                  value={recurrenceTime}
                  onChange={(e) => setRecurrenceTime(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
                />
              </div>
            </div>

            {(recurrenceFreq === 'weekly' || recurrenceFreq === 'biweekly') && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Dia da semana</label>
                <select
                  value={recurrenceDayOfWeek}
                  onChange={(e) => setRecurrenceDayOfWeek(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
                >
                  {DAYS_OF_WEEK.map((day, idx) => (
                    <option key={idx} value={idx}>{day}</option>
                  ))}
                </select>
              </div>
            )}

            {recurrenceFreq === 'monthly' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Dia do mês</label>
                <select
                  value={recurrenceDayOfMonth}
                  onChange={(e) => setRecurrenceDayOfMonth(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
                >
                  {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                    <option key={day} value={day}>{day}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Data de início</label>
                <input
                  type="date"
                  value={recurrenceStartDate}
                  onChange={(e) => setRecurrenceStartDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Data de fim (opcional)</label>
                <input
                  type="date"
                  value={recurrenceEndDate}
                  onChange={(e) => setRecurrenceEndDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Save button (bottom) */}
      <div className="flex justify-end">
        <button
          onClick={() => guard(handleSave)}
          disabled={saving}
          className="flex items-center gap-2 rounded-xl bg-primary-600 px-6 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-primary-700 disabled:opacity-50 transition-colors"
        >
          <CheckIcon className="h-4 w-4" />
          {saving ? 'Salvando...' : 'Salvar alterações'}
        </button>
      </div>
      <FreePlanDialog isOpen={showFreePlanDialog} onClose={closeFreePlanDialog} />
    </div>
  )
}

/* ================================= Page Export ================================= */

export default function EditCampaignPage() {
  return (
    <PlanGate feature="email_automation">
      <EditCampaignContent />
    </PlanGate>
  )
}
