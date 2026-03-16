import { ReactNode, useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import ConfirmCloseDialog from './ConfirmCloseDialog'

type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl'

type ModalProps = {
  isOpen: boolean
  onClose: () => void
  children: ReactNode
  className?: string
  overlayClassName?: string
  ariaLabelledby?: string
  ariaDescribedby?: string
  fullScreen?: boolean
  centered?: boolean
  unstyled?: boolean
  size?: ModalSize
  /** Se true, mostra confirmação antes de fechar ao clicar fora ou pressionar Esc */
  hasUnsavedChanges?: boolean
  /** Mensagem customizada para o diálogo de confirmação */
  confirmCloseMessage?: string
}

const sizeClasses: Record<ModalSize, string> = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-md',
  lg: 'sm:max-w-lg',
  xl: 'sm:max-w-xl',
  '2xl': 'sm:max-w-2xl',
  '3xl': 'sm:max-w-3xl',
  '4xl': 'sm:max-w-4xl',
}

export default function Modal({
  isOpen,
  onClose,
  children,
  className = '',
  overlayClassName = '',
  ariaLabelledby,
  ariaDescribedby,
  fullScreen = false,
  centered = false,
  unstyled = false,
  size = 'md',
  hasUnsavedChanges = false,
  confirmCloseMessage,
}: ModalProps) {
  const [mounted, setMounted] = useState(false)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Reset confirm dialog when modal closes
  useEffect(() => {
    if (!isOpen) {
      setShowConfirmDialog(false)
    }
  }, [isOpen])

  const handleCloseRequest = useCallback(() => {
    if (hasUnsavedChanges) {
      setShowConfirmDialog(true)
    } else {
      onClose()
    }
  }, [hasUnsavedChanges, onClose])

  const handleConfirmClose = useCallback(() => {
    setShowConfirmDialog(false)
    onClose()
  }, [onClose])

  const handleCancelClose = useCallback(() => {
    setShowConfirmDialog(false)
  }, [])

  // Handle ESC key
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        handleCloseRequest()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, handleCloseRequest])

  useEffect(() => {
    if (!isOpen) return

    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = originalOverflow
    }
  }, [isOpen])

  if (!isOpen || !mounted) return null

  const baseOverlayClass = 'fixed inset-0 z-[80] flex justify-center'
  const overlayAlignmentClass = centered
    ? 'items-center'
    : 'items-start'

  const baseOverlayClassName = fullScreen
    ? `${baseOverlayClass} items-stretch p-0`
    : `${baseOverlayClass} ${overlayAlignmentClass} overflow-y-auto bg-slate-900/60 p-4 sm:p-6`

  const overlayClass = [baseOverlayClassName, overlayClassName].filter(Boolean).join(' ')

  const baseContentClass = fullScreen
    ? 'w-full h-full max-w-none max-h-none overflow-y-auto rounded-none border-0 bg-white dark:bg-neutral-800 p-4 sm:p-6 lg:p-8 shadow-lg'
    : `w-full max-w-[95vw] ${sizeClasses[size]} rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-800 p-4 sm:p-6 shadow-lg max-h-[90vh] overflow-y-auto my-4 sm:my-0`

  const contentClass = unstyled
    ? className
    : [baseContentClass, className].filter(Boolean).join(' ')

  if (fullScreen) {
    return createPortal(
      <>
        <div
          className="fixed inset-0 z-[80] bg-slate-900/60"
          onClick={handleCloseRequest}
          aria-hidden
        />
        <div
          className={overlayClass}
          role="dialog"
          aria-modal="true"
          aria-labelledby={ariaLabelledby}
          aria-describedby={ariaDescribedby}
        >
          <div className={contentClass} onClick={(e) => e.stopPropagation()}>
            {children}
          </div>
        </div>
        <ConfirmCloseDialog
          isOpen={showConfirmDialog}
          onConfirm={handleConfirmClose}
          onCancel={handleCancelClose}
          message={confirmCloseMessage}
        />
      </>,
      document.body,
    )
  }

  return createPortal(
    <>
      <div
        className={overlayClass}
        onClick={handleCloseRequest}
        role="dialog"
        aria-modal="true"
        aria-labelledby={ariaLabelledby}
        aria-describedby={ariaDescribedby}
      >
        <div className={contentClass} onClick={(e) => e.stopPropagation()}>
          {children}
        </div>
      </div>
      <ConfirmCloseDialog
        isOpen={showConfirmDialog}
        onConfirm={handleConfirmClose}
        onCancel={handleCancelClose}
        message={confirmCloseMessage}
      />
    </>,
    document.body,
  )
}
