import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Notification from '../components/Notification'
import { CalendarIcon, ClockIcon, MapIcon } from '@heroicons/react/24/solid'

export default function Login() {
  const navigate = useNavigate()
  
  // --- ESTADOS DE FORMULARIO ---
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  
  // --- ESTADOS DE RECUPERACIÓN (FORGOT PASSWORD) ---
  const [isResetOpen, setIsResetOpen] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetLoading, setResetLoading] = useState(false)

  // --- ESTADOS DE VISUALIZACIÓN ---
  const [notification, setNotification] = useState({ msg: '', type: '' })
  
  // Inicializar Tema y Texto desde LocalStorage (Memoria)
  const [theme, setTheme] = useState(localStorage.getItem('senda-theme') || 'nord')
  const [textSize, setTextSize] = useState(localStorage.getItem('senda-text-size') || 100)

  // --- EFECTO 1: APLICAR TEMA Y GUARDAR ---
  useEffect(() => {
    document.querySelector('html').setAttribute('data-theme', theme)
    localStorage.setItem('senda-theme', theme)
  }, [theme])

  // --- EFECTO 2: APLICAR TAMAÑO TEXTO Y GUARDAR ---
  useEffect(() => {
    document.documentElement.style.fontSize = `${textSize}%`
    localStorage.setItem('senda-text-size', textSize)
  }, [textSize])

  // --- FUNCIÓN: LOGIN ---
  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setNotification({ msg: '', type: '' })

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password,
      })

      if (error) throw error
      navigate('/dashboard')

    } catch (error) {
      let msg = 'Ocurrió un problema de conexión.'
      if (error.message.includes('Invalid login')) msg = 'Credenciales incorrectas.'
      setNotification({ msg, type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  // --- FUNCIÓN: RECUPERAR CONTRASEÑA ---
  const handleResetPassword = async (e) => {
    e.preventDefault()
    setResetLoading(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: window.location.origin + '/update-password', // Opcional: URL de redirección
      })
      if (error) throw error
      
      setNotification({ msg: '¡Correo enviado! Revisa tu bandeja de entrada.', type: 'success' })
      setIsResetOpen(false) // Cerrar modal
      setResetEmail('') // Limpiar campo
    } catch (error) {
      setNotification({ msg: 'Error: ' + error.message, type: 'error' })
    } finally {
      setResetLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-base-200 flex items-center justify-center p-4 relative overflow-hidden transition-colors duration-500">
      
      {/* 1. BOTÓN FLOTANTE DE ACCESIBILIDAD (MEJORADO) */}
      <div className="absolute top-4 right-4 z-50">
        <div className="dropdown dropdown-end">
          <label tabIndex={0} className="btn btn-circle btn-ghost bg-base-100 shadow-lg hover:scale-110 transition-transform text-primary" title="Accesibilidad">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
          </label>
          
          <div tabIndex={0} className="menu dropdown-content mt-3 z-[1] p-4 shadow-2xl bg-base-100 rounded-box w-72 border border-base-200">
            <h3 className="font-bold text-lg mb-2 text-primary border-b border-base-200 pb-2">Accesibilidad</h3>
            
            {/* CONTROLES DE TEMA (Igual que Navbar) */}
            <div className="form-control mb-4">
              <label className="label"><span className="label-text font-semibold">Contraste</span></label>
              <div className="join w-full grid grid-cols-3 gap-1">
                <input type="radio" className="join-item btn btn-sm bg-base-200 border-base-300" aria-label="Suave" onChange={() => setTheme('nord')} checked={theme === 'nord'} />
                <input type="radio" className="join-item btn btn-sm bg-gray-800 text-white hover:bg-gray-900 border-none" aria-label="Oscuro" onChange={() => setTheme('dim')} checked={theme === 'dim'} />
                <input type="radio" className="join-item btn btn-sm bg-yellow-400 text-black hover:bg-yellow-500 border-none font-bold" aria-label="Alto" onChange={() => setTheme('bumblebee')} checked={theme === 'bumblebee'} />
              </div>
            </div>

            {/* CONTROL DE TAMAÑO TEXTO (Igual que Navbar) */}
            <div className="form-control">
              <label className="label">
                <span className="label-text font-semibold">Tamaño Texto</span>
                <span className="badge badge-sm">{textSize}%</span>
              </label>
              <input 
                type="range" min="90" max="120" step="5"
                value={textSize} onChange={(e) => setTextSize(e.target.value)} 
                className="range range-xs range-primary" 
              />
              <div className="w-full flex justify-between text-xs px-2 mt-1 opacity-50"><span>A</span><span>A+</span></div>
            </div>
          </div>
        </div>
      </div>

      <Notification message={notification.msg} type={notification.type} onClose={() => setNotification({ msg: '', type: '' })} />

      {/* FONDO ANIMADO */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-primary/20 rounded-full blur-[100px] animate-pulse"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-secondary/20 rounded-full blur-[100px] animate-pulse delay-1000"></div>

      {/* TARJETA PRINCIPAL */}
      <div className="card lg:card-side bg-base-100 shadow-2xl border border-base-300 max-w-5xl w-full overflow-hidden">
        
        {/* LADO IZQUIERDO: DIFF */}
        <figure className="w-full lg:w-1/2 relative min-h-[500px] hidden lg:block group">
          <div className="diff aspect-[16/9] h-full w-full">
            <div className="diff-item-1">
              <div className="bg-primary text-primary-content grid place-content-center text-9xl font-black h-full select-none">
                SENDA<span className="text-lg font-normal tracking-[0.5em] mt-4 uppercase">Claridad</span>
              </div>
            </div>
            <div className="diff-item-2">
              <div className="bg-base-300 text-base-content/10 grid place-content-center text-9xl font-black h-full select-none">
                CAOS<span className="text-lg font-normal tracking-[0.5em] mt-4 uppercase opacity-50">Confusión</span>
              </div>
            </div>
            <div className="diff-resizer"></div>
          </div>
          <div className="absolute bottom-6 left-0 w-full flex justify-center pointer-events-none z-20">
             <div className="badge badge-neutral gap-2 py-4 px-6 shadow-lg backdrop-blur-md border-white/10 animate-bounce">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" /></svg>
                <span className="tracking-wide text-xs font-bold uppercase">Desliza para descubrir</span>
             </div>
          </div>
        </figure>

        {/* LADO DERECHO: FORMULARIO */}
        <div className="card-body w-full lg:w-1/2 justify-center p-8 lg:p-12 bg-base-100 relative z-10">
          <div className="mb-8 text-center lg:text-left">
             <h2 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary mb-2">Bienvenido</h2>
             <p className="opacity-60 text-sm">Plataforma de Tutorías Académicas Inclusivas</p>
          </div>

          <form onSubmit={handleLogin} className="flex flex-col gap-5">
            <div className="form-control">
              <label className="label"><span className="label-text font-bold">Correo Institucional</span></label>
              <input type="email" placeholder="ejemplo@itsi.edu.ec" className="input input-bordered input-primary w-full bg-base-200 focus:bg-base-100 transition-all" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="form-control">
              <label className="label"><span className="label-text font-bold">Contraseña</span></label>
              <input type="password" placeholder="••••••••" className="input input-bordered input-primary w-full bg-base-200 focus:bg-base-100 transition-all" value={password} onChange={(e) => setPassword(e.target.value)} required />
              <label className="label">
                {/* BOTÓN OLVIDASTE CONTRASEÑA */}
                <a onClick={() => setIsResetOpen(true)} className="label-text-alt link link-primary hover:text-secondary transition-colors cursor-pointer">
                  ¿Olvidaste tu contraseña?
                </a>
              </label>
            </div>
            <button type="submit" className="btn btn-primary mt-4 w-full shadow-lg hover:shadow-primary/40 hover:scale-[1.01] transition-all text-lg font-bold" disabled={loading}>
              {loading ? <span className="loading loading-dots"></span> : 'Entrar a mi Senda'}
            </button>
          </form>

          <div className="mt-8 text-center opacity-30 text-[10px] uppercase tracking-widest">© 2025 Senda • v1.0.5</div>
        </div>
      </div>

      {/* --- MODAL RECUPERAR CONTRASEÑA --- */}
      {isResetOpen && (
        <dialog className="modal modal-open bg-black/60 backdrop-blur-sm">
          <div className="modal-box relative border-t-8 border-primary">
            <button onClick={() => setIsResetOpen(false)} className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button>
            <h3 className="font-bold text-2xl text-primary mb-2">Recuperar Acceso</h3>
            <p className="py-2 text-sm opacity-70 mb-4">Ingresa tu correo institucional y te enviaremos un enlace mágico para restablecer tu contraseña.</p>
            
            <form onSubmit={handleResetPassword} className="flex flex-col gap-4">
              <div className="form-control">
                <label className="label font-bold text-xs uppercase">Correo Electrónico</label>
                <input 
                  type="email" 
                  placeholder="tucorreo@itsi.edu.ec" 
                  className="input input-bordered w-full"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  required
                />
              </div>
              <div className="modal-action">
                <button type="button" onClick={() => setIsResetOpen(false)} className="btn btn-ghost">Cancelar</button>
                <button type="submit" className="btn btn-primary px-8" disabled={resetLoading}>
                  {resetLoading ? <span className="loading loading-spinner"></span> : 'Enviar Enlace'}
                </button>
              </div>
            </form>
          </div>
        </dialog>
      )}

    </div>
  )
}