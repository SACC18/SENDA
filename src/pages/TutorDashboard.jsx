import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import AcademicManager from '../components/AcademicManager'
import {
    CheckCircleIcon, XCircleIcon, ClockIcon,
    BookOpenIcon, UserIcon, CalendarDaysIcon, PlusCircleIcon, CalendarIcon, ExclamationTriangleIcon
} from '@heroicons/react/24/outline'

export default function TutorDashboard({ userId, onNotify }) {
    const [appointments, setAppointments] = useState([])
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState('agenda')

    const [newSlotDate, setNewSlotDate] = useState('')
    const [isPublishing, setIsPublishing] = useState(false)

    // Estados para Modales
    const [selectedAppt, setSelectedAppt] = useState(null)
    const [finishForm, setFinishForm] = useState({ feedback: '', duration: '' })
    const [cancelForm, setCancelForm] = useState({ reason: '' })
    const [isSaving, setIsSaving] = useState(false)

    useEffect(() => {
        if (!userId) return
        fetchAppointments()
        const subscription = supabase
            .channel('tutor_appointments_channel')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'appointments',
                filter: `tutor_id=eq.${userId}`
            }, () => {
                fetchAppointments()
            })
            .subscribe()
        return () => { supabase.removeChannel(subscription) }
    }, [userId])

    const fetchAppointments = async () => {
        setLoading(true)
        try {
            const { data, error } = await supabase
                .from('appointments')
                .select(`
                    id, status, topic, topic_id, created_at, tutor_feedback, duration_minutes, cancellation_reason, slot_id,
                    slot:availability_slots!slot_id(start_time, end_time),
                    student:profiles!student_id(id, full_name, nee),
                    subject:subjects!subject_id(name)
                `)
                .eq('tutor_id', userId)
                .order('created_at', { ascending: false })

            if (error) throw error
            const sortedData = data ? data.sort((a, b) => {
                const dateA = a.slot?.start_time ? new Date(a.slot.start_time) : new Date(a.created_at)
                const dateB = b.slot?.start_time ? new Date(b.slot.start_time) : new Date(b.created_at)
                return dateA - dateB
            }) : []

            setAppointments(sortedData)
        } catch (error) {
            onNotify('Error al cargar tus tutorías', 'error')
        } finally {
            setLoading(false)
        }
    }

    const handleAddSlot = async (e) => {
        e.preventDefault();
        if (!newSlotDate) return onNotify("Por favor selecciona una fecha", "error");
        setIsPublishing(true);
        try {
            const startDate = new Date(newSlotDate);
            const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);

            const { error } = await supabase.from('availability_slots').insert({
                tutor_id: userId, start_time: startDate.toISOString(), end_time: endDate.toISOString(), is_booked: false
            });

            if (error) throw error;
            onNotify("Horario publicado correctamente", "success");
            setNewSlotDate('');
        } catch (error) {
            onNotify("Error al publicar horario", "error")
        } finally {
            setIsPublishing(false)
        }
    }

    const openFinishModal = (appt) => {
        setSelectedAppt(appt)
        setFinishForm({ feedback: '', duration: '' })
        document.getElementById('finish_modal').showModal()
    }

    const openCancelModal = (appt) => {
        setSelectedAppt(appt)
        setCancelForm({ reason: '' })
        document.getElementById('cancel_modal').showModal()
    }

    const closeAllModals = () => {
        document.getElementById('finish_modal')?.close()
        document.getElementById('cancel_modal')?.close()
        setSelectedAppt(null)
    }

    const handleFinishClass = async (e) => {
        e.preventDefault()
        setIsSaving(true)
        try {
            const { error } = await supabase.from('appointments').update({
                status: 'completed', tutor_feedback: finishForm.feedback, duration_minutes: parseInt(finishForm.duration)
            }).eq('id', selectedAppt.id)

            if (error) throw error

            if (selectedAppt.topic_id) {
                const { data: topicInfo } = await supabase.from('topics').select('subject_id').eq('id', selectedAppt.topic_id).single()
                await supabase.from('student_progress').insert({
                    student_id: selectedAppt.student.id, topic_id: selectedAppt.topic_id, subject_id: topicInfo?.subject_id
                })
            }

            onNotify('Tutoría finalizada exitosamente', 'success')
            closeAllModals()
            fetchAppointments()
        } catch (error) {
            if (error.code !== '23505') onNotify('Error al guardar', 'error')
        } finally { setIsSaving(false) }
    }

    const handleCancelClass = async (e) => {
        e.preventDefault()
        setIsSaving(true)
        try {
            const { error } = await supabase.from('appointments').update({
                status: 'cancelled', cancellation_reason: cancelForm.reason
            }).eq('id', selectedAppt.id)

            if (error) throw error

            if (selectedAppt.slot_id) {
                await supabase.from('availability_slots').update({ is_booked: false }).eq('id', selectedAppt.slot_id)
            }

            const targetStudentId = selectedAppt.student?.id;

            if (targetStudentId) {
                const { error: notifError } = await supabase.from('notifications').insert({
                    user_id: targetStudentId,
                    title: 'Tutoría Cancelada',
                    message: `Tu tutor ha cancelado la clase de "${selectedAppt.topic}". Motivo: ${cancelForm.reason}`
                })

                if (notifError) console.error("Fallo al enviar notificación:", notifError)
            }

            onNotify('Cita cancelada correctamente', 'success')
            closeAllModals()
            fetchAppointments()
        } catch (error) {
            onNotify('Error al cancelar: ' + error.message, 'error')
        } finally { setIsSaving(false) }
    }

    const formatTimeOnly = (dateString) => {
        if (!dateString) return '--:--'
        return new Date(dateString).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })
    }

    const formatDateFull = (dateString) => {
        if (!dateString) return 'Fecha desconocida'
        return new Date(dateString).toLocaleDateString('es-EC', { weekday: 'long', day: 'numeric', month: 'short' })
    }

    const pendingAppts = appointments.filter(a => a.status === 'scheduled')
    const historyAppts = appointments.filter(a => a.status === 'completed' || a.status === 'cancelled')

    if (loading) return <div className="flex justify-center py-20"><span className="loading loading-bars text-primary"></span></div>

    return (
        <div className="flex flex-col gap-6 animate-fade-in">

            <div className="tabs tabs-boxed bg-base-100 p-2 w-fit shadow-sm border border-base-200">
                <button className={`tab gap-2 transition-all ${activeTab === 'agenda' ? 'tab-active font-bold bg-primary text-primary-content' : ''}`} onClick={() => setActiveTab('agenda')}><CalendarIcon className="w-4 h-4" /> Próximas Clases <span className="badge badge-sm">{pendingAppts.length}</span></button>
                <button className={`tab gap-2 transition-all ${activeTab === 'history' ? 'tab-active font-bold bg-base-300' : ''}`} onClick={() => setActiveTab('history')}><ClockIcon className="w-4 h-4" /> Historial</button>
                <button className={`tab gap-2 transition-all ${activeTab === 'academic' ? 'tab-active font-bold bg-base-300' : ''}`} onClick={() => setActiveTab('academic')}><BookOpenIcon className="w-4 h-4" /> Mis Materias (PEA)</button>
            </div>

            {activeTab === 'academic' && <AcademicManager userId={userId} onNotify={onNotify} />}

            {(activeTab === 'agenda' || activeTab === 'history') && (
                <div className="flex flex-col lg:flex-row gap-8">
                    <div className="w-full lg:w-1/3">
                        <div className="card bg-base-100 shadow-xl border border-base-200 sticky top-24">
                            <div className="card-body">
                                <h2 className="card-title text-primary font-bold flex items-center gap-2"><PlusCircleIcon className="w-6 h-6" /> Publicar Horario</h2>
                                <p className="text-sm opacity-70">Abre un cupo en tu agenda para que los alumnos lo reserven.</p>
                                <form onSubmit={handleAddSlot} className="flex flex-col gap-4 mt-4">
                                    <input type="datetime-local" className="input input-bordered w-full bg-base-200 focus:bg-base-100 transition-colors" value={newSlotDate} onChange={(e) => setNewSlotDate(e.target.value)} required />
                                    <button type="submit" className="btn btn-primary shadow-lg" disabled={isPublishing}>
                                        {isPublishing ? <span className="loading loading-spinner"></span> : 'Agregar Cupo'}
                                    </button>
                                </form>
                            </div>
                        </div>
                    </div>
                    <div className="w-full lg:w-2/3 bg-base-100 rounded-3xl shadow-xl border border-base-200 p-6 lg:p-10 min-h-[500px]">
                        <h2 className="text-2xl font-bold mb-6">{activeTab === 'agenda' ? 'Agenda de Clases' : 'Historial de Tutorías'}</h2>

                        {activeTab === 'agenda' ? (
                            pendingAppts.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-64 text-center opacity-40">
                                    <CalendarIcon className="h-16 w-16 text-primary/50 mb-4" />
                                    <p>No tienes clases programadas aún.</p>
                                </div>
                            ) : (
                                <ul className="timeline timeline-vertical timeline-compact lg:timeline-horizontal lg:overflow-x-auto pb-6">
                                    {pendingAppts.map((app, index) => {
                                        const date = app.slot?.start_time || app.created_at;
                                        return (
                                            <li key={app.id}>
                                                <hr className={index > 0 ? "bg-primary" : ""} />
                                                <div className="timeline-start text-[10px] font-mono opacity-50 mb-2 uppercase tracking-wider">{formatDateFull(date)}</div>
                                                <div className="timeline-middle"><div className="w-4 h-4 rounded-full bg-primary ring-4 ring-primary/20"></div></div>
                                                <div className="timeline-end timeline-box bg-base-200 border-none shadow-sm mb-4 p-4 hover:scale-105 transition-transform w-64">

                                                    <div className="text-lg font-black text-primary">{formatTimeOnly(date)}</div>
                                                    <div className="font-bold truncate mt-1 flex items-center gap-1" title={app.student?.full_name}>
                                                        <UserIcon className="w-4 h-4 opacity-50" /> {app.student?.full_name}
                                                    </div>

                                                    <div className="mt-2 mb-3">
                                                        <span className="badge badge-secondary badge-outline text-xs font-bold whitespace-normal h-auto py-2 text-left leading-tight block">
                                                            {app.topic}
                                                        </span>
                                                        <div className="text-[10px] opacity-50 font-semibold uppercase tracking-wider mt-2">{app.subject?.name || 'General'}</div>
                                                    </div>

                                                    <div className="flex gap-2 justify-end mt-4 pt-3 border-t border-base-300">
                                                        {/* btn-primary tomará el color principal del tema (Amarillo en alto contraste) */}
                                                        <button onClick={() => openFinishModal(app)} className="btn btn-xs btn-primary shadow-sm" title="Finalizar Clase">
                                                            <CheckCircleIcon className="w-4 h-4" /> Terminar
                                                        </button>
                                                        {/* btn-outline genérico usará el color de texto del tema (se adapta a fondos oscuros/claros) */}
                                                        <button onClick={() => openCancelModal(app)} className="btn btn-xs btn-outline hover:bg-base-300" title="Cancelar">
                                                            <XCircleIcon className="w-4 h-4" /> Cancelar
                                                        </button>
                                                    </div>

                                                </div>
                                                <hr className="bg-primary" />
                                            </li>
                                        )
                                    })}
                                </ul>
                            )
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="table table-zebra w-full whitespace-nowrap">
                                    <thead>
                                        <tr className="bg-base-200 text-base-content/70">
                                            <th>Fecha y Hora</th>
                                            <th>Estudiante</th>
                                            <th>Materia y Tema</th>
                                            <th>Estado / Detalles</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {historyAppts.length === 0 ? (
                                            <tr><td colSpan="4" className="text-center py-10 opacity-50 italic">Tu historial está vacío.</td></tr>
                                        ) : historyAppts.map(appt => {
                                            const date = appt.slot?.start_time || appt.created_at;
                                            return (
                                                <tr key={appt.id}>
                                                    <td className="font-mono text-sm opacity-80">
                                                        <div className="flex items-center gap-2"><CalendarDaysIcon className="w-4 h-4 text-primary" /> {formatDateFull(date)}<br />{formatTimeOnly(date)}</div>
                                                    </td>
                                                    <td>
                                                        <div className="font-bold flex items-center gap-2"><UserIcon className="w-4 h-4 opacity-50" /> {appt.student?.full_name}</div>
                                                        {appt.student?.nee && <span className="badge badge-xs badge-secondary mt-1">NEE</span>}
                                                    </td>
                                                    <td>
                                                        <div className="font-semibold text-primary">{appt.subject?.name || 'General'}</div>
                                                        <div className="text-xs opacity-60 truncate max-w-[200px]" title={appt.topic}>{appt.topic}</div>
                                                    </td>
                                                    <td>
                                                        {appt.status === 'completed' && (
                                                            <div className="flex flex-col gap-1 items-start">
                                                                {/* Cambiado a badge-primary para mantener el contraste */}
                                                                <span className="badge badge-primary badge-sm gap-1"><CheckCircleIcon className="w-3 h-3" /> Completada</span>
                                                                <span className="text-[10px] opacity-50 italic truncate max-w-[150px]" title={appt.tutor_feedback}>"{appt.tutor_feedback}"</span>
                                                            </div>
                                                        )}
                                                        {appt.status === 'cancelled' && (
                                                            <div className="flex flex-col gap-1 items-start">
                                                                <span className="badge badge-outline badge-error badge-sm gap-1"><XCircleIcon className="w-3 h-3" /> Cancelada</span>
                                                                <span className="text-[10px] text-error italic truncate max-w-[150px]" title={appt.cancellation_reason}>Motivo: {appt.cancellation_reason}</span>
                                                            </div>
                                                        )}
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <dialog id="finish_modal" className="modal modal-bottom sm:modal-middle">
                <div className="modal-box border-t-4 border-primary">
                    <h3 className="font-bold text-xl flex items-center gap-2 text-primary mb-4">
                        <CheckCircleIcon className="w-6 h-6" /> Finalizar Tutoría
                    </h3>
                    <p className="py-2 text-sm opacity-70 mb-2 border-b border-base-200 pb-4">
                        Estudiante: <strong>{selectedAppt?.student?.full_name}</strong><br />
                        Tema: {selectedAppt?.topic}
                    </p>

                    <form onSubmit={handleFinishClass}>
                        <div className="form-control w-full mb-4">
                            <label className="label"><span className="label-text font-bold">Duración real de la clase (Minutos)</span></label>
                            <input type="number" required min="1" max="300" placeholder="Ej. 45" className="input input-bordered w-full" value={finishForm.duration} onChange={e => setFinishForm({ ...finishForm, duration: e.target.value })} />
                        </div>
                        <div className="form-control w-full mb-6">
                            <label className="label"><span className="label-text font-bold">Observaciones del Tutor (Feedback)</span></label>
                            <textarea required className="textarea textarea-bordered h-24 w-full" placeholder="¿Cómo le fue al estudiante? ¿Qué se debe reforzar?" value={finishForm.feedback} onChange={e => setFinishForm({ ...finishForm, feedback: e.target.value })}></textarea>
                        </div>
                        <div className="modal-action">
                            <button type="button" className="btn btn-ghost" onClick={closeAllModals}>Cerrar</button>
                            <button type="submit" className="btn btn-primary" disabled={isSaving}>{isSaving ? <span className="loading loading-spinner"></span> : 'Guardar y Finalizar'}</button>
                        </div>
                    </form>
                </div>
                <form method="dialog" className="modal-backdrop"><button onClick={closeAllModals}>close</button></form>
            </dialog>
            <dialog id="cancel_modal" className="modal modal-bottom sm:modal-middle">
                {/* Para cancelar sí podemos usar error, pero con outline para que el texto contraste bien */}
                <div className="modal-box border-t-4 border-error">
                    <h3 className="font-bold text-xl flex items-center gap-2 text-error mb-4">
                        <ExclamationTriangleIcon className="w-6 h-6" /> Cancelar Tutoría
                    </h3>
                    <p className="py-2 text-sm text-base-content/70 mb-2 border-b border-base-200 pb-4">
                        Estás a punto de cancelar la clase con <strong>{selectedAppt?.student?.full_name}</strong>. Esta acción es irreversible.
                    </p>

                    <form onSubmit={handleCancelClass}>
                        <div className="form-control w-full mb-6">
                            <label className="label"><span className="label-text font-bold text-error">Motivo de la cancelación (Obligatorio)</span></label>
                            <textarea required minLength="10" className="textarea textarea-error textarea-bordered h-24 w-full" placeholder="Ej. Calamidad doméstica, Problemas de conexión..." value={cancelForm.reason} onChange={e => setCancelForm({ ...cancelForm, reason: e.target.value })}></textarea>
                            <label className="label"><span className="label-text-alt opacity-50">El coordinador y el estudiante podrán ver este motivo.</span></label>
                        </div>
                        <div className="modal-action">
                            <button type="button" className="btn btn-ghost" onClick={closeAllModals}>Volver atrás</button>
                            <button type="submit" className="btn btn-error" disabled={isSaving}>{isSaving ? <span className="loading loading-spinner"></span> : 'Confirmar Cancelación'}</button>
                        </div>
                    </form>
                </div>
                <form method="dialog" className="modal-backdrop"><button onClick={closeAllModals}>close</button></form>
            </dialog>
        </div>
    )
}