'use client'

import { useCallback, useEffect, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'

import { auth } from './firebaseClient'

export interface ClientCrmDocumentEntry {
  id: string
  name: string
  url: string
  folder?: string | null
  type?: string | null
  uploadedAt?: string | null
}

export interface ClientContractEntry {
  id: string
  name?: string
  projectId?: string
  projectName?: string | null
  signedAt?: string | null
  url: string
}

interface ClientCrmDocumentsResponse {
  clientId: string | null
  documents: ClientCrmDocumentEntry[]
  contracts: ClientContractEntry[]
}

function isValidResponse(value: unknown): value is ClientCrmDocumentsResponse {
  if (!value || typeof value !== 'object') return false
  const data = value as Record<string, unknown>
  const documents = Array.isArray(data.documents)
    ? (data.documents as unknown[]).every(item =>
        item &&
        typeof item === 'object' &&
        typeof (item as { id?: unknown }).id === 'string' &&
        typeof (item as { url?: unknown }).url === 'string',
      )
    : false
  const contracts = Array.isArray(data.contracts)
    ? (data.contracts as unknown[]).every(item =>
        item &&
        typeof item === 'object' &&
        typeof (item as { id?: unknown }).id === 'string' &&
        typeof (item as { url?: unknown }).url === 'string',
      )
    : false
  return documents && contracts
}

export default function useClientCrmDocuments() {
  const [documents, setDocuments] = useState<ClientCrmDocumentEntry[]>([])
  const [contracts, setContracts] = useState<ClientContractEntry[]>([])
  const [clientId, setClientId] = useState<string | null>(null)

  const fetchDocuments = useCallback(async (email: string) => {
    try {
      const res = await fetch('/api/client-crm-documents', {
        headers: { 'x-user-email': email },
      })
      if (!res.ok) {
        setDocuments([])
        setContracts([])
        setClientId(null)
        return
      }
      const data = (await res.json()) as unknown
      if (!isValidResponse(data)) {
        setDocuments([])
        setContracts([])
        setClientId(null)
        return
      }
      setDocuments(data.documents)
      setContracts(data.contracts)
      setClientId(typeof data.clientId === 'string' ? data.clientId : null)
    } catch (err) {
      console.error('Failed to load CRM documents', err)
      setDocuments([])
      setContracts([])
      setClientId(null)
    }
  }, [])

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, user => {
      if (user?.email) {
        fetchDocuments(user.email)
      } else {
        setDocuments([])
        setContracts([])
        setClientId(null)
      }
    })
    return () => unsubscribe()
  }, [fetchDocuments])

  const load = useCallback(() => {
    const email = auth.currentUser?.email
    if (email) {
      fetchDocuments(email)
    }
  }, [fetchDocuments])

  return { documents, contracts, clientId, load }
}
