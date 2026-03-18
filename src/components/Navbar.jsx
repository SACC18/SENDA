import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Link, useNavigate } from 'react-router-dom'
import {
    EyeIcon, ArrowRightOnRectangleIcon, UserCircleIcon,
    AdjustmentsHorizontalIcon, BellIcon, BellAlertIcon
} from '@heroicons/react/24/outline'
import FeedbackModal from './FeedbackModal'

export default function Navbar() {
    const navigate = useNavigate()
    const [theme, setTheme] = useState(localStorage.getItem('senda-theme') || 'nord')
    const [textSize, setTextSize] = useState(localStorage.getItem('senda-text-size') || 100)

    const words = ["Tu Futuro", "Tu Progreso", "Tu Camino"]
    const [currentWordIndex, setCurrentWordIndex] = useState(0)
    const [displayText, setDisplayText] = useState("")
    const [isDeleting, setIsDeleting] = useState(false)

    const [userName, setUserName] = useState('Usuario')
    const [userAvatar, setUserAvatar] = useState(localStorage.getItem('senda-avatar') || null)
    const [userRole, setUserRole] = useState(null)
    const [userId, setUserId] = useState(null)

    // ESTADOS DE NOTIFICACIONES
    const [pendingFeedback, setPendingFeedback] = useState(false)
    const [notifications, setNotifications] = useState([])

    useEffect(() => {
        const getUser = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
                setUserId(user.id)
                const { data } = await supabase.from('profiles').select('full_name, avatar_url, role').eq('id', user.id).single()

                if (data) {
                    setUserName(data.full_name)
                    setUserRole(data.role)

                    if (data.avatar_url) {
                        setUserAvatar(data.avatar_url)
                        localStorage.setItem('senda-avatar', data.avatar_url)
                    }

                    if (data.role === 'student') {
                        const { data: apps } = await supabase.from('appointments').select('id, feedback(id)').eq('student_id', user.id).eq('status', 'completed')
                        if (apps) setPendingFeedback(apps.some(app => !app.feedback || app.feedback.length === 0))
                    }
                }
            }
        }
        getUser()
    }, [])

    useEffect(() => {
        if (!userId) return

        const fetchNotifs = async () => {
            const { data } = await supabase
                .from('notifications')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(10)
            if (data) setNotifications(data)
        }
        fetchNotifs()

        const notifSub = supabase.channel('notifs_channel')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, (payload) => {
                setNotifications(prev => [payload.new, ...prev])
            })
            .subscribe()

        return () => { supabase.removeChannel(notifSub) }
    }, [userId])

    // Marcar como leída
    const markAsRead = async (id) => {
        await supabase.from('notifications').update({ is_read: true }).eq('id', id)
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
    }

    const unreadCount = notifications.filter(n => !n.is_read).length
    const hasAlerts = pendingFeedback || unreadCount > 0

    const timeAgo = (dateStr) => {
        const diffMs = new Date() - new Date(dateStr)
        const diffMins = Math.round(diffMs / 60000)
        if (diffMins < 60) return `Hace ${diffMins} min`
        const diffHrs = Math.floor(diffMins / 60)
        if (diffHrs < 24) return `Hace ${diffHrs} h`
        return `Hace ${Math.floor(diffHrs / 24)} d`
    }

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
        const root = document.documentElement;
        if (root) {
            root.style.fontSize = `${textSize}%`;
            localStorage.setItem('senda-text-size', textSize);
        }
    }, [textSize]);

    const handleLogout = async () => {
        await supabase.auth.signOut()
        const savedTheme = localStorage.getItem('senda-theme')
        const savedTextSize = localStorage.getItem('senda-text-size')
        const snoozed = localStorage.getItem('feedback_snoozed')
        localStorage.clear()
        sessionStorage.clear()
        if (savedTheme) localStorage.setItem('senda-theme', savedTheme)
        if (savedTextSize) localStorage.setItem('senda-text-size', savedTextSize)
        if (snoozed) localStorage.setItem('feedback_snoozed', snoozed)
        navigate('/')
    }

    const openFeedbackModal = () => {
        localStorage.removeItem('feedback_snoozed')
        window.dispatchEvent(new Event('force-open-feedback'))
    }

    const handleNotify = (message, type) => { console.log(type + ': ' + message) }
    const finalAvatar = userAvatar || `https://api.dicebear.com/7.x/notionists/svg?seed=${userName}&backgroundColor=e5e7eb`

    return (
        <div className="navbar bg-base-100/80 backdrop-blur-md sticky top-0 z-50 border-b border-base-200 shadow-sm transition-all duration-300 px-4 md:px-8">
            <div className="navbar-start gap-2 items-center flex w-full md:w-auto justify-between md:justify-start">
                <Link to="/dashboard" className="btn btn-ghost px-1 hover:bg-transparent normal-case text-xl flex items-center gap-2 group">
                    <img src="/img/logo.png" alt="Senda" className="h-10 w-10 object-contain transition-transform group-hover:scale-110" onError={(e) => { e.target.style.display = 'none' }} />
                    <span className="font-black text-2xl text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">SENDA</span>
                </Link>
                <div className="hidden md:flex items-center gap-2 ml-4">
                    <span className="text-sm font-light opacity-50 mb-1">es</span>
                    <span className="badge badge-lg badge-outline font-mono font-bold text-primary min-w-[140px] justify-start border-primary/50">
                        {displayText}<span className="animate-pulse">|</span>
                    </span>
                </div>
            </div>

            <div className="navbar-end gap-1 md:gap-4 hidden md:flex w-full">
                <div className="dropdown dropdown-end">
                    <div className="tooltip tooltip-bottom font-bold" data-tip={hasAlerts ? "Nuevas notificaciones" : "Sin notificaciones"}>
                        <label tabIndex={0} className="btn btn-ghost btn-circle text-base-content hover:bg-base-200 transition-colors">
                            <div className="indicator">
                                {hasAlerts ? (
                                    <>
                                        <BellAlertIcon className="h-6 w-6 text-primary animate-[wiggle_1s_ease-in-out_infinite]" />
                                        <span className="badge badge-xs badge-error indicator-item animate-pulse border-none shadow-[0_0_8px_rgba(255,0,0,0.8)]"></span>
                                    </>
                                ) : (
                                    <BellIcon className="h-6 w-6 opacity-50" />
                                )}
                            </div>
                        </label>
                    </div>

                    <div tabIndex={0} className="menu dropdown-content mt-3 z-[1] p-0 shadow-2xl bg-base-100 rounded-box w-80 lg:w-96 border border-base-200 overflow-hidden">
                        <div className="p-4 border-b border-base-200 bg-base-200/50 flex justify-between items-center">
                            <h3 className="font-bold text-lg text-base-content">Notificaciones</h3>
                            {unreadCount > 0 && <span className="badge badge-sm badge-primary">{unreadCount} nuevas</span>}
                        </div>

                        <ul className="max-h-[60vh] overflow-y-auto p-2 flex flex-col gap-1">
                            {userRole === 'student' && pendingFeedback && (
                                <li className="bg-warning/20 rounded-lg">
                                    <a onClick={openFeedbackModal} className="flex flex-col items-start gap-1 p-4 hover:bg-warning/30 transition-colors">
                                        <span className="font-black text-warning-content flex items-center gap-2">⭐ Calificación Pendiente</span>
                                        <span className="text-xs text-warning-content/80">Tienes una tutoría completada. ¡Califícala para ganar XP!</span>
                                    </a>
                                </li>
                            )}

                            {notifications.length === 0 && !pendingFeedback ? (
                                <div className="p-8 text-center opacity-40 flex flex-col items-center gap-2">
                                    <BellIcon className="h-10 w-10" />
                                    <span className="text-sm font-medium">Bandeja vacía</span>
                                </div>
                            ) : (
                                notifications.map(notif => (
                                    <li key={notif.id} className={`${notif.is_read ? 'opacity-60' : 'bg-base-200'} rounded-lg overflow-hidden`}>
                                        <a onClick={() => markAsRead(notif.id)} className="flex flex-col items-start gap-1 p-3">
                                            <div className="flex justify-between w-full items-center">
                                                <span className={`font-bold text-sm ${!notif.is_read ? 'text-primary' : ''}`}>{notif.title}</span>
                                                {!notif.is_read && <span className="w-2 h-2 rounded-full bg-primary shadow-sm"></span>}
                                            </div>
                                            <span className="text-xs whitespace-normal leading-relaxed text-base-content/80">{notif.message}</span>
                                            <span className="text-[10px] opacity-40 font-mono mt-1">{timeAgo(notif.created_at)}</span>
                                        </a>
                                    </li>
                                ))
                            )}
                        </ul>
                    </div>
                </div>

                <div className="dropdown dropdown-end">
                    <div className="tooltip tooltip-bottom font-bold" data-tip="Ajustes Visuales">
                        <label tabIndex={0} className="btn btn-ghost btn-circle text-base-content hover:bg-base-200 transition-colors">
                            <EyeIcon className="h-6 w-6 opacity-70" />
                        </label>
                    </div>
                    <div tabIndex={0} className="menu dropdown-content mt-3 z-[1] p-5 shadow-2xl bg-base-100 rounded-box w-80 border border-base-200">
                        <h3 className="font-bold text-lg mb-4 text-primary border-b border-base-200 pb-2 flex items-center gap-2"><AdjustmentsHorizontalIcon className="h-5 w-5" /> Accesibilidad</h3>
                        <div className="form-control mb-6">
                            <label className="label"><span className="label-text font-semibold text-base-content">Tema de Contraste</span></label>
                            <div className="join w-full grid grid-cols-3 gap-1">
                                <input type="radio" className="join-item btn btn-sm bg-base-200 text-base-content border-base-300 hover:bg-base-300" aria-label="Suave" onChange={() => setTheme('nord')} checked={theme === 'nord'} />
                                <input type="radio" className="join-item btn btn-sm bg-gray-800 text-white hover:bg-gray-900 border-none" aria-label="Oscuro" onChange={() => setTheme('dim')} checked={theme === 'dim'} />
                                <input type="radio" className="join-item btn btn-sm bg-yellow-400 text-black hover:bg-yellow-500 border-none font-bold" aria-label="Alto" onChange={() => setTheme('bumblebee')} checked={theme === 'bumblebee'} />
                            </div>
                        </div>
                        <div className="form-control">
                            <label className="label"><span className="label-text font-semibold text-base-content">Tamaño del Texto</span><span className="badge badge-sm badge-primary">{textSize}%</span></label>
                            <input type="range" min="90" max="120" value={textSize} onChange={(e) => setTextSize(e.target.value)} className="range range-xs range-primary" step="5" />
                        </div>
                    </div>
                </div>

                <div className="dropdown dropdown-end ml-2">
                    <label tabIndex={0} className="btn btn-ghost btn-circle avatar cursor-pointer hover:scale-105 transition-transform">
                        <div className="w-10 rounded-full ring-2 ring-primary ring-offset-base-100 ring-offset-2">
                            <img src={finalAvatar} alt="Avatar de usuario" />
                        </div>
                    </label>
                    <ul tabIndex={0} className="mt-4 z-[1] p-2 shadow-2xl menu menu-sm dropdown-content bg-base-100 rounded-box w-56 border border-base-200">
                        <li className="menu-title px-4 py-3 border-b border-base-200 mb-2">
                            <span className="font-bold text-base-content text-sm block">Hola, {userName.split(' ')[0]}</span>
                            <span className="text-[10px] uppercase tracking-widest opacity-50 mt-1 block">{userRole === 'student' ? 'Estudiante' : userRole === 'tutor' ? 'Tutor' : 'Coordinador'}</span>
                        </li>
                        <li><Link to="/profile" className="py-3 font-medium"> <UserCircleIcon className="h-5 w-5 opacity-70" /> Mi Perfil </Link></li>
                        <li><a onClick={handleLogout} className="text-error font-bold hover:bg-error hover:text-white py-3 mt-1"><ArrowRightOnRectangleIcon className="h-5 w-5" /> Cerrar Sesión</a></li>
                    </ul>
                </div>
            </div>

            <FeedbackModal userId={userId} onNotify={handleNotify} onPendingChange={setPendingFeedback} />
            <style>{`@keyframes wiggle { 0%, 100% { transform: rotate(-10deg); } 50% { transform: rotate(10deg); } }`}</style>
        </div>
    )
}