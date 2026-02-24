'use client'

import { useState, useEffect, useRef } from 'react'
import { collection, query, where, onSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebaseClient'
import { useCrmUser } from '@/contexts/CrmUserContext'
import { PersonIcon, Cross2Icon } from '@radix-ui/react-icons'

type MemberOption = {
  id: string
  displayName: string
  email: string
  photoUrl?: string
  role: string
}

type MemberSelectorProps = {
  value?: string | null
  valueName?: string | null
  onChange: (memberId: string | null, memberName: string | null) => void
  excludeIds?: string[]
  placeholder?: string
  size?: 'sm' | 'md'
  allowClear?: boolean
}

export default function MemberSelector({
  value,
  valueName,
  onChange,
  excludeIds = [],
  placeholder = 'Selecionar responsável',
  size = 'sm',
  allowClear = true,
}: MemberSelectorProps) {
  const { orgId } = useCrmUser()
  const [members, setMembers] = useState<MemberOption[]>([])
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!orgId) return
    const unsub = onSnapshot(
      query(collection(db, 'organizations', orgId, 'members'), where('status', '==', 'active')),
      (snap) => {
        setMembers(
          snap.docs.map((d) => {
            const data = d.data()
            return {
              id: d.id,
              displayName: data.displayName || data.email,
              email: data.email,
              photoUrl: data.photoUrl,
              role: data.role,
            }
          })
        )
      }
    )
    return () => unsub()
  }, [orgId])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const filtered = members
    .filter((m) => !excludeIds.includes(m.id))
    .filter((m) => {
      if (!search) return true
      const q = search.toLowerCase()
      return m.displayName.toLowerCase().includes(q) || m.email.toLowerCase().includes(q)
    })

  const selectedMember = members.find((m) => m.id === value)
  const displayName = selectedMember?.displayName || valueName || null

  const sizeClasses = size === 'sm' ? 'text-xs px-2 py-1' : 'text-sm px-3 py-2'

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(!open) }}
        className={`flex items-center gap-1.5 rounded-lg border border-slate-200 hover:border-slate-300 bg-white transition-colors ${sizeClasses} max-w-[180px]`}
      >
        {displayName ? (
          <>
            <div className="w-4 h-4 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
              <span className="text-[9px] font-bold text-primary-600">
                {displayName.charAt(0).toUpperCase()}
              </span>
            </div>
            <span className="truncate text-slate-700">{displayName}</span>
            {allowClear && (
              <Cross2Icon
                className="w-3 h-3 text-slate-400 hover:text-slate-600 flex-shrink-0"
                onClick={(e) => { e.stopPropagation(); onChange(null, null); setOpen(false) }}
              />
            )}
          </>
        ) : (
          <>
            <PersonIcon className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-400 truncate">{placeholder}</span>
          </>
        )}
      </button>

      {open && (
        <div
          className="absolute z-50 mt-1 w-56 bg-white rounded-lg shadow-lg border border-slate-200 py-1"
          onClick={(e) => e.stopPropagation()}
        >
          {members.length > 5 && (
            <div className="px-2 pb-1">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar membro..."
                className="w-full text-xs px-2 py-1.5 border border-slate-200 rounded focus:ring-1 focus:ring-primary-500 outline-none"
                autoFocus
              />
            </div>
          )}
          <div className="max-h-48 overflow-y-auto">
            {allowClear && value && (
              <button
                onClick={() => { onChange(null, null); setOpen(false); setSearch('') }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-500 hover:bg-slate-50"
              >
                <Cross2Icon className="w-3 h-3" />
                Sem responsável
              </button>
            )}
            {filtered.map((m) => (
              <button
                key={m.id}
                onClick={() => { onChange(m.id, m.displayName); setOpen(false); setSearch('') }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-primary-50 ${
                  m.id === value ? 'bg-primary-50 text-primary-700' : 'text-slate-700'
                }`}
              >
                <div className="w-5 h-5 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-[10px] font-bold text-primary-600">
                    {m.displayName.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="min-w-0 text-left">
                  <div className="truncate font-medium">{m.displayName}</div>
                  <div className="truncate text-slate-400 text-[10px]">{m.role}</div>
                </div>
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="px-3 py-2 text-xs text-slate-400">Nenhum membro encontrado</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
