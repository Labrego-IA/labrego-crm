'use client'

import type { UseFormRegister, UseFormSetValue, UseFormWatch } from 'react-hook-form'
import type { ProposalCustomField, ProposalCustomFieldPosition } from '@/types/proposalCustomField'

interface ProposalCustomFieldsProps {
  fields: ProposalCustomField[]
  position: ProposalCustomFieldPosition
  register: UseFormRegister<any>
  setValue: UseFormSetValue<any>
  watch: UseFormWatch<any>
}

export default function ProposalCustomFields({
  fields,
  position,
  register,
  setValue,
  watch,
}: ProposalCustomFieldsProps) {
  const filtered = fields.filter((f) => f.position === position)
  if (filtered.length === 0) return null

  return (
    <div className="bg-white dark:bg-surface-dark rounded-2xl border border-slate-200 dark:border-white/10/60 p-5 shadow-sm space-y-4">
      {filtered.map((field) => {
        const path = `customFields.${field.key}` as const
        return (
          <div key={field.id}>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>

            {field.type === 'text' && (
              <input
                type="text"
                {...register(path, { required: field.required })}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 focus:border-primary-500 focus:ring-2 focus:ring-primary-200 outline-none transition-all text-sm text-slate-700 dark:text-slate-300"
              />
            )}

            {field.type === 'number' && (
              <input
                type="number"
                step="any"
                {...register(path, { required: field.required, valueAsNumber: true })}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 focus:border-primary-500 focus:ring-2 focus:ring-primary-200 outline-none transition-all text-sm text-slate-700 dark:text-slate-300"
              />
            )}

            {field.type === 'textarea' && (
              <textarea
                {...register(path, { required: field.required })}
                rows={3}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 focus:border-primary-500 focus:ring-2 focus:ring-primary-200 outline-none transition-all text-sm text-slate-700 dark:text-slate-300 resize-none"
              />
            )}

            {field.type === 'select' && (
              <select
                {...register(path, { required: field.required })}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 focus:border-primary-500 focus:ring-2 focus:ring-primary-200 outline-none transition-all text-sm text-slate-700 dark:text-slate-300"
              >
                <option value="">Selecione...</option>
                {(field.options ?? []).map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            )}

            {field.type === 'checkbox' && (
              <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={!!watch(path)}
                  onChange={(e) => setValue(path, e.target.checked)}
                  className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                />
                Sim
              </label>
            )}
          </div>
        )
      })}
    </div>
  )
}
