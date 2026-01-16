import { useEffect, useState } from 'react'
import Navbar from '../components/Navbar'
import MapPath from '../components/MapPath'
import BookingModal from '../components/BookingModal'
import AppointmentModal from '../components/AppointmentModal'
import Notification from '../components/Notification'
import { supabase } from '../lib/supabase'
import { 
  CalendarIcon, 
  ClockIcon, 
  MapIcon, 
  BookOpenIcon, 
  FireIcon, 
  StarIcon, 
  TrophyIcon, 
  PlusCircleIcon 
} from '@heroicons/react/24/solid'

// --- SUB-COMPONENTE: CUENTA REGRESIVA ---
const CountdownTimer = ({ targetDate }) => {
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
  
  // ESTADO PARA NOTIFICACIONES GLOBALES
  const [notification, setNotification] = useState({ msg: '', type: '' })

  const [isBookingOpen, setIsBookingOpen] = useState(false)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
  const [nextAppointment, setNextAppointment] = useState(null)
  const [tutorAppointments, setTutorAppointments] = useState([])
  const [newSlotDate, setNewSlotDate] = useState('')
  const [isPublishing, setIsPublishing] = useState(false)

  useEffect(() => {
    checkUserRole()
    const hour = new Date().getHours()
    if (hour < 12) setGreeting('Buenos días')
    else if (hour < 18) setGreeting('Buenas tardes')
    else setGreeting('Buenas noches')
  }, [])

  const checkUserRole = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      setUserId(user.id)
      const { data: profile } = await supabase.from('profiles').select('role, full_name').eq('id', user.id).single()
      if (profile) {
        setRole(profile.role)
        setUserName(profile.full_name)
        // AQUI ESTABA EL ERROR: Faltaba el 'await' para esperar los datos antes de quitar el loading
        if (profile.role === 'student') await fetchStudentData(user.id)
        else if (profile.role === 'tutor') await fetchTutorData(user.id)
      }
    }
    setLoading(false)
  }

  const fetchStudentData = async (uid) => {
    setNextAppointment(null) 
    const { data, error } = await supabase
      .from('appointments')
      .select(`*, tutor:profiles!tutor_id (full_name), slot:availability_slots!slot_id (start_time)`)
      .eq('student_id', uid)
      .eq('status', 'scheduled')
      .order('created_at', { ascending: false })
      .limit(1) // IMPORTANTE: Asegura que solo traiga 1, evitando errores si hay duplicados
      .maybeSingle()
      
    if (!error) setNextAppointment(data)
  }

  const fetchTutorData = async (uid) => {
    const { data } = await supabase.from('appointments').select(`*, student:profiles!student_id (full_name, id), slot:availability_slots!slot_id (start_time)`).eq('tutor_id', uid).eq('status', 'scheduled').order('slot_id', { ascending: true })
    setTutorAppointments(data || [])
  }

  // Helper para pasar a los modales
  const handleNotify = (msg, type) => {
    setNotification({ msg, type })
  }

  const handleAddSlot = async (e) => {
    e.preventDefault()
    if (!newSlotDate) return handleNotify("Por favor selecciona una fecha", "error")
    setIsPublishing(true)
    try {
      const startDate = new Date(newSlotDate)
      const endDate = new Date(startDate.getTime() + 60 * 60 * 1000)
      const { error } = await supabase.from('availability_slots').insert({ tutor_id: userId, start_time: startDate.toISOString(), end_time: endDate.toISOString(), is_booked: false })
      if (error) throw error
      handleNotify("✅ Horario publicado correctamente", "success")
      setNewSlotDate('')
    } catch (error) {
      handleNotify("Error: " + error.message, "error")
    } finally { setIsPublishing(false) }
  }

  const refresh = () => checkUserRole()
  const formatDate = (dateStr) => new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const formatDateFull = (dateStr) => new Date(dateStr).toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'short' })

  if (loading) return <div className="min-h-screen bg-base-200 flex items-center justify-center"><span className="loading loading-bars loading-lg text-primary"></span></div>

  return (
    <div className="min-h-screen bg-base-200 font-sans pb-20 selection:bg-primary selection:text-primary-content transition-colors duration-300">
      <Navbar />
      <Notification message={notification.msg} type={notification.type} onClose={() => setNotification({ msg: '', type: '' })} />

      <main className="container mx-auto px-4 py-8 max-w-7xl">
        
        {/* --- HERO SECTION --- */}
        <div className="relative mb-12 p-8 lg:p-12 rounded-3xl bg-gradient-to-br from-primary to-secondary text-primary-content shadow-xl overflow-hidden group">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-10 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-1000"></div>
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-black opacity-5 rounded-full blur-2xl"></div>
            <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-6">
                <div className="text-center md:text-left">
                    <h1 className="text-4xl lg:text-5xl font-extrabold mb-2 tracking-tight">
                        {greeting}, <span className="underline decoration-wavy decoration-accent/50 underline-offset-4">{userName.split(' ')[0]}</span>
                    </h1>
                    <p className="text-lg opacity-90 max-w-lg">
                        {role === 'tutor' ? 'Tu conocimiento ilumina el camino de otros.' : 'Cada sesión te acerca más a tus objetivos.'}
                    </p>
                </div>
                {role === 'student' && (
                    <div className="flex gap-4 items-center bg-base-100/20 p-4 rounded-2xl backdrop-blur-md border border-white/10 shadow-lg">
                        <div className="text-center">
                            <div className="radial-progress font-bold text-lg text-current" style={{"--value":40, "--size": "3.5rem", "--thickness": "4px"}}>40%</div>
                            <div className="text-[10px] uppercase font-bold mt-1 opacity-70">Semestre</div>
                        </div>
                        <div className="w-px h-12 bg-current opacity-20"></div>
                        <div className="text-center min-w-[60px]">
                             <div className="text-3xl font-black">2</div>
                             <div className="text-[10px] uppercase font-bold opacity-70">Nivel</div>
                        </div>
                    </div>
                )}
            </div>
        </div>

        {/* --- VISTA DE ESTUDIANTE --- */}
        {role === 'student' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-8 flex flex-col gap-8">
              <div className="card bg-base-100 shadow-xl border border-base-200 overflow-hidden">
                <div className="card-body p-0 relative min-h-[400px]">
                   <div className="absolute top-4 left-4 z-10">
                      <span className="badge badge-primary badge-lg shadow-sm gap-2">
                        <MapIcon className="w-4 h-4"/> Ruta de Aprendizaje
                      </span>
                   </div>
                   <MapPath />
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                 {[
                    { label: 'Tutorías', val: '0', icon: <BookOpenIcon className="w-8 h-8 text-blue-500"/> },
                    { label: 'Racha', val: '3 días', icon: <FireIcon className="w-8 h-8 text-orange-500"/> },
                    { label: 'Puntos', val: '120', icon: <StarIcon className="w-8 h-8 text-yellow-500"/> },
                    { label: 'Ranking', val: '#15', icon: <TrophyIcon className="w-8 h-8 text-purple-500"/> },
                 ].map((stat, i) => (
                    <div key={i} className="flex flex-col items-center justify-center p-4 bg-base-100 rounded-2xl shadow-sm border border-base-200 hover:shadow-md transition-shadow">
                        <span className="mb-2">{stat.icon}</span>
                        <span className="font-bold text-lg text-base-content">{stat.val}</span>
                        <span className="text-xs uppercase font-bold text-base-content/50">{stat.label}</span>
                    </div>
                 ))}
              </div>
            </div>

            <div className="lg:col-span-4 flex flex-col gap-6">
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
                           <div className="flex items-start gap-3">
                              <div className="avatar placeholder mt-1">
                                 <div className="bg-primary text-primary-content rounded-full w-10 h-10 shadow">
                                    <span className="text-lg font-bold">{nextAppointment.tutor.full_name[0]}</span>
                                 </div>
                              </div>
                              <div>
                                 <h3 className="font-bold text-lg leading-tight">{nextAppointment.topic}</h3>
                                 <p className="text-sm opacity-70 mt-1">con {nextAppointment.tutor.full_name}</p>
                                 <p className="text-xs font-mono opacity-50 mt-2 flex items-center gap-1">📅 {formatDateFull(nextAppointment.slot.start_time)}</p>
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
              <div className="card bg-base-100 shadow-md border border-base-200">
                <div className="card-body p-6">
                   <h3 className="font-bold text-sm uppercase opacity-50 mb-4">Últimas Insignias</h3>
                   <div className="flex justify-between">
                      <div className="tooltip" data-tip="Bienvenido"><div className="text-3xl text-yellow-500 cursor-help transition hover:scale-125"><TrophyIcon className="w-8 h-8" /></div></div>
                      <div className="opacity-20"><FireIcon className="w-8 h-8" /></div>
                      <div className="opacity-20"><BookOpenIcon className="w-8 h-8" /></div>
                      <div className="opacity-20"><StarIcon className="w-8 h-8" /></div>
                   </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* --- VISTA DE TUTOR --- */}
        {role === 'tutor' && (
          <div className="flex flex-col lg:flex-row gap-8">
            <div className="w-full lg:w-1/3">
               <div className="card bg-base-100 shadow-xl border border-base-200 sticky top-24">
                  <div className="card-body">
                     <h2 className="card-title text-primary flex items-center gap-2"><PlusCircleIcon className="w-6 h-6"/> Publicar Horario</h2>
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
                              <div className="timeline-end timeline-box bg-base-200 border-none shadow-sm mb-4 p-4 hover:scale-105 transition-transform cursor-pointer w-48">
                                 <div className="text-lg font-black text-primary">{formatDate(app.slot.start_time)}</div>
                                 <div className="font-bold truncate" title={app.student.full_name}>{app.student.full_name}</div>
                                 <div className="mt-2"><span className="badge badge-secondary badge-outline text-xs font-bold truncate max-w-full">{app.topic}</span></div>
                              </div>
                              <hr className="bg-primary" />
                           </li>
                        ))}
                     </ul>
                  )}
               </div>
            </div>
          </div>
        )}
      </main>

      {/* --- PASAMOS 'handleNotify' A LOS MODALES PARA QUE ELLOS NOTIFIQUEN --- */}
      <BookingModal 
        isOpen={isBookingOpen} 
        onClose={() => { setIsBookingOpen(false); refresh(); }} 
        onNotify={handleNotify} 
      />
      <AppointmentModal 
        appointment={nextAppointment} 
        isOpen={isDetailsOpen} 
        onClose={() => setIsDetailsOpen(false)} 
        onUpdate={() => { setIsDetailsOpen(false); refresh(); }} 
        onNotify={handleNotify} 
      />
    </div>
  )
}