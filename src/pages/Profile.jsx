import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Link, useNavigate } from 'react-router-dom' 
import Navbar from '../components/Navbar'
import Notification from '../components/Notification'
// Agregamos ArrowPathIcon para el botón de recargar avatar
import { UserCircleIcon, BriefcaseIcon, SparklesIcon, DevicePhoneMobileIcon, ArrowLeftIcon, ArrowPathIcon } from '@heroicons/react/24/outline'

export default function Profile() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [notification, setNotification] = useState({ msg: '', type: '' })
  
  // Datos del perfil
  const [id, setId] = useState(null)
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState('')
  const [email, setEmail] = useState('')
  
  // Campos editables
  const [bio, setBio] = useState('')
  const [phone, setPhone] = useState('')
  
  // Campos específicos
  const [nee, setNee] = useState('') // Estudiante
  const [specialty, setSpecialty] = useState('') // Tutor

  // ESTADO NUEVO: Semilla del Avatar
  const [avatarSeed, setAvatarSeed] = useState('')

  useEffect(() => {
    getProfile()
  }, [])

  const getProfile = async () => {
    try {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) throw new Error('No user found')

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (error) throw error

      setId(user.id)
      setEmail(user.email) 
      setFullName(data.full_name)
      setRole(data.role)
      setBio(data.bio || '')
      setPhone(data.phone || '')
      setNee(data.nee || '')
      setSpecialty(data.specialty || '')

      // LOGICA DE AVATAR: Cargar el existente o generar uno con el nombre
      if (data.avatar_url) {
        setAvatarSeed(data.avatar_url)
      } else {
        // Usamos 'avataaars' que es el estilo visual que te gustó
        setAvatarSeed(`https://api.dicebear.com/7.x/avataaars/svg?seed=${data.full_name}`)
      }

    } catch (error) {
      setNotification({ msg: error.message, type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  // FUNCIÓN: Generar Avatar Aleatorio
  const randomizeAvatar = (e) => {
    e.preventDefault()
    const randomString = Math.random().toString(36).substring(7)
    setAvatarSeed(`https://api.dicebear.com/7.x/avataaars/svg?seed=${randomString}`)
  }

  const updateProfile = async (e) => {
    e.preventDefault()
    setUpdating(true)
    try {
      const updates = {
        id,
        bio,
        phone,
        avatar_url: avatarSeed, // <--- GUARDAMOS LA URL DEL AVATAR
        nee: role === 'student' ? nee : null,
        specialty: role === 'tutor' ? specialty : null,
        updated_at: new Date(),
      }

      localStorage.setItem('senda-avatar', avatarSeed);
      const { error } = await supabase.from('profiles').upsert(updates)
      if (error) throw error
      
      setNotification({ msg: '¡Perfil actualizado correctamente!', type: 'success' })
      
      // REDIRECCIÓN SUAVE (Sin flash blanco)
      setTimeout(() => navigate('/dashboard'), 1000)

    } catch (error) {
      setNotification({ msg: error.message, type: 'error' })
    } finally {
      setUpdating(false)
    }
  }

  if (loading) return <div className="min-h-screen bg-base-200 flex items-center justify-center"><span className="loading loading-bars loading-lg text-primary"></span></div>

  return (
    <div className="min-h-screen bg-base-200 font-sans pb-20">
      <Navbar />
      <Notification message={notification.msg} type={notification.type} onClose={() => setNotification({ msg: '', type: '' })} />

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        
        {/* BOTÓN DE VOLVER */}
        <div className="mb-6">
            <Link to="/dashboard" className="btn btn-ghost hover:bg-base-300 gap-2 pl-0 transition-all hover:-translate-x-1">
                <ArrowLeftIcon className="w-5 h-5" />
                Volver al Dashboard
            </Link>
        </div>

        {/* ENCABEZADO PERFIL CON GENERADOR DE AVATAR */}
        <div className="card bg-base-100 shadow-xl border border-base-200 mb-8 overflow-hidden">
            <div className="h-32 bg-gradient-to-r from-primary to-secondary opacity-80"></div>
            <div className="card-body -mt-12 relative z-10">
                <div className="flex flex-col md:flex-row gap-6 items-center md:items-end">
                    
                    {/* ZONA DE AVATAR EDITABLE */}
                    <div className="relative group">
                        <div className="avatar">
                            <div className="w-28 rounded-full ring ring-base-100 ring-offset-base-100 ring-offset-4 bg-white shadow-lg transition-transform group-hover:scale-105">
                                <img src={avatarSeed} alt="Avatar" />
                            </div>
                        </div>
                        
                        {/* Botón Flotante para cambiar Avatar (CORREGIDO CENTRADO) */}
                        <button 
                            onClick={randomizeAvatar}
                            className="btn btn-circle btn-sm btn-primary absolute bottom-0 right-0 shadow-lg border-2 border-base-100 tooltip tooltip-right flex items-center justify-center p-0"
                            data-tip="¡Cambiar Look!"
                        >
                            <ArrowPathIcon className="w-4 h-4 text-white" />
                        </button>
                    </div>

                    <div className="flex-1 text-center md:text-left mb-2">
                        <h1 className="text-3xl font-bold">{fullName}</h1>
                        <p className="opacity-60 flex items-center justify-center md:justify-start gap-1">
                           {email} 
                           <span className="badge badge-sm badge-ghost">{role === 'student' ? 'Estudiante' : 'Tutor'}</span>
                        </p>
                    </div>
                </div>
            </div>
        </div>

        {/* FORMULARIO DE EDICIÓN */}
        <form onSubmit={updateProfile} className="grid grid-cols-1 md:grid-cols-3 gap-8">
            
            {/* COLUMNA IZQUIERDA: INFORMACIÓN BÁSICA */}
            <div className="md:col-span-1 space-y-6">
                 <div className="card bg-base-100 shadow-xl border border-base-200">
                    <div className="card-body">
                        <h3 className="card-title text-sm uppercase opacity-50 mb-4 flex items-center gap-2">
                            <UserCircleIcon className="w-5 h-5"/> Bio & Contacto
                        </h3>
                        
                        <div className="form-control">
                            <label className="label"><span className="label-text font-bold">Acerca de mí</span></label>
                            <textarea 
                                className="textarea textarea-bordered h-24" 
                                placeholder="Escribe algo sobre ti..."
                                value={bio}
                                onChange={(e) => setBio(e.target.value)}
                            ></textarea>
                        </div>

                        <div className="form-control mt-4">
                            <label className="label"><span className="label-text font-bold">Teléfono</span></label>
                            <div className="relative">
                                <DevicePhoneMobileIcon className="w-5 h-5 absolute top-3 left-3 opacity-50"/>
                                <input 
                                    type="tel" 
                                    className="input input-bordered w-full pl-10" 
                                    placeholder="099..."
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>
                 </div>
            </div>

            {/* COLUMNA DERECHA: INFORMACIÓN ESPECÍFICA */}
            <div className="md:col-span-2">
                <div className="card bg-base-100 shadow-xl border border-base-200 h-full">
                    <div className="card-body">
                        {role === 'student' ? (
                            <>
                                <h3 className="card-title text-primary mb-2 flex items-center gap-2">
                                    <SparklesIcon className="w-6 h-6"/> Perfil de Aprendizaje
                                </h3>
                                <p className="text-sm opacity-70 mb-6">
                                    Ayuda a tus tutores a entender mejor cómo aprendes. Si tienes alguna Necesidad Educativa Especial (NEE) o preferencia, descríbela aquí.
                                </p>
                                <div className="form-control">
                                    <label className="label">
                                        <span className="label-text font-bold">Mis Necesidades / Preferencias (NEE)</span>
                                    </label>
                                    <textarea 
                                        className="textarea textarea-bordered textarea-primary h-40 bg-base-200 focus:bg-base-100 transition-colors text-lg" 
                                        placeholder="Ej: Necesito material con letra grande, prefiero explicaciones visuales, utilizo lector de pantalla..."
                                        value={nee}
                                        onChange={(e) => setNee(e.target.value)}
                                    ></textarea>
                                </div>
                            </>
                        ) : (
                            <>
                                <h3 className="card-title text-secondary mb-2 flex items-center gap-2">
                                    <BriefcaseIcon className="w-6 h-6"/> Perfil Profesional
                                </h3>
                                <p className="text-sm opacity-70 mb-6">
                                    Describe tu especialidad para que los estudiantes correctos te encuentren.
                                </p>
                                <div className="form-control">
                                    <label className="label">
                                        <span className="label-text font-bold">Mi Especialidad / Experiencia</span>
                                    </label>
                                    <textarea 
                                        className="textarea textarea-bordered textarea-secondary h-40 bg-base-200 focus:bg-base-100 transition-colors text-lg" 
                                        placeholder="Ej: Experto en Lengua de Señas, Matemáticas Adaptadas, Programación Básica..."
                                        value={specialty}
                                        onChange={(e) => setSpecialty(e.target.value)}
                                    ></textarea>
                                </div>
                            </>
                        )}

                        <div className="card-actions justify-end mt-8">
                            <button type="submit" className="btn btn-primary btn-wide shadow-lg" disabled={updating}>
                                {updating ? <span className="loading loading-spinner"></span> : 'Guardar Cambios'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

        </form>
      </main>
    </div>
  )
}