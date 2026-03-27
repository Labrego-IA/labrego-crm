'use client'

import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import { useForm, useFieldArray, useWatch } from 'react-hook-form'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { db } from '@/lib/firebaseClient'
import { useCrmUser } from '@/contexts/CrmUserContext'
import { useProposalDataAccess } from '@/hooks/useProposalDataAccess'
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  getDoc,
  updateDoc,
} from 'firebase/firestore'
import {
  ProposalPdf,
  type ProposalPdfHandle,
} from '@/components/ProposalPdf'
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  Cross2Icon,
  PlusIcon,
} from '@radix-ui/react-icons'
import { SparklesIcon, ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/20/solid'
import {
  ArrowLeftIcon,
  DocumentTextIcon,
  CubeIcon,
  CurrencyDollarIcon,
  CheckIcon,
} from '@heroicons/react/24/outline'
import { formatCurrency, formatDate } from '@/lib/format'
import { useFreePlanGuard } from '@/hooks/useFreePlanGuard'
import { useProposalBranding } from '@/hooks/useProposalBranding'
import { useProposalStructure } from '@/hooks/useProposalStructure'
import { useProposalCustomFields } from '@/hooks/useProposalCustomFields'
import ProposalCustomFields from '@/components/ProposalCustomFields'
import type {
  ProposalProduct as Product,
  ProposalFormData,
  ProposalClient as Client,
} from '@/types/proposal'

type FormData = ProposalFormData & { status: string }

const statusOptions = [
  { value: 'Pendente', label: 'Pendente', color: 'bg-amber-100 text-amber-700' },
  { value: 'Em análise', label: 'Em análise', color: 'bg-blue-100 text-blue-700' },
  { value: 'Aprovada', label: 'Aprovada', color: 'bg-emerald-100 text-emerald-700' },
  { value: 'Recusada', label: 'Recusada', color: 'bg-red-100 text-red-700' },
  { value: 'Expirada', label: 'Expirada', color: 'bg-slate-100 text-slate-700' },
  { value: 'Cancelada', label: 'Cancelada', color: 'bg-rose-100 text-rose-700' },
]

export default function EditProposalCRMPage() {
  const router = useRouter()
  const params = useParams<{ id: string; proposalId: string }>()
  const clientId = params?.id
  const proposalId = params?.proposalId
  const { orgId } = useCrmUser()
  const { isBlocked: isPlanBlocked } = useFreePlanGuard()
  const { filterByAccess, loading: accessLoading } = useProposalDataAccess()
  const { branding } = useProposalBranding()
  const { structure } = useProposalStructure()
  const { fields: customFields } = useProposalCustomFields()
  const pdfRef = useRef<ProposalPdfHandle>(null)

  const { control, register, handleSubmit, setValue, watch } =
    useForm<FormData>({
      defaultValues: {
        clientId: clientId || '',
        projectName: '',
        items: [{ productId: '', name: '', description: '', qty: 1, price: 0 }],
        discountType: 'percent',
        discount: 0,
        discountReason: '',
        context: '',
        proposalDescription: '',
        observations: '',
        paymentMethod: '',
        status: 'Pendente',
      },
    })

  const { fields: itemFields, append: appendItem, remove: removeItem, replace: replaceItems } =
    useFieldArray({ control, name: 'items' })

  const [products, setProducts] = useState<Product[]>([])
  const [client, setClient] = useState<Client | null>(null)
  const [logos, setLogos] = useState<string[]>([])
  const [proposalNumber, setProposalNumber] = useState<number>(1)
  const [proposalCreatedAt, setProposalCreatedAt] = useState<string>('')
  const [showFullPreview, setShowFullPreview] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [generating, setGenerating] = useState(false)
  const [transforming, setTransforming] = useState(false)
  const [loading, setLoading] = useState(true)

  const [expandedSections, setExpandedSections] = useState({
    escopo: true,
    desconto: false,
    preview: true,
  })

  const productInputRefs = useRef<Record<number, HTMLInputElement | null>>({})
  const setProductInputRef = useCallback(
    (index: number) => (el: HTMLInputElement | null): void => {
      productInputRefs.current[index] = el
    },
    []
  )

  const handlePageCountChange = useCallback((pages: number) => {
    setTotalPages(prev => {
      const safePages = Number.isFinite(pages) && pages > 0 ? Math.floor(pages) : 1
      return prev === safePages ? prev : safePages
    })
  }, [])

  // When orgId is not available, stop loading immediately
  useEffect(() => {
    if (!orgId) setLoading(false)
  }, [orgId])

  // Load data
  useEffect(() => {
    if (!proposalId || !clientId || !orgId || accessLoading) return

    const loadData = async () => {
      try {
        const [productsSnap, logosSnap, proposalSnap, clientSnap] = await Promise.all([
          getDocs(query(collection(db, 'products'), where('orgId', '==', orgId))),
          getDocs(query(collection(db, 'logos'), where('orgId', '==', orgId))),
          getDoc(doc(db, 'proposals', proposalId)),
          getDoc(doc(db, 'clients', clientId)),
        ])

        const allProducts = productsSnap.docs
          .map(d => ({ id: d.id, ...(d.data() as any) }))
          .map(p => ({ ...p, price: p.price ?? 0 }))
        const productList = filterByAccess(allProducts).sort((a, b) => a.name.localeCompare(b.name))
        setProducts(productList)

        const filteredLogos = filterByAccess(
          logosSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) }))
        )
        setLogos(filteredLogos.map(d => d.url as string))

        if (clientSnap?.exists()) {
          const data = clientSnap.data()
          setClient({
            id: clientSnap.id,
            name: data.name,
            company: data.company,
            phone: data.phone,
          })
        }

        if (!proposalSnap.exists()) {
          alert('Proposta não encontrada.')
          router.push(`/contatos/${clientId}`)
          return
        }

        const data = proposalSnap.data() as any

        setValue('clientId', data.clientId || clientId)
        setValue('projectName', data.projectName || '')
        setValue('context', data.context || '')
        setValue('proposalDescription', data.proposalDescription || data.modules || '')
        setValue('observations', data.observations || '')
        setValue('status', data.status || 'Pendente')

        // Items (handles legacy data with variant field gracefully)
        const items = Array.isArray(data.items) && data.items.length > 0
          ? data.items.map((it: any) => ({
              productId: it.productId || '',
              name: it.name || '',
              description: it.description || '',
              qty: typeof it.qty === 'number' ? it.qty : Number(it.qty ?? 1) || 1,
              price: typeof it.price === 'number' ? it.price : Number(it.price ?? 0) || 0,
            }))
          : [{ productId: '', name: '', description: '', qty: 1, price: 0 }]
        replaceItems(items)

        // Discount
        const storedDiscountType = data.discountType === 'value' || data.discountType === 'percent' ? data.discountType : 'percent'
        setValue('discountType', storedDiscountType)
        setValue('discount', data.discount || 0)
        setValue('discountReason', data.discountReason || '')

        setValue('paymentMethod', data.paymentMethod || '')

        // Load custom field values
        if (data.customFields && typeof data.customFields === 'object') {
          Object.entries(data.customFields).forEach(([key, value]) => {
            setValue(`customFields.${key}` as any, value)
          })
        }

        setProposalNumber(data.number || 1)
        setProposalCreatedAt(data.createdAt || '')
      } catch (error) {
        console.error('Error loading data:', error)
        alert('Erro ao carregar proposta.')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proposalId, clientId, orgId, setValue, replaceItems, router, accessLoading])

  // Reactive values
  const contextValue = useWatch({ control, name: 'context' })
  const proposalDescriptionValue = useWatch({ control, name: 'proposalDescription' })
  const observationsValue = useWatch({ control, name: 'observations' })
  const watchedItems = useWatch({ control, name: 'items' })
  const paymentMethod = useWatch({ control, name: 'paymentMethod' })
  const currentStatus = useWatch({ control, name: 'status' })

  const numProducts = useMemo(
    () => (watchedItems || []).filter(it => it.productId || it.name).length,
    [watchedItems]
  )

  useEffect(() => {
    setCurrentPage(prev => Math.min(prev, totalPages))
  }, [totalPages])

  // Simplified calculations
  const subtotal = useMemo(() => {
    return (watchedItems || []).reduce((sum, it) => {
      const qty = Number(it?.qty ?? 0) || 0
      const price = Number(it?.price ?? 0) || 0
      if (!Number.isFinite(qty) || !Number.isFinite(price)) return sum
      return sum + qty * price
    }, 0)
  }, [watchedItems])

  const discountInput = useWatch({ control, name: 'discount' }) || 0
  const discountType = useWatch({ control, name: 'discountType' })
  const discountValue = useMemo(() => {
    if (!Number.isFinite(subtotal) || subtotal <= 0) return 0
    const value =
      discountType === 'percent'
        ? (subtotal * (discountInput || 0)) / 100
        : discountInput || 0
    if (!Number.isFinite(value)) return 0
    return Number(Math.max(value, 0).toFixed(2))
  }, [discountType, discountInput, subtotal])

  const total = useMemo(() => {
    const value = subtotal - (discountValue || 0)
    if (!Number.isFinite(value)) return 0
    return Number(Math.max(value, 0).toFixed(2))
  }, [subtotal, discountValue])

  // PDF data
  const itemsForPdf = (watchedItems || []).map(it => ({
    description: it.name,
    qty: Number(it.qty ?? 1) || 1,
    price: Number(it.price ?? 0) || 0,
  }))

  const transformContext = async () => {
    if (isPlanBlocked) return
    const text = watch('context')
    if (!text) return
    setTransforming(true)
    try {
      const res = await fetch('/api/transform-context', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      if (!res.ok) throw new Error('Erro ao transformar texto')
      const data = await res.json()
      if (data.result) setValue('context', data.result)
    } catch (err: any) {
      alert(err.message)
    } finally {
      setTransforming(false)
    }
  }

  const onSubmit = async (data: FormData) => {
    if (isPlanBlocked) return
    if (generating || !proposalId) return
    setGenerating(true)
    try {
      const clientName = client?.name || 'Cliente'
      const sanitizedClient = clientName.replace(/[\\/#?%*:|"<>]/g, '').trim() || 'Cliente'
      const paddedNumber = String(proposalNumber).padStart(4, '0')
      const pdfName = `Proposta Comercial - ${paddedNumber} - ${sanitizedClient}.pdf`

      const customFieldValues = watch('customFields') || {}

      await updateDoc(doc(db, 'proposals', proposalId), {
        clientId: data.clientId,
        projectName: data.projectName,
        items: data.items,
        subtotal,
        discountType,
        discountValue,
        discountReason: data.discountReason,
        context: data.context,
        proposalDescription: data.proposalDescription,
        observations: data.observations,
        paymentMethod: data.paymentMethod,
        status: data.status,
        total,
        pdfName,
        number: proposalNumber,
        customFields: customFieldValues,
        updatedAt: new Date().toISOString(),
        statusUpdatedAt: new Date().toISOString(),
      })

      await pdfRef.current?.generatePdf(pdfName)

      router.push(`/contatos/${clientId}`)
    } catch (error) {
      console.error('Erro ao atualizar proposta', error)
      alert('Erro ao atualizar proposta. Tente novamente.')
    } finally {
      setGenerating(false)
    }
  }

  const applyProductByText = (rowIndex: number, text: string) => {
    const term = text.trim().toLowerCase()
    let p = products.find(x => x.name.toLowerCase() === term)
    if (!p && term) p = products.find(x => x.name.toLowerCase().includes(term))

    if (p) {
      setValue(`items.${rowIndex}.productId`, p.id)
      setValue(`items.${rowIndex}.name`, p.name)
      setValue(`items.${rowIndex}.description`, p.description || '')
      setValue(`items.${rowIndex}.price`, p.price ?? 0)
    } else {
      setValue(`items.${rowIndex}.productId`, '')
      setValue(`items.${rowIndex}.name`, text)
    }
  }

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }))
  }

  const statusColor = statusOptions.find(s => s.value === currentStatus)?.color || 'bg-slate-100 text-slate-700'

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-primary-50/30 flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-primary-50/30">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-slate-200/60">
        <div className="px-6">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link
                href={`/contatos/${clientId}`}
                className="p-2 rounded-xl hover:bg-slate-100 transition-colors"
              >
                <ArrowLeftIcon className="w-5 h-5 text-slate-600" />
              </Link>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center">
                  <DocumentTextIcon className="w-5 h-5 text-primary-600" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-lg font-bold text-slate-800">
                      Proposta #{String(proposalNumber).padStart(4, '0')}
                    </h1>
                    <span className={`px-2 py-0.5 rounded-lg text-xs font-semibold ${statusColor}`}>
                      {currentStatus}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500">
                    {client?.name} {proposalCreatedAt && `• ${formatDate(proposalCreatedAt)}`}
                  </p>
                </div>
              </div>
            </div>

            <div className="hidden md:flex items-center gap-6">
              <div className="text-right">
                <p className="text-xs text-slate-500">Total</p>
                <p className="text-lg font-bold text-primary-600">{formatCurrency(total)}</p>
              </div>
              <button
                onClick={handleSubmit(onSubmit)}
                disabled={generating}
                className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 transition-colors disabled:opacity-50 shadow-lg shadow-primary-200"
              >
                {generating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <CheckIcon className="w-4 h-4" />
                    Salvar Alterações
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Form */}
          <div className="lg:col-span-2 space-y-4">
            {/* Status and Proposal Name */}
            <div className="bg-white rounded-2xl border border-slate-200/60 p-5 shadow-sm space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Status</label>
                <select
                  {...register('status')}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-200 outline-none transition-all text-slate-700"
                >
                  {statusOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Nome da Proposta</label>
                <input
                  {...register('projectName')}
                  placeholder="Ex: Sistema de Gestão de Vendas"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-200 outline-none transition-all text-slate-700"
                />
              </div>
            </div>

            {/* Context */}
            <div className="bg-white rounded-2xl border border-slate-200/60 p-5 shadow-sm">
              <label className="block text-sm font-semibold text-slate-700 mb-2">Contexto</label>
              <textarea
                {...register('context')}
                placeholder="Descreva o contexto e necessidades do projeto..."
                rows={4}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-200 outline-none transition-all text-slate-700 resize-none"
              />
              <button
                type="button"
                onClick={transformContext}
                disabled={transforming}
                className="mt-2 flex items-center gap-2 px-3 py-2 text-sm font-medium text-primary-600 hover:bg-primary-50 rounded-lg transition-colors disabled:opacity-50"
              >
                <SparklesIcon className="w-4 h-4" />
                {transforming ? 'Transformando...' : 'Melhorar texto com IA'}
              </button>
            </div>

            {/* Custom fields: after_context */}
            <ProposalCustomFields fields={customFields} position="after_context" register={register} setValue={setValue} watch={watch} />

            {/* Proposal Description */}
            <div className="bg-white rounded-2xl border border-slate-200/60 p-5 shadow-sm">
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Descrição da Proposta
              </label>
              <textarea
                {...register('proposalDescription')}
                placeholder="Descreva os módulos, funcionalidades e detalhes da solução proposta..."
                rows={6}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-200 outline-none transition-all text-slate-700 resize-none"
              />
            </div>

            {/* Scope/Products */}
            <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
              <button
                type="button"
                onClick={() => toggleSection('escopo')}
                className="w-full flex items-center justify-between p-5 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <CubeIcon className="w-5 h-5 text-primary-600" />
                  <span className="font-semibold text-slate-700">Escopo / Produtos</span>
                  <span className="px-2 py-0.5 rounded-full bg-primary-100 text-primary-600 text-xs font-medium">
                    {numProducts}
                  </span>
                </div>
                {expandedSections.escopo ? (
                  <ChevronUpIcon className="w-5 h-5 text-slate-400" />
                ) : (
                  <ChevronDownIcon className="w-5 h-5 text-slate-400" />
                )}
              </button>

              {expandedSections.escopo && (
                <div className="px-5 pb-5 space-y-4">
                  {/* Products table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200">
                          <th className="text-left py-2 px-2 font-medium text-slate-500">Nome</th>
                          <th className="text-center py-2 px-2 font-medium text-slate-500 w-20">Qtd</th>
                          <th className="text-right py-2 px-2 font-medium text-slate-500 w-32">Valor Unit.</th>
                          <th className="text-right py-2 px-2 font-medium text-slate-500 w-32">Total</th>
                          <th className="w-10" />
                        </tr>
                      </thead>
                      <tbody>
                        {itemFields.map((f, i) => {
                          const current = watchedItems?.[i]
                          const isManual = !current?.productId
                          const qty = Number(current?.qty ?? 1) || 1
                          const price = Number(current?.price ?? 0) || 0
                          return (
                            <tr key={f.id} className="border-b border-slate-100 group">
                              <td className="py-2 px-2">
                                <div className="flex items-center gap-2">
                                  <input
                                    ref={setProductInputRef(i)}
                                    list={`product-options-${i}`}
                                    placeholder="Buscar produto ou digitar..."
                                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-200 outline-none"
                                    autoComplete="off"
                                    value={watch(`items.${i}.name`) || ''}
                                    onChange={e => {
                                      const text = e.target.value
                                      setValue(`items.${i}.name`, text)
                                      applyProductByText(i, text)
                                    }}
                                    onBlur={e => applyProductByText(i, e.target.value)}
                                  />
                                  <datalist id={`product-options-${i}`}>
                                    {products.map(p => (
                                      <option key={p.id} value={p.name} />
                                    ))}
                                  </datalist>
                                  <input type="hidden" {...register(`items.${i}.productId`)} />
                                  {isManual && current?.name && (
                                    <span className="shrink-0 text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                                      manual
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-2 px-2">
                                <input
                                  type="number"
                                  min={1}
                                  {...register(`items.${i}.qty`, { valueAsNumber: true })}
                                  className="w-full px-2 py-2 rounded-lg border border-slate-200 text-sm text-center"
                                />
                              </td>
                              <td className="py-2 px-2">
                                <input
                                  type="number"
                                  step="0.01"
                                  {...register(`items.${i}.price`, { valueAsNumber: true })}
                                  className={`w-full px-2 py-2 rounded-lg border text-sm text-right ${
                                    isManual
                                      ? 'border-slate-200 bg-white'
                                      : 'border-slate-100 bg-slate-50 text-slate-500'
                                  }`}
                                />
                              </td>
                              <td className="py-2 px-2 text-right">
                                <span className="text-sm font-semibold text-slate-700">
                                  {formatCurrency(qty * price)}
                                </span>
                              </td>
                              <td className="py-2 px-2">
                                <button
                                  type="button"
                                  onClick={() => removeItem(i)}
                                  className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                >
                                  <Cross2Icon className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const newIndex = itemFields.length
                      appendItem({ productId: '', name: '', description: '', qty: 1, price: 0 })
                      setTimeout(() => productInputRefs.current[newIndex]?.focus(), 0)
                    }}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-primary-600 hover:bg-primary-50 rounded-xl transition-colors"
                  >
                    <PlusIcon className="w-4 h-4" />
                    Adicionar Produto
                  </button>
                </div>
              )}
            </div>

            {/* Custom fields: after_products */}
            <ProposalCustomFields fields={customFields} position="after_products" register={register} setValue={setValue} watch={watch} />

            {/* Observations */}
            <div className="bg-white rounded-2xl border border-slate-200/60 p-5 shadow-sm">
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Observações Adicionais
              </label>
              <textarea
                {...register('observations')}
                placeholder="Observações, condições especiais, prazos, etc..."
                rows={3}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-200 outline-none transition-all text-slate-700 resize-none"
              />
            </div>

            {/* Custom fields: after_observations */}
            <ProposalCustomFields fields={customFields} position="after_observations" register={register} setValue={setValue} watch={watch} />

            {/* Payment and Discount */}
            <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
              <button
                type="button"
                onClick={() => toggleSection('desconto')}
                className="w-full flex items-center justify-between p-5 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <CurrencyDollarIcon className="w-5 h-5 text-emerald-600" />
                  <span className="font-semibold text-slate-700">Pagamento e Desconto</span>
                </div>
                {expandedSections.desconto ? (
                  <ChevronUpIcon className="w-5 h-5 text-slate-400" />
                ) : (
                  <ChevronDownIcon className="w-5 h-5 text-slate-400" />
                )}
              </button>

              {expandedSections.desconto && (
                <div className="px-5 pb-5 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Forma de Pagamento</label>
                    <textarea
                      {...register('paymentMethod')}
                      placeholder="Descreva as condições de pagamento..."
                      rows={3}
                      className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm resize-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Tipo de Desconto</label>
                      <select
                        {...register('discountType')}
                        className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm"
                      >
                        <option value="percent">Percentual (%)</option>
                        <option value="value">Valor (R$)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Desconto</label>
                      <input
                        type="number"
                        step="0.01"
                        {...register('discount', { valueAsNumber: true })}
                        className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm"
                      />
                    </div>
                  </div>

                  {discountValue > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Motivo do Desconto</label>
                      <input
                        {...register('discountReason')}
                        placeholder="Justificativa para o desconto..."
                        className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Custom fields: after_payment */}
            <ProposalCustomFields fields={customFields} position="after_payment" register={register} setValue={setValue} watch={watch} />
          </div>

          {/* Right Column - Preview */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 space-y-4">
              {/* Summary Card */}
              <div className="bg-white rounded-2xl border border-slate-200/60 p-5 shadow-sm">
                <h3 className="text-sm font-semibold text-slate-700 mb-4">Resumo</h3>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Subtotal</span>
                    <span className="font-medium text-slate-700">{formatCurrency(subtotal)}</span>
                  </div>
                  {discountValue > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Desconto</span>
                      <span className="font-medium text-emerald-600">-{formatCurrency(discountValue)}</span>
                    </div>
                  )}
                  <div className="pt-3 border-t border-slate-100 flex justify-between">
                    <span className="font-semibold text-slate-700">Total</span>
                    <span className="text-xl font-bold text-primary-600">{formatCurrency(total)}</span>
                  </div>
                </div>
              </div>

              {/* Preview */}
              <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between p-4 border-b border-slate-100">
                  <span className="text-sm font-semibold text-slate-700">Preview</span>
                  <button
                    type="button"
                    onClick={() => setShowFullPreview(true)}
                    className="text-sm text-primary-600 hover:underline"
                  >
                    Tela cheia
                  </button>
                </div>
                <div className="p-4 flex justify-center bg-slate-50">
                  <div className="transform scale-[0.4] origin-top">
                    <ProposalPdf
                      ref={pdfRef}
                      nextNumber={proposalNumber}
                      client={{
                        name: client?.name || '',
                        company: client?.company,
                        phone: client?.phone,
                      }}
                      context={contextValue}
                      proposalDescription={proposalDescriptionValue}
                      items={itemsForPdf}
                      monthlyFees={[]}
                      schedule={[]}
                      logos={logos}
                      subtotalBeforeDiscounts={subtotal}
                      subtotalAfterProgressive={subtotal}
                      discountPercent={
                        discountType === 'percent'
                          ? (discountInput || 0)
                          : subtotal > 0 ? Math.round((discountValue / subtotal) * 100) : 0
                      }
                      discountValue={discountValue}
                      progressiveDiscount={0}
                      paymentMethod={paymentMethod}
                      total={total}
                      currentPage={currentPage}
                      onPageCountChange={handlePageCountChange}
                      branding={branding}
                      structure={structure}
                      observations={observationsValue}
                      customFieldDefs={customFields}
                      customFieldValues={watch('customFields') || {}}
                    />
                  </div>
                </div>
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 p-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                      disabled={currentPage === 1}
                      className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-50"
                    >
                      <ChevronLeftIcon className="w-4 h-4" />
                    </button>
                    <span className="text-sm text-slate-500">{currentPage} / {totalPages}</span>
                    <button
                      type="button"
                      onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-50"
                    >
                      <ChevronRightIcon className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Mobile submit button */}
              <button
                type="submit"
                disabled={generating}
                className="w-full lg:hidden flex items-center justify-center gap-2 px-5 py-3 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 transition-colors disabled:opacity-50 shadow-lg shadow-primary-200"
              >
                {generating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <CheckIcon className="w-5 h-5" />
                    Salvar Alterações
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Full Preview Modal */}
      {showFullPreview && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 sm:p-6 md:p-10">
          <div className="bg-white w-full max-w-4xl max-h-full overflow-auto rounded-2xl">
            <div className="sticky top-0 bg-white z-10 flex items-center justify-between p-4 border-b border-slate-200">
              <span className="font-semibold text-slate-700">Preview da Proposta</span>
              <button
                type="button"
                onClick={() => setShowFullPreview(false)}
                className="px-4 py-2 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700"
              >
                Fechar
              </button>
            </div>
            <div className="p-6 flex justify-center">
              <ProposalPdf
                ref={pdfRef}
                nextNumber={proposalNumber}
                client={{
                  name: client?.name || '',
                  company: client?.company,
                  phone: client?.phone,
                }}
                context={contextValue}
                proposalDescription={proposalDescriptionValue}
                items={itemsForPdf}
                monthlyFees={[]}
                schedule={[]}
                logos={logos}
                subtotalBeforeDiscounts={subtotal}
                subtotalAfterProgressive={subtotal}
                discountPercent={
                  discountType === 'percent'
                    ? (discountInput || 0)
                    : subtotal > 0 ? Math.round((discountValue / subtotal) * 100) : 0
                }
                discountValue={discountValue}
                progressiveDiscount={0}
                paymentMethod={paymentMethod}
                total={total}
                visiblePages={totalPages}
                onPageCountChange={handlePageCountChange}
                branding={branding}
                structure={structure}
                observations={observationsValue}
                customFieldDefs={customFields}
                customFieldValues={watch('customFields') || {}}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
