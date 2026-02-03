import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Link } from 'react-router-dom'
import { EyeIcon, ArrowRightOnRectangleIcon, UserCircleIcon, AdjustmentsHorizontalIcon } from '@heroicons/react/24/outline'

export default function Navbar() {
    const [theme, setTheme] = useState(localStorage.getItem('senda-theme') || 'nord')
    const [textSize, setTextSize] = useState(localStorage.getItem('senda-text-size') || 100)

    const words = ["Tu Futuro", "Tu Progreso", "Tu Camino"]
    const [currentWordIndex, setCurrentWordIndex] = useState(0)
    const [displayText, setDisplayText] = useState("")
    const [isDeleting, setIsDeleting] = useState(false)
    
    // Estados de Usuario
    const [userName, setUserName] = useState('Usuario')
    
    // SOLUCIÓN 1: Leemos la memoria local INMEDIATAMENTE al iniciar
    // Si ya entraste antes, cargará tu foto en 0.00ms sin esperar a Supabase
    const [userAvatar, setUserAvatar] = useState(localStorage.getItem('senda-avatar') || null)

    useEffect(() => {
        const getUser = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
                const { data } = await supabase.from('profiles').select('full_name, avatar_url').eq('id', user.id).single()
                if (data) {
                    setUserName(data.full_name)
                    
                    // Si encontramos un avatar nuevo en la base de datos, lo guardamos en memoria
                    if (data.avatar_url) {
                        setUserAvatar(data.avatar_url)
                        localStorage.setItem('senda-avatar', data.avatar_url) // <--- GUARDAR EN MEMORIA
                    }
                }
            }
        }
        getUser()
    }, [])

    // ... (El resto de tus useEffects de texto y tema siguen igual) ...
    useEffect(() => {
        const typeSpeed = isDeleting ? 50 : 150
        const word = words[currentWordIndex]
        const timer = setTimeout(() => {
            if (!isDeleting && displayText === word) {
                setTimeout(() => setIsDeleting(true), 2000)
            } else if (isDeleting && displayText === "") {
                setIsDeleting(false)
                setCurrentWordIndex((prev) => (prev + 1) % words.length)
            } else {
                setDisplayText(word.substring(0, displayText.length + (isDeleting ? -1 : 1)))
            }
        }, typeSpeed)
        return () => clearTimeout(timer)
    }, [displayText, isDeleting, currentWordIndex])

    useEffect(() => {
        document.querySelector('html').setAttribute('data-theme', theme)
        localStorage.setItem('senda-theme', theme)
    }, [theme])

    useEffect(() => {
        document.documentElement.style.fontSize = `${textSize}%`
        localStorage.setItem('senda-text-size', textSize)
    }, [textSize])

    const handleLogout = async () => {
        await supabase.auth.signOut()
        localStorage.removeItem('senda-avatar') // Limpiar foto al salir
        window.location.reload()
    }

    // Avatar Final
    const finalAvatar = userAvatar || `https://api.dicebear.com/7.x/notionists/svg?seed=${userName}&backgroundColor=e5e7eb`

    return (
        <div className="navbar bg-base-100/80 backdrop-blur-md sticky top-0 z-50 border-b border-base-200 shadow-sm transition-all duration-300">
            {/* IZQUIERDA: LOGO */}
            <div className="flex-1 gap-2 items-center flex">
                <Link to="/dashboard" className="btn btn-ghost px-1 hover:bg-transparent normal-case text-xl flex items-center gap-2 group">
                    <img src="/img/logo.png" alt="Senda" className="h-10 w-10 object-contain transition-transform group-hover:scale-110" onError={(e) => { e.target.style.display = 'none' }} />
                    <span className="font-black text-2xl text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">SENDA</span>
                </Link>
                <div className="hidden md:flex items-center gap-2">
                    <span className="text-sm font-light opacity-50 mb-1">es</span>
                    <span className="badge badge-lg badge-outline font-mono font-bold text-primary min-w-[140px] justify-start border-primary/50">
                        {displayText}<span className="animate-pulse">|</span>
                    </span>
                </div>
            </div>

            {/* DERECHA */}
            <div className="flex-none gap-2">
                {/* Accesibilidad */}
                <div className="dropdown dropdown-end">
                    <label tabIndex={0} className="btn btn-ghost btn-circle text-primary" title="Accesibilidad">
                        <EyeIcon className="h-6 w-6" />
                    </label>
                    <div tabIndex={0} className="menu dropdown-content mt-3 z-[1] p-4 shadow-2xl bg-base-100 rounded-box w-72 border border-base-200">
                       <h3 className="font-bold text-lg mb-2 text-primary border-b border-base-200 pb-2 flex items-center gap-2"><AdjustmentsHorizontalIcon className="h-5 w-5" /> Ajustes Visuales</h3>
                       <div className="form-control mb-4">
                            <label className="label"><span className="label-text font-semibold">Contraste</span></label>
                            <div className="join w-full grid grid-cols-3 gap-1">
                                <input type="radio" className="join-item btn btn-sm bg-base-200 border-base-300" aria-label="Suave" onChange={() => setTheme('nord')} checked={theme === 'nord'} />
                                <input type="radio" className="join-item btn btn-sm bg-gray-800 text-white hover:bg-gray-900 border-none" aria-label="Oscuro" onChange={() => setTheme('dim')} checked={theme === 'dim'} />
                                <input type="radio" className="join-item btn btn-sm bg-yellow-400 text-black hover:bg-yellow-500 border-none font-bold" aria-label="Alto" onChange={() => setTheme('bumblebee')} checked={theme === 'bumblebee'} />
                            </div>
                       </div>
                       <div className="form-control">
                            <label className="label"><span className="label-text font-semibold">Tamaño Texto</span><span className="badge badge-sm">{textSize}%</span></label>
                            <input type="range" min="90" max="120" value={textSize} onChange={(e) => setTextSize(e.target.value)} className="range range-xs range-primary" step="5" />
                       </div>
                    </div>
                </div>

                {/* PERFIL */}
                <div className="dropdown dropdown-end">
                    <label tabIndex={0} className="btn btn-ghost btn-circle avatar placeholder">
                        <div className="bg-neutral-focus text-neutral-content rounded-full w-10 ring ring-primary ring-offset-base-100 ring-offset-2 transition-all hover:scale-110">
                            <img src={finalAvatar} alt="Avatar" />
                        </div>
                    </label>
                    <ul tabIndex={0} className="mt-3 z-[1] p-2 shadow menu menu-sm dropdown-content bg-base-100 rounded-box w-52">
                        <li className="menu-title px-4 py-2">Hola, {userName.split(' ')[0]}</li>
                        <li><Link to="/profile"> <UserCircleIcon className="h-4 w-4" /> Mi Perfil </Link></li>
                        <div className="divider my-1"></div>
                        <li><a onClick={handleLogout} className="text-error font-bold hover:bg-error/10"><ArrowRightOnRectangleIcon className="h-4 w-4" /> Cerrar Sesión</a></li>
                    </ul>
                </div>
            </div>
        </div>
    )
}