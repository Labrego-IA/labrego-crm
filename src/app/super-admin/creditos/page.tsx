'use client'

import { useState, useEffect, useCallback } from 'react'
import { CreditCard, TrendingUp, TrendingDown, Wallet } from 'lucide-react'
import type { Organization } from '@/types/organization'
import type { CreditBalance, CreditTransaction } from '@/types/credits'
import { useCrmUser } from '@/contexts/CrmUserContext'

const TYPE_LABELS: Record<CreditTransaction['type'], string> = {
  purchase: 'Compra',
  consumption: 'Consumo',
  adjustment: 'Ajuste',
  bonus: 'Bonus',
}

const TYPE_BADGE: Record<CreditTransaction['type'], string> = {
  purchase: 'bg-green-100 text-green-800',
  consumption: 'bg-red-100 text-red-800',
  adjustment: 'bg-yellow-100 text-yellow-800',
  bonus: 'bg-blue-100 text-blue-800',
}

export default function SuperAdminCreditosPage() {
  const { userEmail } = useCrmUser()
  const [orgs, setOrgs] = useState<Organization[]>([])
  const [selectedOrgId, setSelectedOrgId] = useState('')
  const [balance, setBalance] = useState<CreditBalance | null>(null)
  const [transactions, setTransactions] = useState<CreditTransaction[]>([])
  const [loadingOrgs, setLoadingOrgs] = useState(true)
  const [loadingBalance, setLoadingBalance] = useState(false)

  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [creditType, setCreditType] = useState<'minutes' | 'actions'>('minutes')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!userEmail) return
    fetch('/api/super-admin/credits', {
      headers: { 'x-user-email': userEmail },
    })
      .then((res) => res.json())
      .then((data) => setOrgs((data.orgs || []) as Organization[]))
      .catch((err) => console.error('[super-admin/creditos] fetch orgs error:', err))
      .finally(() => setLoadingOrgs(false))
  }, [userEmail])

  const fetchOrgData = useCallback(async (orgId: string) => {
    if (!userEmail || !orgId) return
    setLoadingBalance(true)
    try {
      const res = await fetch(`/api/super-admin/credits?orgId=${orgId}`, {
        headers: { 'x-user-email': userEmail },
      })
      const data = await res.json()
      setBalance((data.balance as CreditBalance) || null)
      setTransactions((data.transactions || []) as CreditTransaction[])
    } catch (err) {
      console.error('[super-admin/creditos] fetch org data error:', err)
    } finally {
      setLoadingBalance(false)
    }
  }, [userEmail])

  useEffect(() => {
    if (!selectedOrgId) { setBalance(null); setTransactions([]); return }
    fetchOrgData(selectedOrgId)
  }, [selectedOrgId, fetchOrgData])

  const handleAddCredits = async (e: React.FormEvent) => {
    e.preventDefault()
    const num = Number(amount)
    if (!num || !selectedOrgId) return
    setSubmitting(true)
    setError('')

    try {
      const res = await fetch('/api/super-admin/credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-email': userEmail || '' },
        body: JSON.stringify({
          orgId: selectedOrgId,
          amount: num,
          creditType,
          description: description || (num > 0 ? `Creditos de ${creditType === 'actions' ? 'acoes' : 'minutos'} adicionados` : `Creditos de ${creditType === 'actions' ? 'acoes' : 'minutos'} removidos`),
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Erro')
      setAmount('')
      setDescription('')
      fetchOrgData(selectedOrgId)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Creditos</h2>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Gerencie os creditos de qualquer organizacao.</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Selecionar empresa</label>
        <select value={selectedOrgId} onChange={(e) => setSelectedOrgId(e.target.value)} disabled={loadingOrgs} className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/40">
          <option value="">Selecione uma empresa...</option>
          {orgs.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}
        </select>
      </div>

      {selectedOrgId && (
        <>
          {loadingBalance ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-surface-dark rounded-xl border border-gray-200 dark:border-white/10 p-4 flex items-center gap-4">
                  <div className="p-3 bg-primary-50 rounded-lg"><Wallet className="w-5 h-5 text-primary-600" /></div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-slate-400">Saldo Minutos</p>
                    <p className="text-xl font-bold text-gray-900 dark:text-white">{balance?.balance?.toLocaleString('pt-BR') ?? 0} min</p>
                  </div>
                </div>
                <div className="bg-white dark:bg-surface-dark rounded-xl border border-gray-200 dark:border-white/10 p-4 flex items-center gap-4">
                  <div className="p-3 bg-green-50 rounded-lg"><TrendingUp className="w-5 h-5 text-green-600" /></div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-slate-400">Comprado (min)</p>
                    <p className="text-xl font-bold text-gray-900 dark:text-white">{balance?.totalPurchased?.toLocaleString('pt-BR') ?? 0}</p>
                  </div>
                </div>
                <div className="bg-white dark:bg-surface-dark rounded-xl border border-gray-200 dark:border-white/10 p-4 flex items-center gap-4">
                  <div className="p-3 bg-orange-50 rounded-lg"><TrendingDown className="w-5 h-5 text-orange-600" /></div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-slate-400">Consumido (min)</p>
                    <p className="text-xl font-bold text-gray-900 dark:text-white">{balance?.totalConsumed?.toLocaleString('pt-BR') ?? 0}</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-surface-dark rounded-xl border border-violet-200 p-4 flex items-center gap-4">
                  <div className="p-3 bg-violet-50 rounded-lg"><CreditCard className="w-5 h-5 text-violet-600" /></div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-slate-400">Saldo Acoes</p>
                    <p className="text-xl font-bold text-violet-700">{balance?.actionBalance?.toLocaleString('pt-BR') ?? 0}</p>
                  </div>
                </div>
                <div className="bg-white dark:bg-surface-dark rounded-xl border border-gray-200 dark:border-white/10 p-4 flex items-center gap-4">
                  <div className="p-3 bg-green-50 rounded-lg"><TrendingUp className="w-5 h-5 text-green-600" /></div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-slate-400">Comprado (acoes)</p>
                    <p className="text-xl font-bold text-gray-900 dark:text-white">{balance?.actionTotalPurchased?.toLocaleString('pt-BR') ?? 0}</p>
                  </div>
                </div>
                <div className="bg-white dark:bg-surface-dark rounded-xl border border-gray-200 dark:border-white/10 p-4 flex items-center gap-4">
                  <div className="p-3 bg-orange-50 rounded-lg"><TrendingDown className="w-5 h-5 text-orange-600" /></div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-slate-400">Consumido (acoes)</p>
                    <p className="text-xl font-bold text-gray-900 dark:text-white">{balance?.actionTotalConsumed?.toLocaleString('pt-BR') ?? 0}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-surface-dark rounded-xl border border-gray-200 dark:border-white/10 p-6">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Adicionar / Remover Creditos</h3>
                <form onSubmit={handleAddCredits} className="flex flex-wrap gap-3 items-end">
                  <div className="min-w-[140px]">
                    <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1">Tipo</label>
                    <select value={creditType} onChange={(e) => setCreditType(e.target.value as 'minutes' | 'actions')} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/40">
                      <option value="minutes">Minutos</option>
                      <option value="actions">Acoes</option>
                    </select>
                  </div>
                  <div className="flex-1 min-w-[120px]">
                    <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1">Quantidade (negativo p/ remover)</label>
                    <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} required className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/40" placeholder="Ex: 100 ou -50" />
                  </div>
                  <div className="flex-[2] min-w-[200px]">
                    <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1">Descricao</label>
                    <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/40" placeholder="Motivo do ajuste" />
                  </div>
                  <button type="submit" disabled={submitting || !amount} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition">
                    {submitting ? 'Salvando...' : 'Aplicar'}
                  </button>
                </form>
                {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg mt-3">{error}</p>}
              </div>

              <div className="bg-white dark:bg-surface-dark rounded-xl border border-gray-200 dark:border-white/10 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Historico de Transacoes</h3>
                </div>
                {transactions.length === 0 ? (
                  <div className="text-center py-8 text-gray-400 dark:text-slate-500 text-sm">
                    <CreditCard className="w-8 h-8 mx-auto mb-2 text-gray-300 dark:text-slate-600" />
                    Nenhuma transacao registrada.
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-surface-dark/80">
                      <tr className="border-b border-gray-100 bg-gray-50 dark:bg-white/5">
                        <th className="text-left px-4 py-2 font-medium text-gray-600 dark:text-slate-400">Data</th>
                        <th className="text-left px-4 py-2 font-medium text-gray-600 dark:text-slate-400">Tipo</th>
                        <th className="text-left px-4 py-2 font-medium text-gray-600 dark:text-slate-400">Descricao</th>
                        <th className="text-right px-4 py-2 font-medium text-gray-600 dark:text-slate-400">Qtd</th>
                        <th className="text-left px-4 py-2 font-medium text-gray-600 dark:text-slate-400">Por</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map((tx) => (
                        <tr key={tx.id} className="border-b border-gray-50">
                          <td className="px-4 py-2 text-gray-500 dark:text-slate-400">{new Date(tx.createdAt).toLocaleDateString('pt-BR')}</td>
                          <td className="px-4 py-2">
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_BADGE[tx.type]}`}>{TYPE_LABELS[tx.type]}</span>
                          </td>
                          <td className="px-4 py-2 text-gray-600 dark:text-slate-400">{tx.description}</td>
                          <td className={`px-4 py-2 text-right font-medium ${tx.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {tx.amount >= 0 ? `+${tx.amount}` : tx.amount}
                          </td>
                          <td className="px-4 py-2 text-gray-500 dark:text-slate-400">{tx.adminEmail || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
