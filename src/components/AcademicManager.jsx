import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { BookOpenIcon, ChevronRightIcon, CheckCircleIcon, LockClosedIcon, LockOpenIcon } from '@heroicons/react/24/outline'

export default function AcademicManager({ userId, onNotify }) {
  const [classes, setClasses] = useState([])
  const [selectedClass, setSelectedClass] = useState(null)
  const [topics, setTopics] = useState([])
  const [loading, setLoading] = useState(false)

  // 1. Cargar las clases que dicta este tutor
  useEffect(() => {
    async function fetchMyClasses() {
      const { data } = await supabase
        .from('classes')
        .select(`
            id,
            subject_id,
            courses (name),
            subjects (id, name, icon) 
        `)
        .eq('tutor_id', userId)
      setClasses(data || [])
    }
    if (userId) fetchMyClasses()
  }, [userId])

  // 2. Al seleccionar una clase, cargar sus temas y el estado de visibilidad
  const handleSelectClass = async (classItem) => {
    setSelectedClass(classItem)
    setLoading(true)
    
    // A. Traer todos los temas de esa materia
    const { data: allTopics } = await supabase
        .from('topics')
        .select('*')
        .eq('subject_id', classItem.subjects.id || classItem.subject_id) // Ajuste defensivo
        .order('unit_number', { ascending: true })
        .order('id', { ascending: true })

    // B. Traer los estados activos para ESTA clase específica
    const { data: visibility } = await supabase
        .from('class_topic_visibility')
        .select('topic_id, is_active')
        .eq('class_id', classItem.id)

    // C. Cruzar la información (Merge)
    const mergedTopics = allTopics.map(topic => {
        const status = visibility.find(v => v.topic_id === topic.id)
        return { ...topic, is_active: status ? status.is_active : false } // Por defecto false/oculto
    })

    setTopics(mergedTopics)
    setLoading(false)
  }

  // 3. Activar/Desactivar Tema
  const toggleTopic = async (topic) => {
    const newStatus = !topic.is_active
    
    // Actualizamos optimísticamente en la UI para que se sienta rápido
    setTopics(prev => prev.map(t => t.id === topic.id ? { ...t, is_active: newStatus } : t))

    try {
        const { error } = await supabase
            .from('class_topic_visibility')
            .upsert({ 
                class_id: selectedClass.id, 
                topic_id: topic.id, 
                is_active: newStatus 
            }, { onConflict: 'class_id, topic_id' })

        if (error) throw error
        onNotify(newStatus ? `Tema "${topic.name}" activado` : `Tema ocultado`, 'success')
    } catch (error) {
        onNotify('Error al guardar: ' + error.message, 'error')
        // Revertir UI si falla
        setTopics(prev => prev.map(t => t.id === topic.id ? { ...t, is_active: !newStatus } : t))
    }
  }

  return (
    <div className="bg-base-100 rounded-3xl shadow-xl border border-base-200 p-6 min-h-[500px]">
        <div className="mb-6 flex justify-between items-center">
            <h2 className="text-2xl font-bold flex items-center gap-2">
                <BookOpenIcon className="w-7 h-7 text-secondary"/> 
                Gestión Académica
            </h2>
            {selectedClass && (
                <button onClick={() => setSelectedClass(null)} className="btn btn-sm btn-ghost">
                    Cambiar Materia
                </button>
            )}
        </div>

        {!selectedClass ? (
            // VISTA 1: LISTA DE CLASES
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {classes.length === 0 && <p className="opacity-50">No tienes materias asignadas.</p>}
                {classes.map(cls => (
                    <button key={cls.id} onClick={() => handleSelectClass(cls)} className="card bg-base-200 hover:bg-base-300 transition-all text-left border-l-4 border-secondary">
                        <div className="card-body p-5">
                            <h3 className="font-bold text-lg">{cls.subjects?.name || 'Materia'}</h3>
                            <p className="text-sm opacity-60 uppercase tracking-wide">{cls.courses?.name}</p>
                            <div className="flex justify-end mt-2"><ChevronRightIcon className="w-5 h-5 opacity-50"/></div>
                        </div>
                    </button>
                ))}
            </div>
        ) : (
            // VISTA 2: LISTA DE TEMAS (TOGGLES)
            <div className="animate-fade-in-right">
                <div className="bg-secondary/10 p-4 rounded-xl mb-6 border border-secondary/20">
                    <span className="text-xs font-bold uppercase opacity-50 block">Gestionando:</span>
                    <span className="font-bold text-xl">{selectedClass.subjects?.name}</span>
                    <span className="ml-2 opacity-60">- {selectedClass.courses?.name}</span>
                </div>

                {loading ? <span className="loading loading-spinner text-secondary"></span> : (
                    <div className="space-y-3">
                        {topics.map(topic => (
                            <div key={topic.id} className={`flex items-center justify-between p-4 rounded-lg border transition-all ${topic.is_active ? 'bg-base-100 border-success shadow-sm' : 'bg-base-200/50 border-transparent opacity-60'}`}>
                                <div className="flex-1 pr-4">
                                    <div className="badge badge-xs mb-1">Unidad {topic.unit_number}</div>
                                    <p className={`font-semibold ${topic.is_active ? 'text-base-content' : 'text-base-content/50'}`}>{topic.name}</p>
                                </div>
                                <label className="swap swap-rotate btn btn-circle btn-sm btn-ghost">
                                    <input type="checkbox" checked={topic.is_active} onChange={() => toggleTopic(topic)} />
                                    <LockOpenIcon className="swap-on w-6 h-6 text-success" />
                                    <LockClosedIcon className="swap-off w-6 h-6 text-base-content/30" />
                                </label>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        )}
    </div>
  )
}