'use client'
import { useEffect, useState } from 'react'
import { auth, db } from './firebaseClient'
import { doc, getDoc } from 'firebase/firestore'
import { DEFAULT_CONSULTOR_SCREENS, DEFAULT_USER_SCREENS } from './roleDefaults'

export const FALLBACK_ADMIN_EMAILS = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || '')
  .split(',')
  .map(e => e.trim().toLowerCase())
  .filter(Boolean)

export interface ScreenActionPermissions {
  edit?: boolean
  delete?: boolean
  viewScope?: 'own' | 'all'
}

export interface RoleInfo {
  /**
   * Nome do role atribuído ao usuário (ex: 'admin', 'user', 'contador').
   */
  name: string
  /**
   * Lista de telas permitidas para o role. Se indefinido, considera acesso total.
   */
  allowedScreens?: string[]
  /**
   * Permissões adicionais por tela (ex.: editar, excluir).
   */
  actionPermissions?: Record<string, ScreenActionPermissions>
}

interface UseRoleResult {
  role: RoleInfo | null
  loading: boolean
}

export default function useRole(): UseRoleResult {
  const [role, setRole] = useState<RoleInfo | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const email = auth.currentUser?.email?.toLowerCase()

    if (!email) {
      setRole(null)
      setLoading(false)
      return
    }

    let isMounted = true
    setLoading(true)

    getDoc(doc(db, 'userRoles', email))
      .then(async (snap) => {
        if (!isMounted) return

        let name = snap.data()?.role as string | undefined
        const frozen = snap.data()?.frozen === true
        if (frozen) {
          setRole({ name: 'frozen', allowedScreens: [] })
          return
        }

        if (!name && FALLBACK_ADMIN_EMAILS.includes(email)) {
          name = 'admin'
        }

        name = name || 'user'

        let allowedScreens: string[] | undefined
        let actionPermissions: Record<string, ScreenActionPermissions> | undefined
        try {
          const roleSnap = await getDoc(doc(db, 'roleConfigs', name))
          const data = roleSnap.data() as
            | {
                allowedScreens?: unknown
                actionPermissions?: Record<string, ScreenActionPermissions>
              }
            | undefined
          if (data) {
            if (Array.isArray(data.allowedScreens)) {
              allowedScreens = data.allowedScreens
            } else {
              allowedScreens = undefined
            }

            if (data.actionPermissions && typeof data.actionPermissions === 'object') {
              actionPermissions = Object.fromEntries(
                Object.entries(data.actionPermissions).map(([screen, value]) => {
                  const perms = (value ?? {}) as ScreenActionPermissions
                  return [
                    screen,
                    {
                      edit: Boolean(perms.edit),
                      delete: Boolean(perms.delete),
                      viewScope: perms.viewScope === 'own' ? 'own' : perms.viewScope === 'all' ? 'all' : undefined,
                    },
                  ]
                })
              ) as Record<string, ScreenActionPermissions>
            }
          }
        } catch (err) {
          console.error('Failed to load role config', err)
        }
        if (!allowedScreens) {
          if (name === 'user') {
            allowedScreens = DEFAULT_USER_SCREENS
          } else if (name === 'consultor') {
            allowedScreens = DEFAULT_CONSULTOR_SCREENS
          }
        }

        setRole({ name, allowedScreens, actionPermissions })
      })
      .catch((err) => {
        console.error('Failed to load user role', err)
        if (isMounted) {
          setRole(null)
        }
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false)
        }
      })

    return () => {
      isMounted = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.currentUser?.email])

  return { role, loading }
}

export type { UseRoleResult }
