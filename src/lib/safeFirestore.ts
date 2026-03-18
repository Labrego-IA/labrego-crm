import {
  onSnapshot,
  type DocumentReference,
  type Query,
  type DocumentSnapshot,
  type QuerySnapshot,
  type Unsubscribe,
} from 'firebase/firestore'

/**
 * Wrapper seguro para onSnapshot que captura erros de permissão
 * sem crashar a aplicação. Retorna dados vazios em caso de erro.
 */
export function safeOnSnapshot<T>(
  ref: DocumentReference | Query,
  onNext: (snapshot: T) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  return onSnapshot(
    ref as any,
    (snapshot: any) => {
      onNext(snapshot as T)
    },
    (error: any) => {
      const msg = error?.message || String(error)
      if (msg.includes('Missing or insufficient permissions') || msg.includes('permission')) {
        console.warn('[safeOnSnapshot] Permission denied (expected for free plan):', msg)
      } else {
        console.error('[safeOnSnapshot] Firestore error:', error)
      }
      if (onError) {
        onError(error)
      }
    }
  )
}
