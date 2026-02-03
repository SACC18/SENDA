import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { TrophyIcon, FlagIcon, BookOpenIcon, BeakerIcon, RocketLaunchIcon, CheckCircleIcon } from '@heroicons/react/24/solid'

const milestones = [
  { id: 1, label: 'Inicio', target: 0, icon: <FlagIcon className="w-6 h-6"/> },
  { id: 2, label: 'Unidad 1', target: 33, icon: <BookOpenIcon className="w-6 h-6"/> },
  { id: 3, label: 'Unidad 2', target: 66, icon: <BeakerIcon className="w-6 h-6"/> },
  { id: 4, label: 'Unidad 3', target: 90, icon: <RocketLaunchIcon className="w-6 h-6"/> },
  { id: 5, label: 'Aprobado', target: 100, icon: <TrophyIcon className="w-6 h-6"/> },
]

export default function MapPath() {
  const [percentage, setPercentage] = useState(0)
  const [userAvatar, setUserAvatar] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    calculateGlobalProgress()
  }, [])

  const calculateGlobalProgress = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase.from('profiles').select('avatar_url, full_name').eq('id', user.id).single()
      if (profile) {
         setUserAvatar(profile.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.full_name}`)
      }

      const { data: enrollment } = await supabase.from('enrollments').select('course_id').eq('student_id', user.id).single()
      if (!enrollment) { setLoading(false); return }

      const { data: classes } = await supabase.from('classes').select('subject_id').eq('course_id', enrollment.course_id)
      if (!classes || classes.length === 0) { setLoading(false); return }

      const promises = classes.map(async (cls) => {
        const { count: total } = await supabase.from('topics').select('*', { count: 'exact', head: true }).eq('subject_id', cls.subject_id)
        const { count: completed } = await supabase.from('student_progress').select('*', { count: 'exact', head: true }).eq('student_id', user.id).eq('subject_id', cls.subject_id)
        return total === 0 ? 0 : (completed / total) * 100
      })

      const percentages = await Promise.all(promises)
      const sum = percentages.reduce((a, b) => a + b, 0)
      const average = Math.round(sum / classes.length)
      
      setPercentage(average)

    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const getVerticalOffset = (index) => {
    if (index === 1) return '-translate-y-12' 
    if (index === 3) return 'translate-y-12'  
    return '' 
  }

  const strokeDashoffset = 1000 - (percentage * 10)

  if (loading) return <div className="h-[400px] animate-pulse bg-base-200 rounded-xl"></div>

  return (
    // CAMBIO 1: Usamos 'flex flex-col' para separar físicamente el título del mapa
    <div className="w-full h-[400px] bg-base-100 rounded-3xl overflow-hidden flex flex-col items-center p-6 border border-base-200 shadow-xl">
      
      {/* 1. TÍTULO ESTATICO (Ya no tiene 'absolute') */}
      {/* Esto garantiza que ocupe su propio espacio y empuje el mapa hacia abajo */}
      <div className="w-full text-center z-20 mb-4 mt-2">
        <span className="text-xs uppercase tracking-widest opacity-50 font-bold">Progreso Global</span>
        <h3 className="text-3xl font-black text-primary drop-shadow-sm">
          {percentage}% COMPLETADO
        </h3>
      </div>

      {/* 2. CONTENEDOR DEL MAPA (Ocupa el resto del espacio disponible) */}
      <div className="relative w-full flex-1 flex items-center justify-center">
        
        {/* SVG Ajustado al contenedor padre */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none scale-x-110" style={{ zIndex: 0 }} viewBox="0 0 800 400" preserveAspectRatio="none">
          {/* Ajusté las coordenadas del Path para que la curva quede centrada en este nuevo contenedor */}
          <path d="M 50,200 C 200,0 600,400 750,200" fill="none" stroke="currentColor" strokeWidth="8" className="text-base-300 opacity-30" strokeLinecap="round"/>
          <path 
            d="M 50,200 C 200,0 600,400 750,200" 
            fill="none" 
            stroke="url(#gradientPath)" 
            strokeWidth="8"
            strokeDasharray="1000"
            strokeDashoffset={strokeDashoffset} 
            className="transition-all duration-1000 ease-out"
            strokeLinecap="round"
            style={{ filter: 'drop-shadow(0 0 4px rgba(59, 130, 246, 0.5))' }}
          />
          <defs>
              <linearGradient id="gradientPath" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#4f46e5" />
                  <stop offset="100%" stopColor="#06b6d4" /> 
              </linearGradient>
          </defs>
        </svg>

        {/* NODOS */}
        <div className="relative w-full flex justify-between items-center px-4" style={{ zIndex: 10 }}>
          {milestones.map((milestone, index) => {
            const isCompleted = percentage >= milestone.target
            const isCurrent = !isCompleted && (index === 0 || percentage >= milestones[index-1].target)
            const isFinalVictory = index === milestones.length - 1 && percentage === 100

            let circleClass = "bg-base-100 text-base-content/20 scale-90 border-4 border-base-200" 
            let textClass = "opacity-40"
            
            if (isCompleted) {
              circleClass = "bg-primary text-primary-content scale-100 shadow-lg ring-4 ring-primary/20 border-primary"
              textClass = "text-primary font-bold"
            } else if (isCurrent) {
              circleClass = "bg-white text-secondary border-secondary scale-110 shadow-[0_0_30px_rgba(6,182,212,0.6)] ring-4 ring-secondary animate-pulse"
              textClass = "text-secondary font-bold scale-110"
            }

            const verticalClass = getVerticalOffset(index)

            return (
              <div key={milestone.id} className={`flex flex-col items-center gap-3 transition-all duration-500 ${verticalClass}`}>
                <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-700 z-10 ${circleClass}`}>
                  {isCompleted && index < milestones.length -1 ? <CheckCircleIcon className="w-8 h-8"/> : milestone.icon}
                </div>
                
                <span className={`text-xs uppercase tracking-wider transition-all duration-500 bg-base-100/90 px-3 py-1 rounded-full shadow-sm backdrop-blur-md border border-base-200 ${textClass}`}>
                  {milestone.label}
                </span>

                {(isCurrent || isFinalVictory) && (
                   // CAMBIO 2: z-50 para asegurar que siempre esté ENCIMA de todo
                   <div className="absolute -top-14 animate-bounce z-50"> 
                      <div className="avatar">
                          <div className="w-12 rounded-full ring ring-secondary ring-offset-base-100 ring-offset-2 shadow-2xl bg-base-100">
                              <img src={userAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=Generico`} alt="avatar" />
                          </div>
                      </div>
                      <div className="badge badge-secondary badge-xs absolute -bottom-2 left-1/2 -translate-x-1/2 shadow-sm">YO</div>
                   </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}