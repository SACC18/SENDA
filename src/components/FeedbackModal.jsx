import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function FeedbackModal({ userId, onNotify, onPendingChange }) {
    const [pendingAppointments, setPendingAppointments] = useState([])
    const [selectedAppointment, setSelectedAppointment] = useState(null)
    const [rating, setRating] = useState(0)
    const [techWorked, setTechWorked] = useState(true)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [view, setView] = useState('list')

    const checkPendingFeedback = async (isRealtime = false) => {
        if (!userId) return

        const { data, error } = await supabase
            .from('appointments')
            .select(`
                id, 
                topic, 
                status,
                student_id,
                feedback (id), 
                slot:availability_slots!slot_id (start_time)
            `)
            .eq('student_id', userId)
            .eq('status', 'completed')
            .order('created_at', { ascending: false })

        if (error) return

        const pending = data?.filter(app => !app.feedback || app.feedback.length === 0) || []
        setPendingAppointments(pending)

        if (pending.length > 0) {
            const modal = document.getElementById('feedback_modal')
            if (!modal) return

            const snoozed = localStorage.getItem('feedback_snoozed') === new Date().toDateString()

            if (isRealtime) {
                if (onPendingChange) onPendingChange(false)
                setSelectedAppointment(pending[0])
                setView('form')
                setRating(0)
                setTechWorked(true)
                setTimeout(() => { if (!modal.open) modal.showModal() }, 50)
            } else {
                if (snoozed) {
                    if (onPendingChange) onPendingChange(true)
                } else {
                    if (onPendingChange) onPendingChange(false)
                    setView('list')
                    setTimeout(() => { if (!modal.open) modal.showModal() }, 50)
                }
            }
        } else {
            if (onPendingChange) onPendingChange(false)
        }
    }

    useEffect(() => {
        const handleForceOpen = () => {
            setView('list')
            const modal = document.getElementById('feedback_modal')
            if (modal && !modal.open) modal.showModal()
        }
        window.addEventListener('force-open-feedback', handleForceOpen)
        return () => window.removeEventListener('force-open-feedback', handleForceOpen)
    }, [])

    useEffect(() => {
        if (!userId) return
        checkPendingFeedback(false)

        const subscription = supabase
            .channel('canal_abierto')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, (payload) => {
                if (payload.new && payload.new.student_id === userId && payload.new.status === 'completed') {
                    localStorage.removeItem('feedback_snoozed')
                    checkPendingFeedback(true)
                }
            })
            .subscribe()

        return () => { supabase.removeChannel(subscription) }
    }, [userId])

    const formatDate = (dateStr) => {
        if (!dateStr) return 'Fecha desconocida'
        return new Date(dateStr).toLocaleDateString('es-EC', { weekday: 'long', day: 'numeric', month: 'long' }) + ' a las ' + new Date(dateStr).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (isSubmitting || !selectedAppointment || rating === 0) return
        setIsSubmitting(true)

        try {
            const { error } = await supabase.from('feedback').insert({
                appointment_id: selectedAppointment.id,
                student_rating: rating,
                tech_tools_worked: techWorked
            })

            if (error) throw error

            const remaining = pendingAppointments.filter(a => a.id !== selectedAppointment.id)
            setPendingAppointments(remaining)
            setView('success')
            setTimeout(() => {
                const modal = document.getElementById('feedback_modal')
                if (modal) modal.close()

                if (remaining.length === 0) {
                    if (onPendingChange) onPendingChange(false)
                } else {
                    setView('list')
                }
            }, 3000)

        } catch (error) {
            console.error("Error al guardar feedback:", error)
            alert(`Error guardando en Supabase:\n${error.message}`)
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleSnooze = () => {
        localStorage.setItem('feedback_snoozed', new Date().toDateString())
        if (onPendingChange) onPendingChange(true)
        if (onNotify) onNotify('Recordatorio pospuesto. Podrás hacerlo luego desde la campana.', 'info')
        document.getElementById('feedback_modal').close()
    }

    return (
        <dialog id="feedback_modal" className="modal modal-bottom sm:modal-middle backdrop-blur-sm">
            <div className={`modal-box border-t-4 relative shadow-2xl transition-all duration-500 overflow-hidden ${view === 'success' ? 'border-warning bg-base-100 text-center' : 'border-secondary'}`}>
                {view !== 'success' && (
                    <form method="dialog">
                        <button className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2 text-base-content/50 hover:text-base-content z-50">✕</button>
                    </form>
                )}
                {view === 'list' && (
                    <div className="animate-fade-in">
                        <div className="flex justify-center mb-4">
                            <div className="bg-secondary/20 p-3 rounded-full animate-bounce text-3xl">⭐</div>
                        </div>
                        <h3 className="font-bold text-2xl mb-2 text-center text-primary">Tutorías por calificar</h3>
                        <p className="text-center opacity-60 text-sm mb-6">
                            Tienes {pendingAppointments.length} calificación{pendingAppointments.length !== 1 ? 'es' : ''} pendiente{pendingAppointments.length !== 1 ? 's' : ''}
                        </p>
                        <div className="flex flex-col gap-3 max-h-60 overflow-y-auto pr-2">
                            {pendingAppointments.map((app) => (
                                <button key={app.id} onClick={() => { setSelectedAppointment(app); setRating(0); setTechWorked(true); setView('form'); }} className="btn btn-outline btn-primary text-left flex flex-col items-start h-auto py-4 px-5">
                                    <span className="font-bold text-base">{app.topic}</span>
                                    <span className="text-xs opacity-60 font-normal mt-1">📅 {formatDate(app.slot?.start_time)}</span>
                                </button>
                            ))}
                        </div>

                        {pendingAppointments.length > 0 && (
                            <button className="btn btn-ghost w-full mt-4 bg-base-200" onClick={handleSnooze}>
                                Responder en otro momento
                            </button>
                        )}
                    </div>
                )}

                {view === 'form' && selectedAppointment && (
                    <div className="animate-fade-in">
                        {pendingAppointments.length > 1 && (
                            <button onClick={() => setView('list')} className="btn btn-ghost btn-sm mb-4 -ml-2">← Volver</button>
                        )}
                        <h3 className="font-bold text-2xl mb-2 text-center text-primary">¡Califica tu tutoría!</h3>
                        <p className="py-2 text-center opacity-75">
                            <span className="font-bold text-secondary text-lg">{selectedAppointment.topic}</span>
                        </p>

                        <form onSubmit={handleSubmit} className="mt-4 space-y-6">
                            <div className="form-control items-center bg-base-200 p-4 rounded-box">
                                <label className="label cursor-pointer pb-4">
                                    <span className="label-text font-bold text-lg text-base-content">¿Cómo calificarías esta sesión?</span>
                                </label>

                                <div className="rating rating-lg rating-half">
                                    <input type="radio" name="rating-10" className="rating-hidden" checked={rating === 0} onChange={() => setRating(0)} />
                                    {[...Array(10)].map((_, i) => {
                                        const step = (i + 1) * 0.5;
                                        const isHalf = (i + 1) % 2 !== 0;
                                        return (
                                            <input
                                                key={step}
                                                type="radio"
                                                name="rating-10"
                                                className={`mask mask-star-2 ${isHalf ? 'mask-half-1' : 'mask-half-2'} bg-warning transition-transform hover:scale-125`}
                                                checked={rating === step}
                                                onChange={() => setRating(step)}
                                            />
                                        )
                                    })}
                                </div>
                                <div className="text-xs font-bold text-warning mt-3 bg-warning/10 px-3 py-1 rounded-full">{rating > 0 ? `${rating} / 5 Estrellas` : 'Selecciona una calificación'}</div>
                            </div>

                            <div className="form-control bg-base-200 p-4 rounded-box flex-row justify-between items-center gap-4">
                                <span className="label-text font-semibold text-base-content">¿Te funcionaron bien las herramientas digitales hoy?</span>
                                <input type="checkbox" className="toggle toggle-success toggle-lg" checked={techWorked} onChange={(e) => setTechWorked(e.target.checked)} />
                            </div>

                            <div className="modal-action mt-6 flex flex-col gap-3">
                                <button type="submit" className="btn btn-primary w-full h-12 text-lg shadow-[0_0_15px_rgba(var(--p),0.4)] border-none" disabled={isSubmitting || rating === 0}>
                                    {isSubmitting ? <span className="loading loading-spinner"></span> : 'Enviar Opinión'}
                                </button>

                                <button type="button" className="btn btn-ghost w-full bg-base-200" onClick={handleSnooze}>
                                    Responder en otro momento
                                </button>
                            </div>
                        </form>
                    </div>
                )}
                {view === 'success' && (
                    <div className="flex flex-col items-center justify-center py-10 animate-[fade-in_0.5s_ease-out]">
                        <div className="relative mb-6">
                            <div className="absolute inset-0 bg-warning/30 blur-[40px] rounded-full animate-pulse scale-150"></div>
                            <div className="text-8xl animate-bounce relative z-10 drop-shadow-2xl">🌟</div>
                        </div>
                        <h3 className="font-black text-3xl text-primary mb-2">¡Excelente trabajo!</h3>
                        <p className="text-base font-medium opacity-80 max-w-xs mx-auto">Tu opinión ayuda a construir un mejor futuro para todos en SENDA.</p>
                        <div className="badge badge-secondary badge-lg mt-8 py-5 px-6 font-black text-xl shadow-[0_0_20px_rgba(var(--s),0.6)] animate-pulse border-none">
                            +10 XP Ganados
                        </div>
                        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-transparent via-warning to-transparent opacity-50"></div>
                        <div className="absolute bottom-0 left-0 w-full h-2 bg-gradient-to-r from-transparent via-warning to-transparent opacity-50"></div>
                    </div>
                )}

            </div>
            {view !== 'success' && (
                <form method="dialog" className="modal-backdrop bg-base-300/60"><button>close</button></form>
            )}
        </dialog>
    )
}