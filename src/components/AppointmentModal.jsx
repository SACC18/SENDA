import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function AppointmentModal({ appointment, isOpen, onClose, onUpdate, onNotify }) {
  const [loading, setLoading] = useState(false)
  const [isConfirming, setIsConfirming] = useState(false) // Estado para confirmación en botón

  // Reseteamos el estado de confirmación cada vez que se abre el modal
  useEffect(() => {
    if (isOpen) setIsConfirming(false)
  }, [isOpen])

  if (!isOpen || !appointment) return null

  const handleCancel = async () => {
    // YA NO HAY ALERT NATIVO (window.confirm)
    setLoading(true)
    try {
      // 1. Cancelar cita
      const { error: appointError } = await supabase
        .from('appointments')
        .update({ status: 'cancelled' })
        .eq('id', appointment.id)

      if (appointError) throw appointError

      // 2. Liberar horario
      const { error: slotError } = await supabase
        .from('availability_slots')
        .update({ is_booked: false })
        .eq('id', appointment.slot_id)

      if (slotError) throw slotError

      // 3. Notificar y Actualizar
      onNotify('Cita cancelada exitosamente.', 'success')
      onUpdate() 
      onClose()

    } catch (error) {
      onNotify('Error al cancelar: ' + error.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  // Lógica fechas
  const dateObj = new Date(appointment.slot.start_time)
  const dateStr = dateObj.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
  const timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="modal-box bg-base-100 shadow-2xl border-t-8 border-success">
        
        <div className="flex justify-between items-start mb-4">
            <div>
                <h3 className="font-bold text-2xl mb-1">Detalles de tu Tutoría</h3>
                <p className="text-sm opacity-50">ID Cita: #{appointment.id}</p>
            </div>
            <div className="badge badge-success gap-2 p-3">
                Confirmada
            </div>
        </div>

        <div className="space-y-4">
          {/* TARJETA TUTOR */}
          <div className="flex items-center gap-4 bg-base-200 p-4 rounded-lg">
            <div className="avatar placeholder">
              <div className="bg-neutral text-neutral-content rounded-full w-12 shadow-md">
                <span className="text-xl font-bold">{appointment.tutor.full_name[0]}</span>
              </div>
            </div>
            <div>
              <p className="font-bold text-lg leading-tight">{appointment.tutor.full_name}</p>
              <div className="badge badge-primary badge-outline badge-sm mt-1">Tutor Certificado</div>
            </div>
          </div>

          {/* TARJETA FECHA Y HORA */}
          <div className="grid grid-cols-2 gap-4 text-center">
            <div className="bg-base-200 p-3 rounded-lg border border-base-300">
              <span className="block text-[10px] font-black opacity-50 uppercase tracking-wider">Fecha</span>
              <span className="font-bold capitalize text-sm">{dateStr}</span>
            </div>
            <div className="bg-base-200 p-3 rounded-lg border border-base-300">
              <span className="block text-[10px] font-black opacity-50 uppercase tracking-wider">Hora</span>
              <span className="font-bold text-success text-sm">{timeStr}</span>
            </div>
          </div>

          {/* TARJETA TEMA (CORREGIDO PARA ALTO CONTRASTE) */}
          {/* Usamos bg-base-200 para consistencia, y un borde amarillo para indicar 'tema' */}
          <div className="bg-base-200 p-4 rounded-lg border-l-4 border-warning shadow-sm">
            <span className="block text-[10px] font-black opacity-50 uppercase tracking-wider mb-1">
                Tema Solicitado
            </span>
            <p className="font-medium text-lg text-base-content">
                {appointment.topic}
            </p>
          </div>
        </div>

        <div className="modal-action justify-between mt-8 items-center">
          
          {/* BOTÓN DE DOS PASOS (Sin Alert) */}
          {isConfirming ? (
             <div className="flex gap-2 animate-fade-in-right">
                <button 
                    onClick={() => setIsConfirming(false)} 
                    className="btn btn-ghost btn-sm"
                >
                    No, esperar
                </button>
                <button 
                    onClick={handleCancel} 
                    className="btn btn-error btn-sm shadow-lg animate-pulse"
                    disabled={loading}
                >
                    {loading ? '...' : 'Sí, Cancelar'}
                </button>
             </div>
          ) : (
             <button 
                onClick={() => setIsConfirming(true)} 
                className="btn btn-outline btn-error btn-sm opacity-80 hover:opacity-100"
             >
                Cancelar Cita
             </button>
          )}
          
          <button onClick={onClose} className="btn btn-primary px-8 shadow-lg">Cerrar</button>
        </div>

      </div>
    </div>
  )
}