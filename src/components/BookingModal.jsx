import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function BookingModal({ isOpen, onClose, onNotify }) {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [specialties, setSpecialties] = useState([])
  const [tutors, setTutors] = useState([])
  const [slots, setSlots] = useState([])
  const [selectedSpec, setSelectedSpec] = useState(null)
  const [selectedTutor, setSelectedTutor] = useState(null)

  useEffect(() => {
    if (isOpen) {
      setStep(1); setTutors([]); setSlots([]); setSelectedSpec(null); setSelectedTutor(null);
      async function fetchSpecs() {
        const { data } = await supabase.from('specialties').select('*')
        setSpecialties(data || [])
      }
      fetchSpecs()
    }
  }, [isOpen])

  const handleSelectSpecialty = async (spec) => {
    setSelectedSpec(spec); setLoading(true)
    const { data } = await supabase.from('tutor_specialties').select(`tutor_id, profiles:tutor_id (id, full_name, role)`).eq('specialty_id', spec.id)
    setTutors(data?.map(i => i.profiles).filter(t => t) || []); setStep(2); setLoading(false)
  }

  const handleSelectTutor = async (tutor) => {
    setSelectedTutor(tutor); setLoading(true)
    
    // FILTRO CLAVE: Solo mostrar horarios FUTUROS
    const { data } = await supabase
      .from('availability_slots')
      .select('*')
      .eq('tutor_id', tutor.id)
      .eq('is_booked', false)
      .gt('start_time', new Date().toISOString()) // <--- AQUÍ ESTÁ LA MAGIA
      .order('start_time', { ascending: true })

    setSlots(data || []); setStep(3); setLoading(false)
  }

  const handleBookSlot = async (slot) => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      onNotify("Error: No estás logueado", 'error'); setLoading(false); return
    }

    try {
      const { error: appointError } = await supabase.from('appointments').insert({
        student_id: user.id, tutor_id: selectedTutor.id, slot_id: slot.id, topic: `Ayuda con ${selectedSpec.name}`, status: 'scheduled'
      })
      if (appointError) throw appointError

      const { error: updateError } = await supabase.from('availability_slots').update({ is_booked: true }).eq('id', slot.id)
      if (updateError) throw updateError

      onNotify(`✅ ¡Cita Confirmada con ${selectedTutor.full_name}!`, 'success')
      onClose()

    } catch (error) {
      onNotify(`❌ Error: ${error.message}`, 'error')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="modal-box w-full max-w-3xl bg-base-100 shadow-2xl border border-primary/20 p-6 min-h-[400px]">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="font-bold text-2xl text-primary">
              {step === 1 && '¿Qué apoyo necesitas?'}
              {step === 2 && 'Selecciona un Tutor'}
              {step === 3 && 'Elige tu Horario'}
            </h3>
            <p className="text-sm opacity-70">
              {step === 2 && `Expertos en: ${selectedSpec?.name}`}
              {step === 3 && `Horarios de: ${selectedTutor?.full_name}`}
            </p>
          </div>
          <button onClick={onClose} className="btn btn-circle btn-ghost btn-sm">✕</button>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-40"><span className="loading loading-spinner loading-lg text-primary"></span></div>
        ) : (
          <div>
            {step === 1 && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 animate-fade-in-up">
                {specialties.map((spec) => (
                  <button key={spec.id} onClick={() => handleSelectSpecialty(spec)} className="btn btn-outline h-auto py-6 flex flex-col gap-3 hover:btn-primary transition-all">
                    <span className="text-2xl">🎓</span><span className="text-sm font-bold whitespace-normal">{spec.name}</span>
                  </button>
                ))}
              </div>
            )}
            {step === 2 && (
              <div className="animate-fade-in-right">
                <button onClick={() => setStep(1)} className="btn btn-sm btn-ghost mb-4 pl-0">← Volver</button>
                <div className="space-y-3">
                  {tutors.map((tutor) => (
                    <div key={tutor.id} className="card bg-base-200 border-l-4 border-primary hover:bg-base-300 transition-colors">
                      <div className="card-body flex-row items-center p-4 gap-4">
                        <div className="avatar placeholder"><div className="bg-neutral text-neutral-content rounded-full w-12"><span>{tutor.full_name[0]}</span></div></div>
                        <div className="flex-1"><h4 className="font-bold">{tutor.full_name}</h4><div className="badge badge-sm badge-outline">Verificado</div></div>
                        <button onClick={() => handleSelectTutor(tutor)} className="btn btn-primary btn-sm">Ver Horarios</button>
                      </div>
                    </div>
                  ))}
                  {tutors.length === 0 && <p>No hay tutores disponibles.</p>}
                </div>
              </div>
            )}
            {step === 3 && (
              <div className="animate-fade-in-right">
                <button onClick={() => setStep(2)} className="btn btn-sm btn-ghost mb-4 pl-0">← Cambiar Tutor</button>
                <h4 className="font-bold mb-4 text-center bg-base-200 p-2 rounded">📅 Disponibilidad para Hoy</h4>
                {slots.length === 0 ? <div className="alert alert-warning">Este tutor ya no tiene cupos libres hoy.</div> : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {slots.map((slot) => (
                      <button key={slot.id} onClick={() => handleBookSlot(slot)} className="btn btn-success btn-outline h-auto py-4 flex flex-col hover:scale-105 transition-transform">
                        <span className="text-xl font-bold">{new Date(slot.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        <span className="text-xs uppercase">Disponible</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}