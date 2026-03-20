'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useCrmUser } from '@/contexts/CrmUserContext'
import { useProposalDataAccess } from '@/hooks/useProposalDataAccess'
import { db } from '@/lib/firebaseClient'
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
} from 'firebase/firestore'
import { toast } from 'sonner'
import type { Product, ProductScheduleEntry } from '@/types/product'
import { EMPTY_PRODUCT } from '@/types/product'
import Modal from '@/components/Modal'
import ConfirmCloseDialog from '@/components/ConfirmCloseDialog'

function normalize(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

type SortColumn = 'name' | 'price' | 'hourValue' | 'margin' | 'tax' | 'schedule'
type SortDirection = 'asc' | 'desc'

export default function PropostasProdutosTab() {
  const { orgId, userUid } = useCrmUser()
  const { filterByAccess, loading: accessLoading } = useProposalDataAccess()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Product | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(EMPTY_PRODUCT)
  const initialFormRef = useRef(JSON.stringify(EMPTY_PRODUCT))
  const [search, setSearch] = useState('')
  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')

  useEffect(() => {
    if (!orgId || accessLoading) return
    loadProducts()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, accessLoading])

  const loadProducts = async () => {
    if (!orgId) return
    setLoading(true)
    try {
      const snap = await getDocs(query(collection(db, 'products'), where('orgId', '==', orgId)))
      const allItems = snap.docs.map(d => ({ id: d.id, ...d.data() } as Product))
      const filtered = filterByAccess(allItems)
      filtered.sort((a, b) => a.name.localeCompare(b.name))
      setProducts(filtered)
    } catch (error) {
      console.error('Error loading products:', error)
      toast.error('Erro ao carregar produtos.')
    } finally {
      setLoading(false)
    }
  }

  const openNew = () => {
    setEditing(null)
    const empty = { ...EMPTY_PRODUCT, schedule: [] as ProductScheduleEntry[] }
    setForm(empty)
    initialFormRef.current = JSON.stringify(empty)
    setShowForm(true)
  }

  const openEdit = (product: Product) => {
    setEditing(product)
    const formData = {
      name: product.name,
      description: product.description,
      price: product.price,
      hourValue: product.hourValue,
      margin: product.margin,
      tax: product.tax,
      schedule: product.schedule || [],
    }
    setForm(formData)
    initialFormRef.current = JSON.stringify(formData)
    setShowForm(true)
  }

  const hasUnsavedChanges = useCallback(() => {
    return JSON.stringify(form) !== initialFormRef.current
  }, [form])

  const [showConfirmClose, setShowConfirmClose] = useState(false)
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null)

  const handleCloseModal = useCallback(() => {
    if (hasUnsavedChanges()) {
      setShowConfirmClose(true)
    } else {
      setShowForm(false)
      setEditing(null)
    }
  }, [hasUnsavedChanges])

  const confirmCloseModal = useCallback(() => {
    setShowConfirmClose(false)
    setShowForm(false)
    setEditing(null)
  }, [])

  const handleSave = async () => {
    if (!orgId) return
    if (!form.name.trim()) {
      toast.error('Nome do produto e obrigatorio.')
      return
    }
    setSaving(true)
    try {
      const now = new Date().toISOString()
      if (editing) {
        await updateDoc(doc(db, 'products', editing.id), {
          ...form,
          updatedAt: now,
        })
        toast.success('Produto atualizado!')
      } else {
        await addDoc(collection(db, 'products'), {
          ...form,
          orgId,
          createdBy: userUid,
          createdAt: now,
          updatedAt: now,
        })
        toast.success('Produto criado!')
      }
      setShowForm(false)
      setEditing(null)
      await loadProducts()
    } catch (error) {
      console.error('Save product error:', error)
      toast.error('Erro ao salvar produto.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingProduct) return
    try {
      await deleteDoc(doc(db, 'products', deletingProduct.id))
      toast.success('Produto excluido!')
      setDeletingProduct(null)
      await loadProducts()
    } catch (error) {
      console.error('Delete product error:', error)
      toast.error('Erro ao excluir produto.')
    }
  }

  const addScheduleEntry = () => {
    setForm(prev => ({
      ...prev,
      schedule: [...prev.schedule, { stage: '', days: 0 }],
    }))
  }

  const updateScheduleEntry = (index: number, field: keyof ProductScheduleEntry, value: string | number) => {
    setForm(prev => ({
      ...prev,
      schedule: prev.schedule.map((entry, i) =>
        i === index ? { ...entry, [field]: value } : entry
      ),
    }))
  }

  const removeScheduleEntry = (index: number) => {
    setForm(prev => ({
      ...prev,
      schedule: prev.schedule.filter((_, i) => i !== index),
    }))
  }

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)

  const handleSort = useCallback((column: SortColumn) => {
    setSortColumn((prev) => {
      if (prev === column) {
        if (sortDirection === 'asc') {
          setSortDirection('desc')
          return prev
        }
        setSortDirection('asc')
        return null
      }
      setSortDirection('asc')
      return column
    })
  }, [sortDirection])

  const filteredProducts = useMemo(() => {
    const term = normalize(search.trim())

    let result = products
    if (term) {
      result = products.filter((p) => {
        const name = normalize(p.name || '')
        const description = normalize(p.description || '')
        return name.includes(term) || description.includes(term)
      })
    }

    if (sortColumn) {
      result = [...result].sort((a, b) => {
        let cmp = 0
        switch (sortColumn) {
          case 'name':
            cmp = normalize(a.name || '').localeCompare(normalize(b.name || ''))
            break
          case 'price':
            cmp = (a.price || 0) - (b.price || 0)
            break
          case 'hourValue':
            cmp = (a.hourValue || 0) - (b.hourValue || 0)
            break
          case 'margin':
            cmp = (a.margin || 0) - (b.margin || 0)
            break
          case 'tax':
            cmp = (a.tax || 0) - (b.tax || 0)
            break
          case 'schedule':
            cmp = (a.schedule?.length || 0) - (b.schedule?.length || 0)
            break
        }
        return sortDirection === 'asc' ? cmp : -cmp
      })
    }

    return result
  }, [products, search, sortColumn, sortDirection])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-3 border-primary-200 border-t-primary-600" />
      </div>
    )
  }

  const renderProductModal = () => (
    <>
    <Modal
      isOpen={showForm}
      onClose={handleCloseModal}
      size="2xl"
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">
            {editing ? 'Editar Produto' : 'Novo Produto'}
          </h3>
          <button
            type="button"
            onClick={handleCloseModal}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Produto</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Ex: Website Institucional"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/40"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Descricao</label>
              <textarea
                value={form.description}
                onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Descreva o produto ou servico..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/40 resize-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Preco (R$)</label>
              <input
                type="number"
                min={0}
                step={0.01}
                value={form.price}
                onChange={e => setForm(prev => ({ ...prev, price: parseFloat(e.target.value) || 0 }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/40"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Valor/Hora (R$)</label>
              <input
                type="number"
                min={0}
                step={0.01}
                value={form.hourValue}
                onChange={e => setForm(prev => ({ ...prev, hourValue: parseFloat(e.target.value) || 0 }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/40"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Margem (%)</label>
              <input
                type="number"
                min={0}
                step={0.1}
                value={form.margin}
                onChange={e => setForm(prev => ({ ...prev, margin: parseFloat(e.target.value) || 0 }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/40"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Imposto (%)</label>
              <input
                type="number"
                min={0}
                step={0.1}
                value={form.tax}
                onChange={e => setForm(prev => ({ ...prev, tax: parseFloat(e.target.value) || 0 }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/40"
              />
            </div>
          </div>

          {/* Schedule */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-gray-700">Cronograma Padrao</label>
              <button
                type="button"
                onClick={addScheduleEntry}
                className="text-sm text-primary-600 hover:text-primary-700 font-medium"
              >
                + Adicionar Etapa
              </button>
            </div>
            {form.schedule.length === 0 && (
              <p className="text-sm text-gray-400 italic">Nenhuma etapa cadastrada.</p>
            )}
            <div className="space-y-2">
              {form.schedule.map((entry, i) => (
                <div key={i} className="flex items-center gap-3">
                  <input
                    type="text"
                    value={entry.stage}
                    onChange={e => updateScheduleEntry(i, 'stage', e.target.value)}
                    placeholder="Nome da etapa"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/40"
                  />
                  <input
                    type="number"
                    min={1}
                    value={entry.days}
                    onChange={e => updateScheduleEntry(i, 'days', parseInt(e.target.value) || 0)}
                    className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/40"
                    placeholder="Dias"
                  />
                  <span className="text-xs text-gray-400 w-8">dias</span>
                  <button
                    type="button"
                    onClick={() => removeScheduleEntry(i)}
                    className="text-red-400 hover:text-red-600 text-sm"
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
          <button
            type="button"
            onClick={handleCloseModal}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors shadow-sm"
          >
            {saving ? 'Salvando...' : editing ? 'Atualizar Produto' : 'Criar Produto'}
          </button>
        </div>
      </div>
    </Modal>
    <ConfirmCloseDialog
      isOpen={showConfirmClose}
      onConfirm={confirmCloseModal}
      onCancel={() => setShowConfirmClose(false)}
    />
    <ConfirmCloseDialog
      isOpen={!!deletingProduct}
      onConfirm={handleDelete}
      onCancel={() => setDeletingProduct(null)}
      title="Excluir produto"
      message={`Tem certeza que deseja excluir "${deletingProduct?.name}"? Esta ação não pode ser desfeita.`}
      confirmText="Sim, excluir"
      cancelText="Cancelar"
    />
    </>
  )

  const renderSortIcon = (column: SortColumn) => (
    <svg
      className={`h-3.5 w-3.5 transition-colors ${
        sortColumn === column ? 'text-primary-600' : 'text-gray-300'
      }`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      {sortColumn === column && sortDirection === 'asc' ? (
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
      ) : sortColumn === column && sortDirection === 'desc' ? (
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
      ) : (
        <>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 14l4 4 4-4" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 10l4-4 4 4" />
        </>
      )}
    </svg>
  )

  return (
    <div className="space-y-4">
      {renderProductModal()}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {filteredProducts.length === products.length
            ? <>{products.length} produto{products.length !== 1 ? 's' : ''} cadastrado{products.length !== 1 ? 's' : ''}</>
            : <>{filteredProducts.length} de {products.length} produto{products.length !== 1 ? 's' : ''}</>
          }
        </p>
        <button
          onClick={openNew}
          className="hidden md:inline-flex px-4 py-2 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 transition-colors shadow-sm"
        >
          + Novo Produto
        </button>
      </div>

      {/* Mobile: FAB flutuante */}
      <button
        onClick={openNew}
        className="md:hidden fixed bottom-6 right-6 z-40 flex items-center justify-center w-14 h-14 rounded-full bg-primary-600 text-white shadow-lg shadow-primary-600/30 hover:bg-primary-700 active:scale-95 transition-all"
        aria-label="Novo produto"
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
      </button>

      {/* Search bar */}
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Pesquisar por nome ou descricao..."
          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 pl-9 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/40"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {products.length === 0 ? (
        <div className="rounded-2xl bg-white border border-gray-200 p-12 text-center">
          <p className="text-gray-400 text-sm">Nenhum produto cadastrado ainda.</p>
          <button
            onClick={openNew}
            className="mt-3 text-sm text-primary-600 hover:text-primary-700 font-medium"
          >
            Criar primeiro produto
          </button>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="rounded-2xl bg-white border border-gray-200 p-12 text-center">
          <p className="text-gray-400 text-sm">Nenhum resultado encontrado.</p>
          <button
            onClick={() => setSearch('')}
            className="mt-3 text-sm text-primary-600 hover:text-primary-700 font-medium"
          >
            Limpar pesquisa
          </button>
        </div>
      ) : (
        <div className="rounded-2xl bg-white border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                {([
                  { key: 'name' as SortColumn, label: 'Nome', align: 'left', responsive: '' },
                  { key: 'price' as SortColumn, label: 'Preco', align: 'right', responsive: '' },
                  { key: 'hourValue' as SortColumn, label: 'Valor/Hora', align: 'right', responsive: 'hidden sm:table-cell' },
                  { key: 'margin' as SortColumn, label: 'Margem', align: 'right', responsive: 'hidden md:table-cell' },
                  { key: 'tax' as SortColumn, label: 'Imposto', align: 'right', responsive: 'hidden md:table-cell' },
                  { key: 'schedule' as SortColumn, label: 'Etapas', align: 'right', responsive: '' },
                ]).map((col) => (
                  <th
                    key={col.key}
                    className={`px-4 py-3 text-${col.align} font-medium text-gray-600 ${col.responsive}`}
                  >
                    <button
                      type="button"
                      onClick={() => handleSort(col.key)}
                      className={`inline-flex items-center gap-1 hover:text-gray-900 transition ${
                        col.align === 'right' ? 'ml-auto' : ''
                      }`}
                    >
                      {col.label}
                      {renderSortIcon(col.key)}
                    </button>
                  </th>
                ))}
                <th className="px-4 py-3 text-right font-medium text-gray-600">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map(p => (
                <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{p.name}</div>
                    {p.description && (
                      <div className="text-xs text-gray-400 mt-0.5 line-clamp-1">{p.description}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">{formatCurrency(p.price)}</td>
                  <td className="px-4 py-3 text-right text-gray-700 hidden sm:table-cell">{formatCurrency(p.hourValue)}</td>
                  <td className="px-4 py-3 text-right text-gray-700 hidden md:table-cell">{p.margin}%</td>
                  <td className="px-4 py-3 text-right text-gray-700 hidden md:table-cell">{p.tax}%</td>
                  <td className="px-4 py-3 text-right text-gray-500">{p.schedule?.length || 0}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEdit(p)}
                        className="text-primary-600 hover:text-primary-700 text-xs font-medium"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => setDeletingProduct(p)}
                        className="text-red-400 hover:text-red-600 text-xs font-medium"
                      >
                        Excluir
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
