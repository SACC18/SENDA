import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { TrophyIcon, ChartBarIcon } from '@heroicons/react/24/solid'

export default function StudentProgress({ userId }) {
  const [stats, setStats] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (userId) calculateProgress()
  }, [userId])

  const calculateProgress = async () => {
    try {
      const { data: enrollment } = await supabase.from('student_enrollments').select('career_id, level_id').eq('student_id', userId).maybeSingle()
      if (!enrollment) { setStats([]); return }

      const { data: courseData } = await supabase.from('courses').select('id').eq('career_id', enrollment.career_id).eq('level_id', enrollment.level_id).single()
      if (!courseData) return

      const { data: classes } = await supabase.from('classes').select(`subject_id, subjects (id, name)`).eq('course_id', courseData.id)
      if (!classes || classes.length === 0) return

      const subjectIds = classes.map(c => c.subject_id)

      const [topicsRes, progressRes] = await Promise.all([
        supabase.from('topics').select('id, subject_id').in('subject_id', subjectIds),
        supabase.from('student_progress').select('topic_id, subject_id').eq('student_id', userId)
      ])

      const allTopics = topicsRes.data || []
      const allProgress = progressRes.data || []

      // Calculamos en memoria 
      const results = classes.map((cls) => {
        const subject = cls.subjects
        const totalTopics = allTopics.filter(t => t.subject_id === subject.id).length
        const completedTopics = allProgress.filter(p => p.subject_id === subject.id).length
        const percentage = totalTopics === 0 ? 0 : Math.round((completedTopics / totalTopics) * 100)
        return { id: subject.id, name: subject.name, total: totalTopics, completed: completedTopics, percentage: percentage }
      })

      setStats(results)
    } catch (error) {
      console.error("Error calculando progreso:", error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return (
    <div className="bg-base-100 rounded-[2.5rem] p-8 shadow-sm animate-pulse border border-base-200">
      <div className="h-6 w-48 bg-base-300 rounded-full mb-6"></div>
      <div className="space-y-4">
        <div className="h-12 bg-base-200 rounded-2xl"></div>
        <div className="h-12 bg-base-200 rounded-2xl"></div>
      </div>
    </div>
  )

  return (
    <div className="bg-base-100 rounded-[2.5rem] shadow-xl border border-base-200 overflow-hidden transition-colors">
      <div className="p-8">
        <h2 className="text-xl font-black text-base-content flex items-center gap-3 mb-8 uppercase tracking-tight">
          <div className="bg-primary/20 p-2 rounded-xl">
            <ChartBarIcon className="w-6 h-6 text-primary" />
          </div>
          Mi Progreso Académico
        </h2>

        <div className="flex flex-col gap-6">
          {stats.length === 0 ? (
            <div className="text-center py-10 bg-base-200 rounded-[2rem] border border-dashed border-base-300">
              <p className="text-base-content/60 font-bold text-sm">No hay materias asignadas a tu curso aún.</p>
            </div>
          ) : (
            stats.map((subject) => (
              <div key={subject.id} className="group relative bg-base-200/50 p-5 rounded-[1.8rem] border border-base-200 hover:bg-base-200 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 overflow-hidden cursor-default">

                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-base-content/5 to-transparent -translate-x-full group-hover:animate-[shimmer_1s_ease-in-out] pointer-events-none"></div>

                <div className="flex justify-between items-center mb-3 px-1 relative z-10">
                  <span className="font-black text-base-content tracking-tight">{subject.name}</span>
                  <span className="text-[10px] font-black uppercase text-base-content/70 tracking-widest bg-base-100 px-3 py-1 rounded-full shadow-sm border border-base-200">
                    {subject.completed} / {subject.total} Temas
                  </span>
                </div>

                <div className="w-full bg-base-300 rounded-full h-4 overflow-hidden shadow-inner p-[2px] relative z-10">
                  <div
                    className={`h-full rounded-full transition-all duration-1000 ease-out ${subject.percentage === 100 ? 'bg-success' : 'bg-primary'}`}
                    style={{ width: `${subject.percentage}%` }}
                  >
                  </div>
                </div>

                <div className="flex justify-end mt-2 px-1 relative z-10">
                  {subject.percentage === 100 ? (
                    <div className="flex items-center gap-1 text-success font-black text-[10px] uppercase">
                      <TrophyIcon className="w-3 h-3" /> ¡Materia Completada!
                    </div>
                  ) : (
                    <span className="text-[11px] font-black text-primary">{subject.percentage}% completado</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}