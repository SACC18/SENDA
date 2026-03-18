import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline'

export default function AppointmentModal({ appointment, isOpen, onClose, onUpdate, onNotify }) {
  const [loading, setLoading] = useState(false)
  const [viewMode, setViewMode] = useState('details')
  const [cancelReason, setCancelReason] = useState('')

  useEffect(() => {
    const modal = document.getElementById('appointment_details_modal')
    if (isOpen && modal) {
      modal.showModal()
      setViewMode('details')
      setCancelReason('')
    } else if (modal) {
      modal.close()
    }
  }, [isOpen])

  const handleClose = () => {
    const modal = document.getElementById('appointment_details_modal')
    if (modal) modal.close()
    onClose()
  }

  if (!appointment) return null

  const handleCancelSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { error: appointError } = await supabase
        .from('appointments')
        .update({
          status: 'cancelled',
          cancellation_reason: cancelReason
        })
        .eq('id', appointment.id)

      if (appointError) throw appointError

      if (appointment.slot_id) {
        const { error: slotError } = await supabase
          .from('availability_slots')
          .update({ is_booked: false })
          .eq('id', appointment.slot_id)
        if (slotError) throw slotError
      }

      // ENVIAR NOTIFICACIÓN AL TUTOR
      if (appointment.tutor_id) {
        await supabase.from('notifications').insert({
          user_id: appointment.tutor_id,
          title: 'Cita Cancelada por Estudiante',
          message: `El estudiante ha cancelado la tutoría de "${appointment.topic}". Motivo: ${cancelReason}`
        })
      }

      onNotify('Has cancelado la cita correctamente.', 'success')
      onUpdate()
      handleClose()
    } catch (error) {
      onNotify('Error al cancelar: ' + error.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  const dateObj = new Date(appointment.slot?.start_time)
  const dateStr = !isNaN(dateObj) ? dateObj.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }) : 'Fecha desconocida'
  const timeStr = !isNaN(dateObj) ? dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'

  return (
    <dialog id="appointment_details_modal" className="modal modal-bottom sm:modal-middle" onClose={handleClose}>

      {viewMode === 'details' && (
        <div className="modal-box border-t-4 border-primary">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="font-bold text-2xl mb-1 text-primary">Detalles de tu Tutoría</h3>
              <p className="text-sm opacity-50 font-mono">ID Cita: #{appointment.id}</p>
            </div>
            <div className="badge badge-success gap-2 p-3 font-bold">
              Confirmada
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-4 bg-base-200 p-4 rounded-box border border-base-300">
              <div className="avatar">
                <div className="w-16 rounded-full bg-base-300">
                  <img
                    src={appointment.tutor?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${appointment.tutor?.full_name}`}
                    alt="Tutor"
                  />
                </div>
              </div>
              <div>
                <p className="font-bold text-lg leading-tight">{appointment.tutor?.full_name}</p>
                <div className="badge badge-primary badge-outline badge-sm mt-1">Tutor Asignado</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-center">
              <div className="bg-base-200 p-3 rounded-box border border-base-300">
                <span className="block text-[10px] font-black opacity-50 uppercase tracking-wider">Fecha</span>
                <span className="font-bold capitalize text-sm">{dateStr}</span>
              </div>
              <div className="bg-base-200 p-3 rounded-box border border-base-300">
                <span className="block text-[10px] font-black opacity-50 uppercase tracking-wider">Hora</span>
                <span className="font-bold text-primary text-lg">{timeStr}</span>
              </div>
            </div>

            <div className="bg-base-200 p-4 rounded-box border-l-4 border-warning shadow-sm">
              <span className="block text-[10px] font-black opacity-50 uppercase tracking-wider mb-1">
                Tema Solicitado
              </span>
              <p className="font-medium text-lg text-base-content leading-tight">
                {appointment.topic}
              </p>
            </div>
          </div>

          <div className="modal-action justify-between mt-8 items-center border-t border-base-200 pt-4">
            <button type="button" onClick={() => setViewMode('cancel')} className="btn btn-outline btn-error btn-sm">
              Deseo Cancelar
            </button>
            <button type="button" onClick={handleClose} className="btn btn-primary px-8">Cerrar</button>
          </div>
        </div>
      )}

      {viewMode === 'cancel' && (
        <div className="modal-box border-t-4 border-error">
          <h3 className="font-bold text-xl flex items-center gap-2 text-error mb-2">
            <ExclamationTriangleIcon className="w-6 h-6" /> Advertencia
          </h3>
          <p className="py-2 text-sm text-base-content/70 border-b border-base-200 mb-4 pb-4">
            Estás a punto de cancelar tu clase con el tutor <strong>{appointment.tutor?.full_name}</strong>. Perderás este cupo.
          </p>

          <form onSubmit={handleCancelSubmit}>
            <div className="form-control w-full mb-6">
              <label className="label">
                <span className="label-text font-bold text-error">¿Por qué deseas cancelar la clase? (Obligatorio)</span>
              </label>
              <textarea
                required
                minLength="10"
                className="textarea textarea-error textarea-bordered h-24 w-full"
                placeholder="Ej. Se me presentó una calamidad doméstica, cruce de horarios..."
                value={cancelReason}
                onChange={e => setCancelReason(e.target.value)}
              ></textarea>
              <label className="label">
                <span className="label-text-alt opacity-50">El coordinador académico registrará este motivo.</span>
              </label>
            </div>

            <div className="modal-action justify-between mt-6">
              <button type="button" className="btn btn-ghost" onClick={() => setViewMode('details')}>Volver a detalles</button>
              <button type="submit" className="btn btn-error" disabled={loading}>
                {loading ? <span className="loading loading-spinner"></span> : 'Confirmar Cancelación'}
              </button>
            </div>
          </form>
        </div>
      )}

      <form method="dialog" className="modal-backdrop">
        <button onClick={handleClose}>close</button>
      </form>
    </dialog>
  )
}