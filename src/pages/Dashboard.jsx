import { useEffect, useState, useCallback } from 'react'
import Navbar from '../components/Navbar'
import MapPath from '../components/MapPath'
import BookingModal from '../components/BookingModal'
import AppointmentModal from '../components/AppointmentModal'
import Notification from '../components/Notification'
import StudentProgress from '../components/StudentProgress' // <--- Asegúrate de tener esto importado
import AcademicManager from '../components/AcademicManager' // <--- Y esto para el tutor
import { supabase } from '../lib/supabase'
import {
  CalendarIcon, ClockIcon, MapIcon, BookOpenIcon, FireIcon, StarIcon, TrophyIcon, PlusCircleIcon, CheckCircleIcon, XCircleIcon
} from '@heroicons/react/24/solid'

const CountdownTimer = ({ targetDate }) => {
  // ... (Mantén tu código del Timer igual) ...
  const [timeLeft, setTimeLeft] = useState(calculateTimeLeft())
  function calculateTimeLeft() {
    const difference = new Date(targetDate) - new Date()
    if (difference <= 0) return { hours: 0, minutes: 0, seconds: 0 }
    return {
      hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
      minutes: Math.floor((difference / 1000 / 60) % 60),
      seconds: Math.floor((difference / 1000) % 60)
    }
  }
  useEffect(() => {
    const timer = setInterval(() => setTimeLeft(calculateTimeLeft()), 1000)
    return () => clearInterval(timer)
  }, [targetDate])
  // ... (Return del Timer igual) ...
  return (
    <div className="grid grid-flow-col gap-4 text-center auto-cols-max justify-center my-4">
      <div className="flex flex-col p-3 bg-base-300/50 backdrop-blur-sm rounded-box text-base-content border border-base-content/10">
        <span className="countdown font-mono text-4xl"><span style={{ "--value": timeLeft.hours }}></span></span>
        <span className="text-xs opacity-50 uppercase mt-1">Horas</span>
      </div>
      <div className="flex flex-col p-3 bg-base-300/50 backdrop-blur-sm rounded-box text-base-content border border-base-content/10">
        <span className="countdown font-mono text-4xl"><span style={{ "--value": timeLeft.minutes }}></span></span>
        <span className="text-xs opacity-50 uppercase mt-1">Min</span>
      </div>
      <div className="flex flex-col p-3 bg-base-300/50 backdrop-blur-sm rounded-box text-base-content border border-base-content/10">
        <span className="countdown font-mono text-4xl text-primary"><span style={{ "--value": timeLeft.seconds }}></span></span>
        <span className="text-xs opacity-50 uppercase mt-1">Seg</span>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [role, setRole] = useState(null)
  const [loading, setLoading] = useState(true)
  const [userName, setUserName] = useState('')
  const [userId, setUserId] = useState(null)
  const [greeting, setGreeting] = useState('Hola')
  const [notification, setNotification] = useState({ msg: '', type: '' })

  const [isBookingOpen, setIsBookingOpen] = useState(false)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
  const [nextAppointment, setNextAppointment] = useState(null)
  const [tutorAppointments, setTutorAppointments] = useState([])
  const [newSlotDate, setNewSlotDate] = useState('')
  const [isPublishing, setIsPublishing] = useState(false)

  // ESTADO NUEVO PARA EL WIDGET DEL HEADER
  const [generalStats, setGeneralStats] = useState({ progress: 0, semester: 1 })
  const [tutorTab, setTutorTab] = useState('agenda')

  const [actionState, setActionState] = useState({ id: null, type: null })
  const [processingId, setProcessingId] = useState(null)

  useEffect(() => {
    checkUserRole()
    const hour = new Date().getHours()
    if (hour < 12) setGreeting('Buenos días')
    else if (hour < 18) setGreeting('Buenas tardes')
    else setGreeting('Buenas noches')
  }, [])

  // --- NUEVA FUNCIÓN: CALCULAR ESTADÍSTICAS GENERALES ---
  const fetchGeneralStats = useCallback(async (uid) => {
    // 1. Obtener curso para saber el Semestre
    const { data: enrollment } = await supabase.from('enrollments').select('course_id, courses(name)').eq('student_id', uid).single()

    let semesterNum = 1
    if (enrollment && enrollment.courses) {
      // Intentamos sacar el número del nombre (Ej: "3er Semestre" -> 3)
      const match = enrollment.courses.name.match(/\d+/)
      if (match) semesterNum = parseInt(match[0])
    }

    // 2. Calcular % de Progreso (Misma lógica que el Mapa)
    let progressVal = 0
    if (enrollment) {
      const { data: classes } = await supabase.from('classes').select('subject_id').eq('course_id', enrollment.course_id)
      if (classes && classes.length > 0) {
        const promises = classes.map(async (cls) => {
          const { count: total } = await supabase.from('topics').select('*', { count: 'exact', head: true }).eq('subject_id', cls.subject_id)
          const { count: completed } = await supabase.from('student_progress').select('*', { count: 'exact', head: true }).eq('student_id', uid).eq('subject_id', cls.subject_id)
          return total === 0 ? 0 : (completed / total) * 100
        })
        const percentages = await Promise.all(promises)
        const sum = percentages.reduce((a, b) => a + b, 0)
        progressVal = Math.round(sum / classes.length)
      }
    }

    setGeneralStats({ progress: progressVal, semester: semesterNum })
  }, [])


  const fetchStudentData = useCallback(async (uid) => {
    const { data, error } = await supabase
      .from('appointments')
      // AGREGAMOS avatar_url AQUÍ ABAJO 👇
      .select(`*, tutor:profiles!tutor_id (full_name, avatar_url), slot:availability_slots!slot_id (start_time)`) 
      .eq('student_id', uid)
      .eq('status', 'scheduled')


    if (!error && data) {
      if (data.length === 0) {
        setNextAppointment(null)
      } else {
        const now = new Date()
        const futureApps = data.filter(app => new Date(app.slot.start_time) > now)
        futureApps.sort((a, b) => new Date(a.slot.start_time) - new Date(b.slot.start_time))
        setNextAppointment(futureApps.length > 0 ? futureApps[0] : null)
      }
    }
  }, [])

  const fetchTutorData = useCallback(async (uid) => {
    const { data } = await supabase
      .from('appointments')
      .select(`*, student:profiles!student_id (full_name, id), slot:availability_slots!slot_id (start_time)`)
      .eq('tutor_id', uid)
      .eq('status', 'scheduled')

    if (data) {
      data.sort((a, b) => new Date(a.slot.start_time) - new Date(b.slot.start_time))
      setTutorAppointments(data)
    }
  }, [])

  // Suscripción Realtime (sin cambios)
  useEffect(() => {
    if (!userId || !role) return
    const channel = supabase
      .channel('public:appointments')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'appointments' },
        (payload) => {
          if (role === 'tutor') fetchTutorData(userId)
          if (role === 'student') {
            fetchStudentData(userId)
            fetchGeneralStats(userId) // <-- Actualizar stats también al terminar clase
          }
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [userId, role, fetchStudentData, fetchTutorData, fetchGeneralStats])

  const checkUserRole = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      setUserId(user.id)
      const { data: profile } = await supabase.from('profiles').select('role, full_name').eq('id', user.id).single()
      if (profile) {
        setRole(profile.role)
        setUserName(profile.full_name)
        if (profile.role === 'student') {
          await fetchStudentData(user.id)
          await fetchGeneralStats(user.id) // <-- Carga inicial de stats
        }
        else if (profile.role === 'tutor') await fetchTutorData(user.id)
      }
    }
    setLoading(false)
  }

  // ... (Resto de funciones: handleNotify, executeAction, requestConfirmation, handleAddSlot, refresh, formatDate...)
  // Asegúrate de copiar las funciones auxiliares que ya tenías en tu código anterior
  const handleNotify = (msg, type) => { setNotification({ msg, type }) }
  const requestConfirmation = (id, type) => { if (actionState.id === id && actionState.type === type) { setActionState({ id: null, type: null }) } else { setActionState({ id, type }) } }
  const executeAction = async (appointmentId, slotId, action, appointmentData) => {
    setProcessingId(appointmentId)
    setActionState({ id: null, type: null })

    try {
        const newStatus = action === 'completed' ? 'completed' : 'cancelled'
        
        // 1. Actualizar en Base de Datos
        const { error: appError } = await supabase.from('appointments').update({ status: newStatus }).eq('id', appointmentId)
        if (appError) throw appError

        // 2. Lógica Extra (Liberar slot o Guardar Progreso)
        if (action === 'cancelled') {
            const { error: slotError } = await supabase.from('availability_slots').update({ is_booked: false }).eq('id', slotId)
            if (slotError) throw slotError
        } else if (action === 'completed' && appointmentData?.topic_id) {
            const { data: topicInfo } = await supabase.from('topics').select('subject_id').eq('id', appointmentData.topic_id).single()
            await supabase.from('student_progress').insert({ 
                student_id: appointmentData.student_id, 
                topic_id: appointmentData.topic_id, 
                subject_id: topicInfo?.subject_id 
            })
            // También actualizamos las estadísticas generales si fuéramos el estudiante, pero aquí somos el tutor.
        }

        // --- LA LÍNEA MÁGICA NUEVA 👇 ---
        // Borramos la cita de la lista visualmente DE INMEDIATO
        setTutorAppointments(prev => prev.filter(app => app.id !== appointmentId))
        // -------------------------------

        handleNotify(action === 'completed' ? 'Clase finalizada' : 'Clase cancelada', 'success')

    } catch (error) {
        // Ignorar error de duplicado en progreso
        if (error.code !== '23505') { 
            handleNotify('Error: ' + error.message, 'error')
        }
    } finally {
        setProcessingId(null)
    }
  }
  const handleAddSlot = async (e) => { e.preventDefault(); if (!newSlotDate) return handleNotify("Por favor selecciona una fecha", "error"); setIsPublishing(true); try { const startDate = new Date(newSlotDate); const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); const { error } = await supabase.from('availability_slots').insert({ tutor_id: userId, start_time: startDate.toISOString(), end_time: endDate.toISOString(), is_booked: false }); if (error) throw error; handleNotify("✅ Horario publicado correctamente", "success"); setNewSlotDate('') } catch (error) { handleNotify("Error: " + error.message, "error") } finally { setIsPublishing(false) } }
  const refresh = () => checkUserRole()
  const formatDate = (dateStr) => new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const formatDateFull = (dateStr) => new Date(dateStr).toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'short' })

  if (loading) return <div className="min-h-screen bg-base-200 flex items-center justify-center"><span className="loading loading-bars loading-lg text-primary"></span></div>

  return (
    <div className="min-h-screen bg-base-200 font-sans pb-20 selection:bg-primary selection:text-primary-content transition-colors duration-300">
      <Navbar />
      <Notification message={notification.msg} type={notification.type} onClose={() => setNotification({ msg: '', type: '' })} />

      <main className="container mx-auto px-4 py-8 max-w-7xl">

        {/* HERO SECTION */}
        <div className="relative mb-12 p-8 lg:p-12 rounded-3xl bg-gradient-to-br from-primary to-secondary text-primary-content shadow-xl overflow-hidden group">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-10 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-1000"></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-black opacity-5 rounded-full blur-2xl"></div>
          <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="text-center md:text-left">
              <h1 className="text-4xl lg:text-5xl font-extrabold mb-2 tracking-tight">
                {greeting}, <span className="underline decoration-wavy decoration-accent/50 underline-offset-4">{userName.split(' ')[0]}</span>
              </h1>
              <p className="text-lg opacity-90 max-w-lg">
                {role === 'tutor' ? 'Gestiona tus clases y ayuda a tus estudiantes.' : 'Cada sesión te acerca más a tus objetivos.'}
              </p>
            </div>

            {/* WIDGET DEL HEADER AHORA DINÁMICO */}
            {role === 'student' && (
              <div className="flex gap-4 items-center bg-base-100/20 p-4 rounded-2xl backdrop-blur-md border border-white/10 shadow-lg">
                <div className="text-center">
                  {/* PORCENTAJE REAL */}
                  <div className="radial-progress font-bold text-lg text-current" style={{ "--value": generalStats.progress, "--size": "3.5rem", "--thickness": "4px" }}>
                    {generalStats.progress}%
                  </div>
                  <div className="text-[10px] uppercase font-bold mt-1 opacity-70">Semestre</div>
                </div>
                <div className="w-px h-12 bg-current opacity-20"></div>
                <div className="text-center min-w-[60px]">
                  {/* SEMESTRE REAL */}
                  <div className="text-3xl font-black">{generalStats.semester}</div>
                  <div className="text-[10px] uppercase font-bold opacity-70">Nivel</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ... (EL RESTO DE TU CÓDIGO SIGUE IGUAL: VISTAS DE ESTUDIANTE Y TUTOR) ... */}
        {/* Solo asegúrate de que donde dice {role === 'student' && ( ... )} tengas el <StudentProgress /> y el <MapPath /> como acordamos antes */}

        {role === 'student' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-8 flex flex-col gap-8">
              <div className="card bg-base-100 shadow-xl border border-base-200 overflow-hidden">
                <div className="card-body p-0 relative min-h-[400px]">
                  <div className="absolute top-4 left-4 z-10">
                    <span className="badge badge-primary badge-lg shadow-sm gap-2">
                      <MapIcon className="w-4 h-4" /> Ruta de Aprendizaje
                    </span>
                  </div>
                  <MapPath />
                </div>
              </div>

              {/* COMPONENTE DE PROGRESO POR MATERIA */}
              <div className="mt-8">
                <StudentProgress userId={userId} />
              </div>

            </div>

            <div className="lg:col-span-4 flex flex-col gap-6">
              {/* ... (Tarjeta de Próxima Tutoría y demás widgets laterales) ... */}
              <div className="group relative w-full">
                <div className={`absolute -inset-1 bg-gradient-to-r from-primary to-secondary rounded-3xl blur opacity-20 group-hover:opacity-40 transition duration-500 ${!nextAppointment && 'hidden'}`}></div>
                <div className={`relative card w-full bg-base-100 shadow-xl border border-base-200 transition-all duration-300 ease-out group-hover:-translate-y-2 group-hover:shadow-2xl ${nextAppointment ? 'border-primary/50' : ''}`}>
                  <div className="card-body items-center text-center p-8">
                    {nextAppointment ? (
                      <>
                        <div className="badge badge-accent badge-outline mb-2 animate-pulse">Confirmada</div>
                        <h2 className="text-2xl font-bold text-base-content mb-4">🚀 Próxima Tutoría</h2>
                        <CountdownTimer targetDate={nextAppointment.slot.start_time} />
                        <div className="w-full bg-base-200/50 rounded-xl p-4 mt-4 text-left border border-base-300">
    {/* AQUÍ ESTABA EL ERROR: Faltaba el div flex container */}
    <div className="flex items-start gap-3">
        
        {/* Avatar del Tutor */}
        <div className="avatar">
            <div className="w-12 h-12 rounded-full ring ring-primary ring-offset-base-100 ring-offset-2 bg-base-100 shadow-md">
                <img 
                src={nextAppointment.tutor.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${nextAppointment.tutor.full_name}`} 
                alt="Tutor Avatar" 
                />
            </div>
        </div>

        {/* Texto de Información (RESTITUIDO) */}
        <div>
            <h3 className="font-bold text-lg leading-tight">{nextAppointment.topic}</h3>
            <p className="text-sm opacity-70 mt-1">con {nextAppointment.tutor.full_name}</p>
            <p className="text-xs font-mono opacity-50 mt-2 flex items-center gap-1">
                📅 {formatDateFull(nextAppointment.slot.start_time)}
            </p>
        </div>

    </div>
</div>
                        <div className="card-actions w-full mt-6">
                          <button onClick={() => setIsDetailsOpen(true)} className="btn btn-primary btn-block shadow-lg shadow-primary/20">Ver Detalles</button>
                        </div>
                      </>
                    ) : (
                      <>
                        <ClockIcon className="w-24 h-24 text-base-content/20 mb-4 group-hover:scale-110 transition-transform duration-300" />
                        <h2 className="card-title text-xl">Sin actividad</h2>
                        <p className="opacity-60 text-sm mb-6 max-w-xs">No tienes clases programadas. ¡Es un buen momento para aprender algo nuevo!</p>
                        <button onClick={() => setIsBookingOpen(true)} className="btn btn-outline btn-primary btn-block hover:shadow-lg">Reservar Cita</button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* VISTA TUTOR (Incluyendo AcademicManager) */}
        {role === 'tutor' && (
          <div className="flex flex-col gap-8">
            {/* TABS DE NAVEGACIÓN */}
            <div role="tablist" className="tabs tabs-boxed bg-base-100 p-2 w-fit mx-auto lg:mx-0 shadow-sm border border-base-200">
              <a role="tab" className={`tab gap-2 ${tutorTab === 'agenda' ? 'tab-active font-bold' : ''}`} onClick={() => setTutorTab('agenda')}>
                <CalendarIcon className="w-4 h-4" /> Mi Agenda
              </a>
              <a role="tab" className={`tab gap-2 ${tutorTab === 'academic' ? 'tab-active font-bold' : ''}`} onClick={() => setTutorTab('academic')}>
                <BookOpenIcon className="w-4 h-4" /> Mis Materias (PEA)
              </a>
            </div>

            {tutorTab === 'agenda' ? (
              <div className="flex flex-col lg:flex-row gap-8">
                {/* COLUMNA IZQUIERDA: PANEL FIJO DE HORARIOS */}
                <div className="w-full lg:w-1/3">
                  <div className="card bg-base-100 shadow-xl border border-base-200 sticky top-24">
                    <div className="card-body">
                      <h2 className="card-title text-primary flex items-center gap-2"><PlusCircleIcon className="w-6 h-6" /> Publicar Horario</h2>
                      <p className="text-xs opacity-60">Selecciona cuándo estás disponible.</p>
                      <form onSubmit={handleAddSlot} className="flex flex-col gap-4 mt-4">
                        <div className="form-control">
                          <input type="datetime-local" className="input input-bordered input-primary w-full bg-base-200 focus:bg-base-100 transition-colors" value={newSlotDate} onChange={(e) => setNewSlotDate(e.target.value)} required />
                        </div>
                        <button type="submit" className="btn btn-primary shadow-lg" disabled={isPublishing}>
                          {isPublishing ? <span className="loading loading-spinner"></span> : 'Agregar Cupo'}
                        </button>
                      </form>
                    </div>
                  </div>
                </div>
                {/* COLUMNA DERECHA: AGENDA */}
                <div className="w-full lg:w-2/3">
                  <div className="bg-base-100 rounded-3xl shadow-xl border border-base-200 p-6 lg:p-10 min-h-[500px]">
                    <div className="flex justify-between items-center mb-8">
                      <h2 className="text-2xl font-bold">Agenda de Clases</h2>
                      <div className="badge badge-lg badge-neutral gap-2">{tutorAppointments.length} <span className="opacity-50 text-xs">SESIONES</span></div>
                    </div>
                    {tutorAppointments.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-64 text-center opacity-40">
                        <CalendarIcon className="h-16 w-16 text-primary/50 mb-4" />
                        <p>No tienes clases programadas aún.</p>
                      </div>
                    ) : (
                      <ul className="timeline timeline-vertical timeline-compact lg:timeline-horizontal lg:overflow-x-auto pb-6">
                        {tutorAppointments.map((app, index) => (
                          <li key={app.id}>
                            <hr className={index > 0 ? "bg-primary" : ""} />
                            <div className="timeline-start text-[10px] font-mono opacity-50 mb-2 uppercase tracking-wider">{formatDateFull(app.slot.start_time)}</div>
                            <div className="timeline-middle"><div className="w-4 h-4 rounded-full bg-primary ring-4 ring-primary/20"></div></div>

                            <div className="timeline-end timeline-box bg-base-200 border-none shadow-sm mb-4 p-4 hover:scale-105 transition-transform cursor-pointer w-64">
                              <div className="text-lg font-black text-primary">{formatDate(app.slot.start_time)}</div>
                              <div className="font-bold truncate" title={app.student.full_name}>{app.student.full_name}</div>
                              <div className="mt-2 mb-3"><span className="badge badge-secondary badge-outline text-xs font-bold whitespace-normal h-auto py-2 text-left leading-tight block">{app.topic}</span></div>

                              <div className="flex gap-2 justify-end mt-2 pt-2 border-t border-base-300">
                                {actionState.id === app.id && actionState.type === 'cancelled' ? (
                                  <button onClick={() => executeAction(app.id, app.slot_id, 'cancelled', app)} className="btn btn-xs btn-error text-white animate-pulse">¿Confirmar?</button>
                                ) : (
                                  <button onClick={() => requestConfirmation(app.id, 'cancelled')} className="btn btn-xs btn-ghost text-error" disabled={processingId === app.id} title="Cancelar"><XCircleIcon className="w-5 h-5" /></button>
                                )}

                                {actionState.id === app.id && actionState.type === 'completed' ? (
                                  <button onClick={() => executeAction(app.id, app.slot_id, 'completed', app)} className="btn btn-xs btn-success text-white animate-pulse">¿Terminar?</button>
                                ) : (
                                  <button onClick={() => requestConfirmation(app.id, 'completed')} className="btn btn-xs btn-success text-white" disabled={processingId === app.id} title="Finalizar Clase"><CheckCircleIcon className="w-4 h-4" /> Terminar</button>
                                )}
                              </div>
                            </div>
                            <hr className="bg-primary" />
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              // VISTA DE GESTIÓN ACADÉMICA
              <div className="w-full">
                <AcademicManager userId={userId} onNotify={handleNotify} />
              </div>
            )}
          </div>
        )}

      </main>

      <BookingModal isOpen={isBookingOpen} onClose={() => { setIsBookingOpen(false); refresh(); }} onNotify={handleNotify} />
      <AppointmentModal appointment={nextAppointment} isOpen={isDetailsOpen} onClose={() => setIsDetailsOpen(false)} onUpdate={() => { setIsDetailsOpen(false); refresh(); }} onNotify={handleNotify} />
    </div>
  )
}