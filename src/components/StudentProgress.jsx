import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { TrophyIcon, ChartBarIcon } from '@heroicons/react/24/solid'
// Asegúrate de tener estos iconos o usa los que prefieras

export default function StudentProgress({ userId }) {
  const [stats, setStats] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (userId) calculateProgress()
  }, [userId])

  const calculateProgress = async () => {
    try {
      // 1. Obtener mi curso actual
      const { data: enrollment } = await supabase
        .from('enrollments')
        .select('course_id')
        .eq('student_id', userId)
        .single()

      if (!enrollment) return

      // 2. Obtener las materias de mi curso
      const { data: classes } = await supabase
        .from('classes')
        .select(`
          subject_id,
          subjects (id, name, icon)
        `)
        .eq('course_id', enrollment.course_id)

      if (!classes) return

      // 3. Para cada materia, contar temas totales vs completados
      //    (Esta parte se podría optimizar con una Vista SQL, pero haremos JS por ahora)
      const progressPromises = classes.map(async (cls) => {
        const subject = cls.subjects
        
        // A. Contar Total de Temas de la materia
        const { count: totalTopics } = await supabase
          .from('topics')
          .select('*', { count: 'exact', head: true })
          .eq('subject_id', subject.id)

        // B. Contar Temas Completados por MÍ en esa materia
        const { count: completedTopics } = await supabase
          .from('student_progress')
          .select('*', { count: 'exact', head: true })
          .eq('student_id', userId)
          .eq('subject_id', subject.id)

        // C. Calcular Porcentaje
        const percentage = totalTopics === 0 ? 0 : Math.round((completedTopics / totalTopics) * 100)

        return {
          id: subject.id,
          name: subject.name,
          total: totalTopics,
          completed: completedTopics,
          percentage: percentage
        }
      })

      const results = await Promise.all(progressPromises)
      setStats(results)

    } catch (error) {
      console.error("Error calculando progreso:", error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div className="animate-pulse h-40 bg-base-200 rounded-xl"></div>

  return (
    <div className="card bg-base-100 shadow-xl border border-base-200">
      <div className="card-body">
        <h2 className="card-title text-lg flex gap-2">
          <ChartBarIcon className="w-6 h-6 text-primary"/>
          Mi Progreso Académico
        </h2>
        
        <div className="flex flex-col gap-4 mt-2">
          {stats.length === 0 ? (
            <p className="opacity-50 text-sm">No hay datos de materias aún.</p>
          ) : (
            stats.map((subject) => (
              <div key={subject.id}>
                <div className="flex justify-between items-end mb-1">
                  <span className="font-bold text-sm">{subject.name}</span>
                  <span className="text-xs font-mono opacity-60">
                    {subject.completed}/{subject.total} Temas
                  </span>
                </div>
                <div className="w-full bg-base-200 rounded-full h-3 overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-1000 ease-out flex items-center justify-center text-[8px] text-white font-bold ${
                        subject.percentage === 100 ? 'bg-success' : 'bg-primary'
                    }`}
                    style={{ width: `${subject.percentage}%` }}
                  >
                  </div>
                </div>
                <div className="text-right mt-1">
                    {subject.percentage === 100 ? (
                        <span className="badge badge-success badge-xs gap-1 text-[10px]">
                            <TrophyIcon className="w-3 h-3"/> Completado
                        </span>
                    ) : (
                        <span className="text-xs opacity-50">{subject.percentage}%</span>
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