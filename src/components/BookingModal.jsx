import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { BookOpenIcon, AcademicCapIcon, ClockIcon, UserIcon } from '@heroicons/react/24/outline'

export default function BookingModal({ isOpen, onClose, onNotify }) {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)

  // Datos Lógicos
  const [myCourse, setMyCourse] = useState(null)
  const [subjects, setSubjects] = useState([])
  const [topics, setTopics] = useState([])
  const [slots, setSlots] = useState([])

  // Selecciones
  const [selectedClass, setSelectedClass] = useState(null) // Contiene subject_id y tutor_id
  const [selectedTopic, setSelectedTopic] = useState(null)
  const [selectedSlot, setSelectedSlot] = useState(null)

  useEffect(() => {
    if (isOpen) {
      // Reiniciar todo al abrir
      setStep(1); setSubjects([]); setTopics([]); setSlots([]);
      setSelectedClass(null); setSelectedTopic(null); setSelectedSlot(null);
      fetchMyAcademicData()
    }
  }, [isOpen])

  // 1. OBTENER LAS MATERIAS DEL ESTUDIANTE
  const fetchMyAcademicData = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // A. Buscar en qué curso estoy matriculado
    const { data: enrollment } = await supabase
      .from('enrollments')
      .select('course_id, courses(name)')
      .eq('student_id', user.id)
      .single()

    if (enrollment) {
      setMyCourse(enrollment.courses)

      // B. Buscar las CLASES disponibles para ese curso (Materias + Profesores)
      const { data: classesData } = await supabase
        .from('classes')
        .select(`
            id,
            subject_id,
            tutor_id,
            subjects (id, name, icon),
            profiles (full_name)
        `)
        .eq('course_id', enrollment.course_id)

      setSubjects(classesData || [])
    }
    setLoading(false)
  }

  // 2. CUANDO SELECCIONA MATERIA -> CARGAR TEMAS ACTIVOS
  const handleSelectSubject = async (classItem) => {
    setSelectedClass(classItem)
    setLoading(true)

    // Traer solo los temas que estén marcados como VISIBLES (active) en la tabla intermedia
    // OJO: Si no hay registros en visibility, asumimos oculto.
    const { data: activeTopics } = await supabase
      .from('class_topic_visibility')
      .select(`
        topic_id,
        topics (id, name, unit_number)
      `)
      .eq('class_id', classItem.id)
      .eq('is_active', true)
      .order('topic_id', { ascending: true }) // Ordenar por ID o Unidad

    // Mapeamos para limpiar la estructura
    const cleanTopics = activeTopics?.map(item => item.topics) || []

    setTopics(cleanTopics)
    setStep(2)
    setLoading(false)
  }

  // 3. CUANDO SELECCIONA TEMA -> CARGAR HORARIOS DEL PROFESOR DE ESA CLASE
  const handleSelectTopic = async (topic) => {
    setSelectedTopic(topic)
    setLoading(true)

    // Buscar horarios DEL TUTOR ASIGNADO A ESA MATERIA
    const { data } = await supabase
      .from('availability_slots')
      .select('*')
      .eq('tutor_id', selectedClass.tutor_id) // El ID del profe viene de la clase
      .eq('is_booked', false)
      .gt('start_time', new Date().toISOString()) // Solo futuros
      .order('start_time', { ascending: true })

    setSlots(data || [])
    setStep(3)
    setLoading(false)
  }

  const handleBookSlot = async (slot) => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()

    try {
      // ... dentro de handleBookSlot ...
      const { error: appointError } = await supabase.from('appointments').insert({
        student_id: user.id, 
        tutor_id: selectedClass.tutor_id, 
        slot_id: slot.id, 
        topic: `${selectedClass.subjects.name}: ${selectedTopic.name}`,
        topic_id: selectedTopic.id, // <--- NUEVO: Guardamos el ID del tema
        subject_id: selectedClass.subject_id, // <--- NUEVO: También el ID de la materia (si agregaste esa columna, sino omítelo por ahora)
        status: 'scheduled'
      })
      // ...
      if (appointError) throw appointError

      // Marcar slot ocupado
      const { error: updateError } = await supabase.from('availability_slots').update({ is_booked: true }).eq('id', slot.id)
      if (updateError) throw updateError

      onNotify(`✅ Tutoría agendada para ${selectedClass.subjects.name}`, 'success')
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
      <div className="modal-box w-full max-w-3xl bg-base-100 shadow-2xl border border-primary/20 p-6 min-h-[500px]">

        {/* HEADER */}
        <div className="flex justify-between items-center mb-6 border-b border-base-200 pb-4">
          <div>
            <h3 className="font-bold text-2xl text-primary">
              {step === 1 && `Materias: ${myCourse?.name || 'Cargando...'}`}
              {step === 2 && `Temas de ${selectedClass?.subjects?.name}`}
              {step === 3 && 'Elige tu Horario'}
            </h3>
            <p className="text-sm opacity-70">
              {step === 1 && 'Selecciona la asignatura donde necesitas refuerzo.'}
              {step === 2 && `Profesor asignado: ${selectedClass?.profiles?.full_name}`}
              {step === 3 && `Disponibilidad de ${selectedClass?.profiles?.full_name}`}
            </p>
          </div>
          <button onClick={onClose} className="btn btn-circle btn-ghost btn-sm">✕</button>
        </div>

        {/* CONTENIDO */}
        {loading ? (
          <div className="flex justify-center items-center h-60"><span className="loading loading-spinner loading-lg text-primary"></span></div>
        ) : (
          <div className="min-h-[300px]">

            {/* PASO 1: MATERIAS */}
            {/* PASO 1: MATERIAS */}
            {step === 1 && (
              // 1. Agregamos 'auto-rows-fr' para que todas las celdas tengan la misma altura
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in-up auto-rows-fr">
                {subjects.length === 0 ? (
                  <div className="col-span-2 text-center py-10 opacity-50">
                    <AcademicCapIcon className="w-16 h-16 mx-auto mb-2" />
                    <p>No tienes materias asignadas aún.</p>
                  </div>
                ) : (
                  subjects.map((cls) => (
                    // 2. Agregamos 'h-full', 'items-start' y 'text-left' para manejar textos largos
                    <button key={cls.id} onClick={() => handleSelectSubject(cls)} className="btn btn-outline h-full min-h-[80px] py-4 px-6 flex flex-row items-center justify-start gap-4 hover:btn-primary hover:scale-[1.02] transition-all group text-left whitespace-normal">
                      <div className="bg-base-200 p-3 rounded-full group-hover:bg-primary group-hover:text-white transition-colors shrink-0">
                        <BookOpenIcon className="w-6 h-6" />
                      </div>
                      <div className="flex-1">
                        {/* 3. Ajuste de line-height y break-words */}
                        <span className="text-md md:text-lg font-bold block leading-tight mb-1">{cls.subjects.name}</span>
                        <span className="text-xs opacity-60 font-normal block">Prof: {cls.profiles.full_name}</span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}

            {/* PASO 2: TEMAS */}
            {step === 2 && (
              <div className="animate-fade-in-right">
                <button onClick={() => setStep(1)} className="btn btn-sm btn-ghost mb-4 pl-0 gap-2"><ArrowLeftIcon className="w-4 h-4" /> Volver a Materias</button>

                <div className="grid grid-cols-1 gap-3">
                  {topics.length === 0 ? (
                    <div className="alert alert-info">
                      <AcademicCapIcon className="w-6 h-6" />
                      <span>El profesor aún no ha habilitado temas para esta unidad.</span>
                    </div>
                  ) : (
                    topics.map((topic) => (
                      <div key={topic.id} onClick={() => handleSelectTopic(topic)} className="card bg-base-200 hover:bg-base-300 cursor-pointer border-l-4 border-secondary transition-all hover:pl-6">
                        <div className="card-body p-4 flex-row justify-between items-center">
                          <div>
                            <div className="badge badge-xs badge-secondary mb-1">Unidad {topic.unit_number}</div>
                            <h4 className="font-bold text-lg">{topic.name}</h4>
                          </div>
                          <UserIcon className="w-6 h-6 opacity-20" />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* PASO 3: HORARIOS */}
            {step === 3 && (
              <div className="animate-fade-in-right">
                <button onClick={() => setStep(2)} className="btn btn-sm btn-ghost mb-4 pl-0 gap-2"><ArrowLeftIcon className="w-4 h-4" /> Volver a Temas</button>

                <div className="bg-primary/5 p-4 rounded-xl mb-4 border border-primary/20 text-center">
                  <span className="text-sm font-bold text-primary block">Reservando Tutoría de:</span>
                  <span className="text-lg font-black">{selectedClass?.subjects.name}</span>
                  <span className="block text-xs opacity-60">Tema: {selectedTopic?.name}</span>
                </div>

                {slots.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-40 opacity-50">
                    <ClockIcon className="w-12 h-12 mb-2" />
                    <p>El profesor {selectedClass?.profiles.full_name} no tiene horarios disponibles.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {slots.map((slot) => (
                      <button key={slot.id} onClick={() => handleBookSlot(slot)} className="btn btn-success btn-outline h-auto py-3 flex flex-col hover:scale-105 transition-transform shadow-sm">
                        <span className="text-xl font-bold font-mono">
                          {new Date(slot.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span className="text-[10px] uppercase font-bold opacity-70">
                          {new Date(slot.start_time).toLocaleDateString([], { weekday: 'short', day: 'numeric' })}
                        </span>
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

// Icono auxiliar si no lo tenías importado
function ArrowLeftIcon(props) {
  return (
    <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
    </svg>
  )
}