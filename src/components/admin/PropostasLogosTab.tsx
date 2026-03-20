'use client'

import { useState, useEffect, useRef } from 'react'
import ConfirmCloseDialog from '@/components/ConfirmCloseDialog'
import { useCrmUser } from '@/contexts/CrmUserContext'
import { useProposalDataAccess } from '@/hooks/useProposalDataAccess'
import { db, storage } from '@/lib/firebaseClient'
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
} from 'firebase/firestore'
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import { toast } from 'sonner'

interface LogoItem {
  id: string
  url: string
  name: string
  orgId: string
  createdBy?: string
}

export default function PropostasLogosTab() {
  const { orgId, userUid } = useCrmUser()
  const { filterByAccess, loading: accessLoading } = useProposalDataAccess()
  const [logos, setLogos] = useState<LogoItem[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [deletingLogo, setDeletingLogo] = useState<LogoItem | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!orgId || accessLoading) return
    loadLogos()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, accessLoading])

  const loadLogos = async () => {
    if (!orgId) return
    setLoading(true)
    try {
      const snap = await getDocs(query(collection(db, 'logos'), where('orgId', '==', orgId)))
      const allItems = snap.docs.map(d => ({
        id: d.id,
        ...d.data(),
      } as LogoItem))
      setLogos(filterByAccess(allItems))
    } catch (error) {
      console.error('Error loading logos:', error)
      toast.error('Erro ao carregar logos.')
    } finally {
      setLoading(false)
    }
  }

  const handleUpload = async (files: FileList) => {
    if (!orgId || files.length === 0) return
    setUploading(true)
    try {
      for (const file of Array.from(files)) {
        const ext = file.name.split('.').pop() || 'png'
        const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
        const path = `organizations/${orgId}/logos/${fileName}`
        const sRef = storageRef(storage, path)
        await uploadBytes(sRef, file)
        const url = await getDownloadURL(sRef)
        await addDoc(collection(db, 'logos'), {
          url,
          name: file.name.replace(/\.[^.]+$/, ''),
          orgId,
          createdBy: userUid,
        })
      }
      toast.success(`${files.length} logo${files.length > 1 ? 's' : ''} enviado${files.length > 1 ? 's' : ''}!`)
      await loadLogos()
    } catch (error) {
      console.error('Upload error:', error)
      toast.error('Erro ao enviar logo.')
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingLogo) return
    try {
      await deleteDoc(doc(db, 'logos', deletingLogo.id))
      toast.success('Logo excluido!')
      setDeletingLogo(null)
      await loadLogos()
    } catch (error) {
      console.error('Delete logo error:', error)
      toast.error('Erro ao excluir logo.')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-3 border-primary-200 border-t-primary-600" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">
            {logos.length} logo{logos.length !== 1 ? 's' : ''} de clientes cadastrado{logos.length !== 1 ? 's' : ''}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            Esses logos aparecem na pagina de clientes do PDF de propostas.
          </p>
        </div>
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="px-4 py-2 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors shadow-sm"
        >
          {uploading ? 'Enviando...' : '+ Enviar Logo'}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={e => {
            if (e.target.files) handleUpload(e.target.files)
            e.target.value = ''
          }}
        />
      </div>

      {logos.length === 0 ? (
        <div className="rounded-2xl bg-white border border-gray-200 p-12 text-center">
          <p className="text-gray-400 text-sm">Nenhum logo de cliente cadastrado.</p>
          <button
            onClick={() => inputRef.current?.click()}
            className="mt-3 text-sm text-primary-600 hover:text-primary-700 font-medium"
          >
            Enviar primeiro logo
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {logos.map(logo => (
            <div
              key={logo.id}
              className="group relative rounded-2xl bg-white border border-gray-200 p-4 flex flex-col items-center gap-3 hover:shadow-md transition-shadow"
            >
              <div className="h-16 w-full flex items-center justify-center">
                <img
                  src={logo.url}
                  alt={logo.name}
                  className="max-h-16 max-w-full object-contain"
                />
              </div>
              <p className="text-xs text-gray-500 text-center truncate w-full">{logo.name}</p>
              <button
                onClick={() => setDeletingLogo(logo)}
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 rounded-full bg-red-50 text-red-400 hover:bg-red-100 hover:text-red-600 flex items-center justify-center text-xs"
              >
                &times;
              </button>
            </div>
          ))}
        </div>
      )}

      <ConfirmCloseDialog
        isOpen={!!deletingLogo}
        onConfirm={handleDelete}
        onCancel={() => setDeletingLogo(null)}
        title="Excluir logo"
        message={`Tem certeza que deseja excluir o logo "${deletingLogo?.name}"? Esta ação não pode ser desfeita.`}
        confirmText="Sim, excluir"
        cancelText="Cancelar"
      />
    </div>
  )
}
