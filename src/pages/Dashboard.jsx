import { useEffect, useState, useCallback, useRef } from 'react'
import Navbar from '../components/Navbar'
import MapPath from '../components/MapPath'
import BookingModal from '../components/BookingModal'
import AppointmentModal from '../components/AppointmentModal'
import Notification from '../components/Notification'
import StudentProgress from '../components/StudentProgress'
import FeedbackModal from '../components/FeedbackModal'

import AdminDashboard from './AdminDashboard'
import CoordinatorDashboard from './CoordinatorDashboard'
import TutorDashboard from './TutorDashboard'

import { supabase } from '../lib/supabase'
import { ClockIcon, MapIcon, TrophyIcon, EyeIcon } from '@heroicons/react/24/solid'

const CountdownTimer = ({ targetDate }) => {
  const calculateTimeLeft = useCallback(() => {
    const difference = new Date(targetDate) - new Date()
    if (difference <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 }
    return {
      days: Math.floor(difference / (1000 * 60 * 60 * 24)),
      hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
      minutes: Math.floor((difference / 1000 / 60) % 60),
      seconds: Math.floor((difference / 1000) % 60)
    }
  }, [targetDate])

  const [timeLeft, setTimeLeft] = useState(calculateTimeLeft())

  useEffect(() => {
    const timer = setInterval(() => setTimeLeft(calculateTimeLeft()), 1000)
    return () => clearInterval(timer)
  }, [calculateTimeLeft])

  return (
    <div className="grid grid-flow-col gap-2 text-center auto-cols-max justify-center my-4 relative z-50 pointer-events-none">
      {timeLeft.days > 0 && (
        <div className="flex flex-col p-2 bg-neutral rounded-box text-neutral-content shadow-lg min-w-[60px]">
          <span className="countdown font-mono text-3xl justify-center">
            <span style={{ "--value": timeLeft.days }}></span>
          </span>
          <span className="text-[9px] opacity-70 uppercase tracking-widest mt-1">días</span>
        </div>
      )}
      <div className="flex flex-col p-2 bg-neutral rounded-box text-neutral-content shadow-lg min-w-[60px]">
        <span className="countdown font-mono text-3xl justify-center">
          <span style={{ "--value": timeLeft.hours }}></span>
        </span>
        <span className="text-[9px] opacity-70 uppercase tracking-widest mt-1">horas</span>
      </div>
      <div className="flex flex-col p-2 bg-neutral rounded-box text-neutral-content shadow-lg min-w-[60px]">
        <span className="countdown font-mono text-3xl justify-center">
          <span style={{ "--value": timeLeft.minutes }}></span>
        </span>
        <span className="text-[9px] opacity-70 uppercase tracking-widest mt-1">min</span>
      </div>
      <div className="flex flex-col p-2 bg-primary rounded-box text-primary-content shadow-lg min-w-[60px]">
        <span className="countdown font-mono text-3xl justify-center">
          <span style={{ "--value": timeLeft.seconds }}></span>
        </span>
        <span className="text-[9px] font-bold uppercase tracking-widest mt-1">seg</span>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [role, setRole] = useState(null)
  const [loading, setLoading] = useState(true)
  const [userName, setUserName] = useState('')
  const [userAvatar, setUserAvatar] = useState(null)
  const [userId, setUserId] = useState(null)
  const [greeting, setGreeting] = useState('Hola')
  const [notification, setNotification] = useState({ msg: '', type: '' })
  const [textSize] = useState(localStorage.getItem('senda-text-size') || 100)

  const [isBookingOpen, setIsBookingOpen] = useState(false)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
  const [nextAppointment, setNextAppointment] = useState(null)
  const [generalStats, setGeneralStats] = useState({ progress: 0, semester: 1 })

  const [adminViewMode, setAdminViewMode] = useState('admin')
  const cardRef = useRef(null)

  const handleNotify = (msg, type) => { setNotification({ msg, type }) }

  // SEGURO DE ACCESIBILIDAD
  useEffect(() => {
    const root = document.documentElement
    if (root) {
      root.style.fontSize = `${textSize}%`
    }
  }, [textSize])

  // CARGAR CITA PENDIENTE
  const fetchStudentData = useCallback(async (uid) => {
    const { data, error } = await supabase.from('appointments').select(`*, tutor:profiles!tutor_id (full_name, avatar_url), slot:availability_slots!slot_id (start_time)`).eq('student_id', uid).eq('status', 'scheduled')
    if (!error && data) {
      const now = new Date()
      const futureApps = data.filter(app => new Date(app.slot.start_time) > now)
      futureApps.sort((a, b) => new Date(a.slot.start_time) - new Date(b.slot.start_time))
      setNextAppointment(futureApps.length > 0 ? futureApps[0] : null)
    }
  }, [])

  // CARGAR PROGRESO GLOBAL OPTIMIZADO
  const fetchGeneralStats = useCallback(async (uid) => {
    const { data: enrollment } = await supabase.from('student_enrollments').select('career_id, level_id, level:levels(name)').eq('student_id', uid).maybeSingle()

    let semesterNum = 1
    if (enrollment?.level?.name) {
      const match = enrollment.level.name.match(/\d+/)
      if (match) semesterNum = parseInt(match[0])
    }

    let progressVal = 0
    if (enrollment) {
      const { data: courseData } = await supabase.from('courses').select('id').eq('career_id', enrollment.career_id).eq('level_id', enrollment.level_id).single()
      if (courseData) {
        const { data: classes } = await supabase.from('classes').select('subject_id').eq('course_id', courseData.id)
        if (classes && classes.length > 0) {
          const subjectIds = classes.map(c => c.subject_id)
          const [topicsRes, progressRes] = await Promise.all([
            supabase.from('topics').select('id, subject_id').in('subject_id', subjectIds),
            supabase.from('student_progress').select('topic_id, subject_id').eq('student_id', uid)
          ])
          const allTopics = topicsRes.data || []
          const allProgress = progressRes.data || []
          const percentages = classes.map((cls) => {
            const totalTopics = allTopics.filter(t => t.subject_id === cls.subject_id).length
            const completedTopics = allProgress.filter(p => p.subject_id === cls.subject_id).length
            return totalTopics === 0 ? 0 : (completedTopics / totalTopics) * 100
          })
          progressVal = Math.round(percentages.reduce((a, b) => a + b, 0) / classes.length)
        }
      }
    }
    setGeneralStats({ progress: progressVal, semester: semesterNum })
  }, [])

  // VERIFICAR USUARIO Y ROL
  const checkUserRole = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      setUserId(user.id)
      const { data: profile } = await supabase.from('profiles').select('role, full_name, avatar_url').eq('id', user.id).single()
      if (profile) {
        setRole(profile.role)
        setUserName(profile.full_name)
        setUserAvatar(profile.avatar_url)
        if (profile.role === 'student' || profile.role === 'admin') {
          await fetchStudentData(user.id)
          await fetchGeneralStats(user.id)
        }
      }
    }
    setLoading(false)
  }, [fetchStudentData, fetchGeneralStats])

  useEffect(() => {
    checkUserRole()
    const hour = new Date().getHours()
    if (hour < 12) setGreeting('Buenos días')
    else if (hour < 18) setGreeting('Buenas tardes')
    else setGreeting('Buenas noches')
  }, [checkUserRole])

  // TIEMPO REAL
  useEffect(() => {
    if (!userId) return
    const subscription = supabase.channel('student_dashboard_channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments', filter: `student_id=eq.${userId}` }, () => {
        fetchStudentData(userId)
        fetchGeneralStats(userId)
      }).subscribe()
    return () => { supabase.removeChannel(subscription) }
  }, [userId, fetchStudentData, fetchGeneralStats])

  // EFECTO 3D
  const handleMouseMove = (e) => {
    if (!cardRef.current) return
    const card = cardRef.current
    const rect = card.getBoundingClientRect()
    const rotateX = ((e.clientY - rect.top - rect.height / 2) / (rect.height / 2)) * -15
    const rotateY = ((e.clientX - rect.left - rect.width / 2) / (rect.width / 2)) * 15
    card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.05, 1.05, 1.05)`
  }

  const handleMouseLeave = () => {
    if (!cardRef.current) return
    cardRef.current.style.transform = `perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)`
  }

  if (loading) return (
    <div className="min-h-screen bg-base-200 flex flex-col items-center justify-center gap-4">
      <span className="loading loading-infinity loading-lg text-primary scale-150"></span>
      <span className="text-primary font-bold tracking-widest animate-pulse">CARGANDO SENDA...</span>
    </div>
  )

  const isStudentView = role === 'student' || (role === 'admin' && adminViewMode === 'student')
  const isTutorView = role === 'tutor' || (role === 'admin' && adminViewMode === 'tutor')
  const isCoordinatorView = role === 'coordinator'

  return (
    <div className="min-h-screen bg-base-200 font-sans pb-20 selection:bg-primary selection:text-primary-content relative overflow-hidden">
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40vw] h-[40vw] rounded-full bg-primary/10 blur-[120px] mix-blend-screen animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40vw] h-[40vw] rounded-full bg-secondary/10 blur-[120px] mix-blend-screen animate-pulse"></div>
      </div>

      <div className="relative z-10">
        <Navbar userAvatar={userAvatar} />
        <Notification message={notification.msg} type={notification.type} onClose={() => setNotification({ msg: '', type: '' })} />

        <main className="container mx-auto px-4 py-8 max-w-7xl">
          {role === 'admin' && (
            <div className="flex justify-center mb-8">
              <div className="tabs tabs-boxed bg-base-100 p-1 shadow-sm border border-base-200">
                <button className={`tab gap-2 ${adminViewMode === 'admin' ? 'tab-active font-bold bg-primary text-primary-content rounded-btn shadow-sm' : ''}`} onClick={() => setAdminViewMode('admin')}><TrophyIcon className="w-4 h-4" /> Panel Admin</button>
                <button className={`tab gap-2 ${adminViewMode === 'student' ? 'tab-active font-bold bg-secondary text-secondary-content rounded-btn shadow-sm' : ''}`} onClick={() => setAdminViewMode('student')}><EyeIcon className="w-4 h-4" /> Estudiante</button>
                <button className={`tab gap-2 ${adminViewMode === 'tutor' ? 'tab-active font-bold bg-accent text-accent-content rounded-btn shadow-sm' : ''}`} onClick={() => setAdminViewMode('tutor')}><EyeIcon className="w-4 h-4" /> Tutor</button>
              </div>
            </div>
          )}

          <div className="relative mb-12 p-8 lg:p-12 rounded-3xl bg-gradient-to-br from-primary via-primary/90 to-secondary text-primary-content shadow-xl overflow-hidden border border-white/10">
            <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-6 text-center md:text-left">
              <div>
                <h1 className="text-4xl lg:text-5xl font-extrabold mb-2 tracking-tight">{greeting}, {userName.split(' ')[0]}</h1>
                <p className="text-lg opacity-90 font-medium">Cada sesión te acerca más a tus objetivos académicos.</p>
              </div>
              {isStudentView && (
                <div className="flex gap-4 items-center bg-base-100/20 p-4 rounded-2xl backdrop-blur-md border border-white/20 shadow-lg">
                  <div className="text-center"><div className="radial-progress font-bold text-lg text-current" style={{ "--value": generalStats.progress, "--size": "3.5rem" }}>{generalStats.progress}%</div></div>
                  <div className="w-px h-12 bg-current opacity-30"></div>
                  <div className="text-center min-w-[60px]"><div className="text-3xl font-black">{generalStats.semester}</div><div className="text-[10px] uppercase font-bold opacity-80">Nivel</div></div>
                </div>
              )}
            </div>
          </div>

          {isStudentView && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-8 flex flex-col gap-8">
                <div className="card bg-base-100 shadow-xl border border-base-200 overflow-hidden relative">
                  <div className="absolute top-6 left-6 z-20"><span className="badge badge-primary badge-lg border-none gap-2"><MapIcon className="w-4 h-4" /> Ruta de Aprendizaje</span></div>
                  <MapPath userAvatar={userAvatar} userName={userName} />
                </div>
                <StudentProgress userId={userId} onNotify={handleNotify} />
              </div>
              <div className="lg:col-span-4 flex justify-center items-start">
                <div className="w-full max-w-sm perspective-[1000px] z-20">
                  <div ref={cardRef} onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave} className={`card w-full shadow-2xl min-h-[380px] flex flex-col justify-center overflow-hidden transition-transform duration-200 ${nextAppointment ? 'bg-neutral text-neutral-content border-none' : 'bg-base-100 text-base-content border border-base-200'}`}>
                    <div className="card-body items-center text-center p-8 pointer-events-none z-10">
                      {nextAppointment ? (
                        <>
                          <div className="badge badge-accent badge-outline mb-2 font-bold pointer-events-auto">Confirmada</div>
                          <h2 className="text-2xl font-bold mb-4 text-white">🚀 Próxima Tutoría</h2>
                          <CountdownTimer targetDate={nextAppointment.slot.start_time} />
                          <div className="w-full mt-4 border-t border-white/10 pt-4 font-semibold text-lg text-white">{nextAppointment.tutor.full_name}</div>
                          <button onClick={() => setIsDetailsOpen(true)} className="btn btn-primary btn-block shadow-lg mt-6 pointer-events-auto active:scale-95">Ver Detalles</button>
                        </>
                      ) : (
                        <>
                          <ClockIcon className="w-24 h-24 text-base-content/20 mb-4" />
                          <h2 className="card-title text-xl font-bold">Sin actividad</h2>
                          <button onClick={() => setIsBookingOpen(true)} className="btn btn-outline btn-primary btn-block mt-8 pointer-events-auto active:scale-95">Reservar Cita</button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {isTutorView && <TutorDashboard userId={userId} onNotify={handleNotify} />}
          {isCoordinatorView && <CoordinatorDashboard onNotify={handleNotify} />}
          {role === 'admin' && adminViewMode === 'admin' && <AdminDashboard session={{ user: { id: userId } }} onNotify={handleNotify} />}
        </main>

        <BookingModal isOpen={isBookingOpen} onClose={() => { setIsBookingOpen(false); checkUserRole() }} onNotify={handleNotify} />
        <AppointmentModal appointment={nextAppointment} isOpen={isDetailsOpen} onClose={() => setIsDetailsOpen(false)} onUpdate={() => { setIsDetailsOpen(false); checkUserRole() }} onNotify={handleNotify} />
        <FeedbackModal userId={userId} onNotify={handleNotify} />
      </div>
    </div>
  )
}