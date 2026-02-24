'use client'

import { useState, useEffect } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebaseClient'

async function checkEmail(email: string): Promise<boolean> {
  try {
    const snap = await getDoc(doc(db, 'superAdmins', email.toLowerCase()))
    return snap.exists()
  } catch (err) {
    console.error('[useSuperAdmin] Firestore error:', err)
    return false
  }
}

export function useSuperAdmin() {
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function check(email: string) {
      const result = await checkEmail(email)
      if (!cancelled) {
        setIsSuperAdmin(result)
        setLoading(false)
      }
    }

    // Check immediately if already logged in
    if (auth.currentUser?.email) {
      check(auth.currentUser.email)
    }

    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user?.email) {
        if (!cancelled) {
          setIsSuperAdmin(false)
          setLoading(false)
        }
        return
      }
      check(user.email)
    })

    return () => {
      cancelled = true
      unsub()
    }
  }, [])

  return { isSuperAdmin, loading }
}
