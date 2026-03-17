'use client'

import { useState, useRef } from 'react'
import { useCrmUser } from '@/contexts/CrmUserContext'
import { auth, db, storage } from '@/lib/firebaseClient'
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  deleteUser,
} from 'firebase/auth'
import { doc, updateDoc, deleteDoc } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Tabs from '@/components/Tabs'
import Modal from '@/components/Modal'
import { usePlan } from '@/hooks/usePlan'
import { PLAN_LIMITS, PLAN_OVERAGE, PLAN_DISPLAY, FEATURE_LABELS, type PlanId } from '@/types/plan'

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  manager: 'Gerente',
  seller: 'Vendedor',
  viewer: 'Visualizador',
}

const STATUS_LABELS: Record<string, string> = {
  active: 'Ativo',
  invited: 'Convidado',
  suspended: 'Suspenso',
}

const DELETE_CONFIRMATION_PHRASE = 'EXCLUIR MINHA CONTA'

export default function PerfilPage() {
  const { userEmail, userUid, userPhoto, orgId, orgName, orgPlan, member } = useCrmUser()
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { plan, limits, display } = usePlan()

  // Tabs
  const [activeTab, setActiveTab] = useState('info')

  // Photo upload
  const [uploading, setUploading] = useState(false)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)

  // Password change
  const [showPasswordSection, setShowPasswordSection] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)

  // Delete account
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deletePassword, setDeletePassword] = useState('')
  const [deleting, setDeleting] = useState(false)

  const displayPhoto = photoPreview || userPhoto

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !userEmail) return

    if (!file.type.startsWith('image/')) {
      toast.error('Selecione um arquivo de imagem válido.')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 5MB.')
      return
    }

    setUploading(true)
    try {
      const preview = URL.createObjectURL(file)
      setPhotoPreview(preview)

      const storageRef = ref(storage, `profile-photos/${userUid}`)
      await uploadBytes(storageRef, file)
      const downloadUrl = await getDownloadURL(storageRef)

      await updateDoc(doc(db, 'users', userEmail), { photoUrl: downloadUrl })

      if (orgId && member?.id) {
        await updateDoc(
          doc(db, 'organizations', orgId, 'members', member.id),
          { photoUrl: downloadUrl }
        )
      }

      toast.success('Foto atualizada com sucesso!')
    } catch (err) {
      console.error('[perfil] Photo upload failed:', err)
      toast.error('Erro ao atualizar a foto. Tente novamente.')
      setPhotoPreview(null)
    } finally {
      setUploading(false)
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!auth.currentUser || !userEmail) return

    if (newPassword.length < 6) {
      toast.error('A nova senha deve ter pelo menos 6 caracteres.')
      return
    }

    if (newPassword !== confirmPassword) {
      toast.error('As senhas não coincidem.')
      return
    }

    setChangingPassword(true)
    try {
      const credential = EmailAuthProvider.credential(userEmail, currentPassword)
      await reauthenticateWithCredential(auth.currentUser, credential)
      await updatePassword(auth.currentUser, newPassword)

      toast.success('Senha alterada com sucesso!')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setShowPasswordSection(false)
    } catch (err: any) {
      const code = err?.code || ''
      if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        toast.error('Senha atual incorreta.')
      } else if (code === 'auth/too-many-requests') {
        toast.error('Muitas tentativas. Aguarde alguns minutos.')
      } else {
        toast.error('Erro ao alterar senha. Tente novamente.')
      }
    } finally {
      setChangingPassword(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (!auth.currentUser || !userEmail) return

    setDeleting(true)
    try {
      const credential = EmailAuthProvider.credential(userEmail, deletePassword)
      await reauthenticateWithCredential(auth.currentUser, credential)

      if (orgId && member?.id) {
        await deleteDoc(doc(db, 'organizations', orgId, 'members', member.id))
      }

      await deleteUser(auth.currentUser)
      toast.success('Conta excluída com sucesso.')
      router.replace('/login')
    } catch (err: any) {
      const code = err?.code || ''
      if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        toast.error('Senha incorreta.')
      } else {
        toast.error('Erro ao excluir conta. Tente novamente.')
      }
    } finally {
      setDeleting(false)
    }
  }

  const closeDeleteModal = () => {
    setShowDeleteModal(false)
    setDeleteConfirmText('')
    setDeletePassword('')
  }

  // ─── Tab 1: Informações Básicas ───
  const infoTab = (
    <div className="space-y-6">
      {/* Profile Card */}
      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
        <div className="h-28 bg-gradient-to-r from-primary-600 via-primary-500 to-accent relative">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIzMCIgY3k9IjMwIiByPSIxLjUiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4xKSIvPjwvc3ZnPg==')] opacity-50" />
        </div>

        <div className="px-6 pb-6">
          <div className="flex flex-col sm:flex-row sm:items-end gap-4 -mt-14">
            <div className="relative group">
              <div className="w-28 h-28 rounded-2xl border-4 border-white shadow-lg overflow-hidden bg-slate-100 flex-shrink-0">
                {displayPhoto ? (
                  <Image
                    src={displayPhoto}
                    alt="Foto de perfil"
                    width={112}
                    height={112}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center">
                    <span className="text-3xl font-bold text-primary-600">
                      {userEmail?.charAt(0).toUpperCase() || '?'}
                    </span>
                  </div>
                )}
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="absolute inset-0 rounded-2xl bg-black/0 group-hover:bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 cursor-pointer"
              >
                {uploading ? (
                  <svg className="w-6 h-6 text-white animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                className="hidden"
              />
            </div>

            <div className="flex-1 pb-1">
              <h2 className="text-xl font-bold text-slate-900">
                {member?.displayName || userEmail?.split('@')[0] || 'Usuário'}
              </h2>
              <div className="flex items-center gap-2 mt-1">
                {member?.role && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-700">
                    {ROLE_LABELS[member.role] || member.role}
                  </span>
                )}
                {member?.status && (
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    member.status === 'active' ? 'bg-emerald-100 text-emerald-700' :
                    member.status === 'invited' ? 'bg-amber-100 text-amber-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {STATUS_LABELS[member.status] || member.status}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Account Info */}
      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6">
        <h3 className="text-base font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          Informações da Conta
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <InfoField label="E-mail" value={userEmail || '--'} />
          <InfoField label="Nome" value={member?.displayName || '--'} />
          <InfoField label="Organização" value={orgName || '--'} />
          <InfoField label="Cargo" value={member?.role ? (ROLE_LABELS[member.role] || member.role) : '--'} />
          <InfoField
            label="Membro desde"
            value={
              member?.joinedAt
                ? new Date(member.joinedAt).toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric',
                  })
                : '--'
            }
          />
        </div>
      </div>

      {/* Permissions */}
      {member?.permissions && (
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6">
          <h3 className="text-base font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            Permissões
          </h3>

          <div className="space-y-3">
            <div>
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Escopo de visualização</span>
              <p className="text-sm text-slate-700 mt-0.5">
                {member.permissions.viewScope === 'all' ? 'Todos os dados' :
                 member.permissions.viewScope === 'team' ? 'Dados da equipe' : 'Apenas meus dados'}
              </p>
            </div>

            <div>
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Ações permitidas</span>
              <div className="flex flex-wrap gap-2 mt-2">
                {Object.entries(member.permissions.actions).map(([key, value]) => {
                  if (!value) return null
                  const labels: Record<string, string> = {
                    canCreateContacts: 'Criar contatos',
                    canEditContacts: 'Editar contatos',
                    canDeleteContacts: 'Excluir contatos',
                    canCreateProposals: 'Criar propostas',
                    canExportData: 'Exportar dados',
                    canManageFunnels: 'Gerenciar funis',
                    canManageUsers: 'Gerenciar usuários',
                    canTriggerCalls: 'Disparar ligações',
                    canViewReports: 'Ver relatórios',
                    canManageSettings: 'Gerenciar configurações',
                    canTransferLeads: 'Transferir leads',
                  }
                  return (
                    <span
                      key={key}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 text-slate-600"
                    >
                      <svg className="w-3 h-3 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      {labels[key] || key}
                    </span>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )

  // ─── Tab 2: Segurança ───
  const securityTab = (
    <div className="space-y-6">
      {/* Change Password */}
      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            Alterar Senha
          </h3>
          {!showPasswordSection && (
            <button
              onClick={() => setShowPasswordSection(true)}
              className="text-sm font-medium text-primary-600 hover:text-primary-700 transition-colors"
            >
              Alterar
            </button>
          )}
        </div>

        {!showPasswordSection && (
          <p className="text-sm text-slate-500 mt-2">
            Sua senha protege o acesso à sua conta. Recomendamos alterá-la periodicamente.
          </p>
        )}

        {showPasswordSection && (
          <form onSubmit={handleChangePassword} className="mt-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Senha atual</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-all"
                placeholder="Digite sua senha atual"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nova senha</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={6}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-all"
                placeholder="Mínimo 6 caracteres"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Confirmar nova senha</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-all"
                placeholder="Repita a nova senha"
              />
            </div>
            <div className="flex items-center gap-3 pt-1">
              <button
                type="submit"
                disabled={changingPassword}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 transition-colors disabled:opacity-50"
              >
                {changingPassword ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Alterando...
                  </>
                ) : (
                  'Salvar nova senha'
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowPasswordSection(false)
                  setCurrentPassword('')
                  setNewPassword('')
                  setConfirmPassword('')
                }}
                className="px-5 py-2.5 rounded-xl text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Danger Zone */}
      <div className="bg-white rounded-2xl border border-red-200/60 shadow-sm p-6">
        <h3 className="text-base font-semibold text-red-600 flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          Zona de Perigo
        </h3>
        <p className="text-sm text-slate-500 mt-1 mb-4">
          Esta ação é irreversível. Todos os seus dados serão permanentemente excluídos.
        </p>

        <button
          onClick={() => setShowDeleteModal(true)}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-red-600 bg-red-50 border border-red-200 hover:bg-red-100 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          Excluir minha conta
        </button>
      </div>
    </div>
  )

  // ─── Tab 3: Meu Plano ───
  const overage = PLAN_OVERAGE[plan]
  const allPlans = Object.entries(PLAN_DISPLAY) as [PlanId, typeof PLAN_DISPLAY[PlanId]][]

  const planTab = (
    <div className="space-y-6">
      {/* Current Plan */}
      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
        <div className="p-6 bg-gradient-to-r from-primary-600 via-primary-500 to-accent">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-white/80">Plano atual</p>
              <h3 className="text-2xl font-bold text-white mt-1">{display.displayName}</h3>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-white">
                {display.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </p>
              <p className="text-sm text-white/80">/mês</p>
            </div>
          </div>
        </div>

        <div className="p-6">
          <h4 className="text-sm font-semibold text-slate-900 mb-4 uppercase tracking-wider">Limites do plano</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InfoField label="Usuários" value={`Até ${limits.maxUsers}`} />
            <InfoField label="Funis" value={`Até ${limits.maxFunnels}`} />
            <InfoField label="Contatos" value={`Até ${limits.maxContacts.toLocaleString('pt-BR')}`} />
            <InfoField label="Ações mensais" value={`${limits.monthlyActions.toLocaleString('pt-BR')}`} />
            <InfoField label="Minutos mensais" value={`${limits.monthlyMinutes.toLocaleString('pt-BR')} min`} />
            <InfoField label="Agentes simultâneos" value={`${limits.maxConcurrentAgents}`} />
            <InfoField label="Números dedicados" value={`${limits.maxNumbers}`} />
            <InfoField label="Cadências" value={limits.maxCadences === -1 ? 'Ilimitado' : `${limits.maxCadences}`} />
          </div>

          {overage && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <h4 className="text-sm font-semibold text-slate-900 mb-3 uppercase tracking-wider">Excedente</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InfoField label="Por ação adicional" value={overage.perAction.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} />
                <InfoField label="Por minuto adicional" value={overage.perMinute.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Features */}
      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6">
        <h3 className="text-base font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Funcionalidades incluídas
        </h3>
        <div className="flex flex-wrap gap-2">
          {Object.entries(FEATURE_LABELS).map(([key, label]) => (
            <span
              key={key}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-100"
            >
              <svg className="w-3.5 h-3.5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* Other Plans */}
      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6">
        <h3 className="text-base font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
          Trocar de plano
        </h3>
        <p className="text-sm text-slate-500 mb-4">
          Compare os planos disponíveis e escolha o que melhor atende suas necessidades.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {allPlans.map(([planId, planInfo]) => {
            const isCurrent = planId === plan
            const planLimits = PLAN_LIMITS[planId]
            return (
              <div
                key={planId}
                className={`rounded-xl border p-4 transition-all ${
                  isCurrent
                    ? 'border-2 border-primary-500 bg-primary-50 shadow-md ring-2 ring-primary-200 ring-offset-1'
                    : 'border-slate-200 hover:border-slate-300 hover:shadow-sm'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-bold text-slate-900">{planInfo.displayName}</h4>
                  {isCurrent && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-white bg-primary-500 px-2.5 py-1 rounded-full shadow-sm">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                      Plano atual
                    </span>
                  )}
                </div>
                <p className="text-lg font-bold text-slate-900">
                  {planInfo.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  <span className="text-xs font-normal text-slate-500">/mês</span>
                </p>
                <div className="mt-3 space-y-1.5 text-xs text-slate-600">
                  <div className="flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                    <span>{planLimits.maxUsers} usuários</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                    <span>{planLimits.maxContacts.toLocaleString('pt-BR')} contatos</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                    <span>{planLimits.maxFunnels} funis</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                    <span>{planLimits.monthlyMinutes.toLocaleString('pt-BR')} min/mês</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                    <span>{planLimits.maxConcurrentAgents} agentes simultâneos</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                    <span>{planLimits.maxCadences === -1 ? 'Cadências ilimitadas' : `${planLimits.maxCadences} cadência${planLimits.maxCadences > 1 ? 's' : ''}`}</span>
                  </div>
                </div>
                {isCurrent ? (
                  <button disabled className="mt-4 w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-primary-600 bg-primary-50 border border-primary-200 cursor-not-allowed opacity-70">
                    Plano atual
                  </button>
                ) : (
                  <button
                    onClick={() => toast.info('Entre em contato com o suporte para trocar de plano.')}
                    className="mt-4 w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-primary-600 bg-primary-50 border border-primary-200 hover:bg-primary-100 transition-colors"
                  >
                    Selecionar plano
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )

  const tabs = [
    { key: 'info', label: 'Informações', content: infoTab },
    { key: 'security', label: 'Segurança', content: securityTab },
    { key: 'plan', label: 'Meu Plano', content: planTab },
  ]

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Meu Perfil</h1>
          <p className="text-sm text-slate-500 mt-1">Gerencie suas informações pessoais e configurações de conta</p>
        </div>

        {/* Tabs */}
        <Tabs items={tabs} active={activeTab} onChange={setActiveTab} />
      </div>

      {/* Delete Account Modal */}
      <Modal isOpen={showDeleteModal} onClose={closeDeleteModal} size="md" centered>
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Excluir conta</h3>
              <p className="text-sm text-slate-500">Esta ação não pode ser desfeita.</p>
            </div>
          </div>

          <div className="bg-red-50 border border-red-100 rounded-xl p-4">
            <p className="text-sm text-red-700">
              Ao excluir sua conta, todos os seus dados serão permanentemente removidos. Isso inclui seu perfil, configurações e acesso à organização.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Digite <span className="font-bold text-red-600">{DELETE_CONFIRMATION_PHRASE}</span> para confirmar
            </label>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-400 transition-all"
              placeholder={DELETE_CONFIRMATION_PHRASE}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Confirme sua senha
            </label>
            <input
              type="password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-400 transition-all"
              placeholder="Sua senha"
            />
          </div>

          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={handleDeleteAccount}
              disabled={deleting || deleteConfirmText !== DELETE_CONFIRMATION_PHRASE || !deletePassword}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {deleting ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Excluindo...
                </>
              ) : (
                'Excluir minha conta permanentemente'
              )}
            </button>
            <button
              onClick={closeDeleteModal}
              className="px-5 py-2.5 rounded-xl text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-100">
      <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">{label}</span>
      <p className="text-sm font-medium text-slate-800 mt-0.5 truncate">{value}</p>
    </div>
  )
}
