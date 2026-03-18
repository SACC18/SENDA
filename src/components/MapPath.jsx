import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { TrophyIcon, FlagIcon, BookOpenIcon, BeakerIcon, RocketLaunchIcon, CheckCircleIcon } from '@heroicons/react/24/solid'

const milestones = [
  { id: 1, label: 'Inicio', target: 0, icon: <FlagIcon className="w-6 h-6" /> },
  { id: 2, label: 'Unidad 1', target: 33, icon: <BookOpenIcon className="w-6 h-6" /> },
  { id: 3, label: 'Unidad 2', target: 66, icon: <BeakerIcon className="w-6 h-6" /> },
  { id: 4, label: 'Unidad 3', target: 90, icon: <RocketLaunchIcon className="w-6 h-6" /> },
  { id: 5, label: 'Aprobado', target: 100, icon: <TrophyIcon className="w-6 h-6" /> },
]

export default function MapPath({ userAvatar, userName }) {
  const [percentage, setPercentage] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    calculateGlobalProgress()
  }, [])

  const calculateGlobalProgress = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: enrollment } = await supabase.from('student_enrollments').select('career_id, level_id').eq('student_id', user.id).maybeSingle()
      if (!enrollment) return setLoading(false)

      const { data: courseData } = await supabase.from('courses').select('id').eq('career_id', enrollment.career_id).eq('level_id', enrollment.level_id).single()
      if (!courseData) return setLoading(false)

      const { data: classes } = await supabase.from('classes').select('subject_id').eq('course_id', courseData.id)
      if (!classes || classes.length === 0) return setLoading(false)

      const subjectIds = classes.map(c => c.subject_id)

      const [topicsRes, progressRes] = await Promise.all([
        supabase.from('topics').select('id, subject_id').in('subject_id', subjectIds),
        supabase.from('student_progress').select('id, subject_id').eq('student_id', user.id)
      ])

      const allTopics = topicsRes.data || []
      const allProgress = progressRes.data || []

      const percentages = classes.map(cls => {
        const total = allTopics.filter(t => t.subject_id === cls.subject_id).length
        const completed = allProgress.filter(p => p.subject_id === cls.subject_id).length
        return total === 0 ? 0 : (completed / total) * 100
      })

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
    <div className="w-full h-[400px] bg-base-100 overflow-hidden flex flex-col items-center pt-8 pb-6 px-6 transition-colors relative">

      <div className="absolute inset-0 z-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at center, currentColor 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>

      <div className="w-full text-center z-20 mb-4 mt-4">
        <span className="text-[10px] uppercase tracking-[0.3em] opacity-40 font-black text-base-content">Progreso de la Misión</span>
        <h3 className="text-4xl font-black text-primary drop-shadow-sm tracking-tight mt-1">
          {percentage}% COMPLETADO
        </h3>
      </div>

      <div className="relative w-full flex-1 flex items-center justify-center">
        <svg className="absolute inset-0 w-full h-full pointer-events-none scale-x-110" style={{ zIndex: 0 }} viewBox="0 0 800 400" preserveAspectRatio="none">
          <path d="M 50,200 C 200,0 600,400 750,200" fill="none" stroke="currentColor" strokeWidth="8" className="text-base-300 opacity-40" strokeLinecap="round" />
          <path
            d="M 50,200 C 200,0 600,400 750,200"
            fill="none" stroke="url(#gradientPath)" strokeWidth="8" strokeDasharray="1000" strokeDashoffset={strokeDashoffset}
            className="transition-all duration-1000 ease-out" strokeLinecap="round"
            style={{ filter: 'drop-shadow(0 0 8px rgba(var(--p), 0.6))' }}
          />
          <defs>
            <linearGradient id="gradientPath" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="oklch(var(--p))" />
              <stop offset="100%" stopColor="oklch(var(--s))" />
            </linearGradient>
          </defs>
        </svg>

        <div className="relative w-full flex justify-between items-center px-4" style={{ zIndex: 10 }}>
          {milestones.map((milestone, index) => {
            const isCompleted = percentage >= milestone.target
            const isCurrent = !isCompleted && (index === 0 || percentage >= milestones[index - 1].target)
            const isFinalVictory = index === milestones.length - 1 && percentage === 100

            let circleClass = "bg-base-100 text-base-content/20 scale-90 border-4 border-base-200"
            let textClass = "opacity-40 text-base-content"

            if (isCompleted) {
              circleClass = "bg-primary text-primary-content scale-100 shadow-[0_0_15px_rgba(var(--p),0.5)] border-primary"
              textClass = "text-primary font-bold"
            } else if (isCurrent) {
              circleClass = "bg-base-100 text-secondary border-secondary scale-110 shadow-[0_0_30px_rgba(var(--s),0.6)] ring-4 ring-secondary animate-pulse"
              textClass = "text-secondary font-bold scale-110"
            }

            return (
              <div key={milestone.id} className={`flex flex-col items-center gap-3 transition-all duration-500 relative ${getVerticalOffset(index)}`}>
                {isCurrent && <div className="absolute inset-0 bg-secondary/20 blur-xl rounded-full scale-150 z-0 animate-pulse"></div>}
                <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-700 z-10 ${circleClass}`}>
                  {isCompleted && index < milestones.length - 1 ? <CheckCircleIcon className="w-8 h-8" /> : milestone.icon}
                </div>
                <span className={`text-[10px] font-black uppercase tracking-wider transition-all duration-500 bg-base-100/90 px-3 py-1 rounded-full shadow-sm backdrop-blur-md border border-base-200 z-10 ${textClass}`}>
                  {milestone.label}
                </span>

                {(isCurrent || isFinalVictory) && (
                  <div className="absolute -top-16 animate-bounce z-50">
                    <div className="avatar">
                      <div className="w-14 rounded-full ring-4 ring-secondary ring-offset-base-100 ring-offset-2 shadow-2xl bg-base-100">
                        <img src={userAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${userName || 'Student'}`} alt="avatar" />
                      </div>
                    </div>
                    <div className="badge badge-secondary badge-xs font-black absolute -bottom-1 left-1/2 -translate-x-1/2 shadow-sm scale-110">YO</div>
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