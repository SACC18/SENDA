import { useEffect } from 'react'

export default function Notification({ message, type, onClose }) {
  // Auto-cierre a los 3 segundos
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => {
        onClose()
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [message, onClose])

  if (!message) return null

  // Definir colores según el tipo (error o success)
  const alertClass = type === 'error' ? 'alert-error' : 'alert-success'

  return (
    <div className="toast toast-top toast-end z-50">
      <div className={`alert ${alertClass} shadow-lg animate-bounce`}>
        {type === 'error' ? (
          <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        )}
        <span>{message}</span>
        <button onClick={onClose} className="btn btn-xs btn-ghost">✕</button>
      </div>
    </div>
  )
}