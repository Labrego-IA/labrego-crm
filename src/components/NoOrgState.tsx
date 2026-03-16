'use client'

import { ExclamationTriangleIcon } from '@heroicons/react/24/outline'

export default function NoOrgState() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4 max-w-md text-center px-4">
        <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center">
          <ExclamationTriangleIcon className="w-8 h-8 text-amber-600" />
        </div>
        <h2 className="text-lg font-semibold text-slate-800">
          Organização não encontrada
        </h2>
        <p className="text-sm text-slate-500">
          Seu usuário não está vinculado a nenhuma organização. Entre em contato com o administrador para solicitar acesso.
        </p>
      </div>
    </div>
  )
}
