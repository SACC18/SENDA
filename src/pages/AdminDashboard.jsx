import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { supabaseAdmin } from '../lib/supabaseAdmin'
import {
    UsersIcon, AcademicCapIcon, ShieldCheckIcon, PlusCircleIcon,
    TrophyIcon, BookOpenIcon, TrashIcon, BriefcaseIcon, ExclamationTriangleIcon, PencilSquareIcon
} from '@heroicons/react/24/outline'

export default function AdminDashboard({ session, onNotify }) {
    const [users, setUsers] = useState([])
    const [loading, setLoading] = useState(true)

    // CATÁLOGOS
    const [careers, setCareers] = useState([])
    const [levels, setLevels] = useState([])

    // ESTADOS CREACIÓN USUARIOS
    const [isCreatingUser, setIsCreatingUser] = useState(false)
    const [newUserForm, setNewUserForm] = useState({ email: '', password: '', nombre: '', apellido: '', role: 'student' })

    // ESTADOS MATRICULAR ESTUDIANTES
    const [selectedStudent, setSelectedStudent] = useState(null)
    const [selectedCareerId, setSelectedCareerId] = useState('')
    const [selectedLevelId, setSelectedLevelId] = useState('')
    const [isEnrolling, setIsEnrolling] = useState(false)

    // ESTADOS ASIGNAR MATERIAS A TUTORES 
    const [selectedTutor, setSelectedTutor] = useState(null)
    const [tutorCareerId, setTutorCareerId] = useState('')
    const [tutorLevelId, setTutorLevelId] = useState('')
    const [courseClasses, setCourseClasses] = useState([])
    const [isAssigningTutor, setIsAssigningTutor] = useState(false)

    // ESTADO MODAL ADVERTENCIA 
    const [warningData, setWarningData] = useState({ type: '', user: null })

    // ESTADO ELIMINACIÓN
    const [isDeleting, setIsDeleting] = useState(null)

    // CARGA INICIAL
    useEffect(() => {
        fetchUsers()
        fetchCareersAndLevels()
    }, [])

    const fetchUsers = async () => {
        setLoading(true)
        try {
            const { data: profiles, error: profilesError } = await supabaseAdmin
                .from('profiles')
                .select(`id, full_name, role, avatar_url, nee, specialty`)
                .order('role', { ascending: true })

            if (profilesError) throw profilesError

            const { data: enrollments } = await supabaseAdmin.from('student_enrollments').select('student_id')
            const { data: classes } = await supabaseAdmin.from('classes').select('tutor_id')

            const enrolledStudentIds = new Set(enrollments?.map(e => e.student_id) || [])
            const assignedTutorIds = new Set(classes?.filter(c => c.tutor_id).map(c => c.tutor_id) || [])

            const mergedUsers = profiles.map(user => ({
                ...user,
                hasStudentData: enrolledStudentIds.has(user.id),
                hasTutorData: assignedTutorIds.has(user.id)
            }))

            setUsers(mergedUsers)
        } catch (error) {
            onNotify('Error al cargar usuarios', 'error')
        } finally {
            setLoading(false)
        }
    }

    const fetchCareersAndLevels = async () => {
        const { data: careersData } = await supabase.from('careers').select('id, name').order('name')
        const { data: levelsData } = await supabase.from('levels').select('id, name, level_order').order('level_order')
        setCareers(careersData || [])
        setLevels(levelsData || [])
    }

    const handleActionClick = (type, user, hasData) => {
        if (hasData) {
            setWarningData({ type, user })
            document.getElementById('warning_modal').showModal();
        } else {
            if (type === 'student') openEnrollModal(user)
            if (type === 'tutor') openTutorModal(user)
        }
    }

    const proceedFromWarning = () => {
        const { type, user } = warningData
        document.getElementById('warning_modal').close();
        if (type === 'student') openEnrollModal(user)
        if (type === 'tutor') openTutorModal(user)
    }

    const openEnrollModal = (student) => {
        setSelectedStudent(student)
        setSelectedCareerId('')
        setSelectedLevelId('')
        document.getElementById('enroll_modal').showModal();
    }

    const openTutorModal = (tutor) => {
        setSelectedTutor(tutor)
        setTutorCareerId('')
        setTutorLevelId('')
        setCourseClasses([])
        document.getElementById('tutor_modal').showModal();
    }

    const closeAllModals = () => {
        document.getElementById('warning_modal')?.close();
        document.getElementById('enroll_modal')?.close();
        document.getElementById('tutor_modal')?.close();
        document.getElementById('create_user_modal')?.close();
    }

    const handleEnrollStudent = async () => {
        if (!selectedCareerId || !selectedLevelId) return onNotify('Selecciona Carrera y Nivel', 'error')
        setIsEnrolling(true)
        try {
            const { data: courseData } = await supabase.from('courses').select('id').eq('career_id', selectedCareerId).eq('level_id', selectedLevelId).single()
            if (!courseData) throw new Error("No existe un Curso configurado para esta Carrera y Nivel.")

            const { error: enrollError } = await supabaseAdmin.from('student_enrollments').upsert({
                student_id: selectedStudent.id, career_id: selectedCareerId, level_id: selectedLevelId
            }, { onConflict: 'student_id' })
            if (enrollError) throw enrollError

            await fetchUsers()
            onNotify(` ${selectedStudent.full_name} matriculado correctamente.`, 'success')
            document.getElementById('enroll_modal').close();
        } catch (error) {
            onNotify('Error: ' + error.message, 'error')
        } finally {
            setIsEnrolling(false)
        }
    }

    useEffect(() => {
        const searchClassesForTutor = async () => {
            if (!tutorCareerId || !tutorLevelId) return
            try {
                const { data: courseData } = await supabase.from('courses').select('id').eq('career_id', tutorCareerId).eq('level_id', tutorLevelId).single()
                if (!courseData) {
                    setCourseClasses([])
                    return onNotify('No hay un curso configurado para esta combinación.', 'warning')
                }

                const { data: classesData, error } = await supabase.from('classes').select(`id, subject_id, subjects(name), tutor_id, profiles!tutor_id(full_name)`).eq('course_id', courseData.id)
                if (error) throw error

                const formattedClasses = classesData.map(c => ({
                    class_id: c.id, subject_name: c.subjects?.name, current_tutor_name: c.profiles?.full_name || 'Sin Asignar',
                    is_assigned: c.tutor_id === selectedTutor?.id
                }))
                setCourseClasses(formattedClasses)
            } catch (error) {
                onNotify('Error al buscar materias', 'error')
            }
        }
        searchClassesForTutor()
    }, [tutorCareerId, tutorLevelId, selectedTutor, onNotify])

    const handleToggleClass = (classId) => {
        setCourseClasses(prev => prev.map(c => c.class_id === classId ? { ...c, is_assigned: !c.is_assigned } : c))
    }

    const saveTutorAssignments = async () => {
        setIsAssigningTutor(true)
        try {
            for (const cls of courseClasses) {
                if (cls.is_assigned) {
                    await supabase.from('classes').update({ tutor_id: selectedTutor.id }).eq('id', cls.class_id)
                } else if (!cls.is_assigned && cls.current_tutor_name === selectedTutor.full_name) {
                    await supabase.from('classes').update({ tutor_id: null }).eq('id', cls.class_id)
                }
            }
            await fetchUsers()
            onNotify('Materias guardadas exitosamente.', 'success')
            document.getElementById('tutor_modal').close();
        } catch (error) {
            onNotify('Error al guardar asignación', 'error')
        } finally {
            setIsAssigningTutor(false)
        }
    }

    const handleDeleteUser = async (userId) => {
        if (!window.confirm("¿Estás seguro de BORRAR este usuario? Esta acción es irreversible.")) return
        setIsDeleting(userId)
        try {
            const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId)
            if (authError) throw authError
            setUsers(prev => prev.filter(u => u.id !== userId))
            onNotify('Usuario eliminado del sistema', 'success')
        } catch (error) {
            onNotify('Error al eliminar: ' + error.message, 'error')
        } finally {
            setIsDeleting(null)
        }
    }

    const handleCreateNewUser = async (e) => {
        e.preventDefault()
        setIsCreatingUser(true)
        try {
            const fullName = `${newUserForm.nombre} ${newUserForm.apellido}`.trim()
            const fixedAvatarUrl = `https://api.dicebear.com/7.x/notionists/svg?seed=${newUserForm.nombre}${newUserForm.apellido}`

            const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
                email: newUserForm.email, password: newUserForm.password, email_confirm: true,
                user_metadata: { full_name: fullName, role: newUserForm.role, avatar_url: fixedAvatarUrl }
            })
            if (authError) throw authError

            await supabaseAdmin.from('profiles').update({ full_name: fullName, role: newUserForm.role, avatar_url: fixedAvatarUrl }).eq('id', authData.user.id)

            onNotify('Usuario creado. Ahora haz clic en "Asignar Carga" en la tabla.', 'success')
            setNewUserForm({ email: '', password: '', nombre: '', apellido: '', role: 'student' })
            document.getElementById('create_user_modal').close();
            fetchUsers()
        } catch (error) {
            onNotify('Error al crear: ' + error.message, 'error')
        } finally {
            setIsCreatingUser(false)
        }
    }

    const handleRoleChange = async (userId, newRole) => {
        try {
            await supabase.from('profiles').update({ role: newRole }).eq('id', userId)
            setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u))
            onNotify(`Rol actualizado a ${newRole}`, 'success')
        } catch (error) {
            onNotify('Error al cambiar rol', 'error')
        }
    }

    return (
        <div className="max-w-7xl mx-auto animate-fade-in mb-8">

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="stat bg-base-100 shadow-sm border border-base-200 rounded-box">
                    <div className="stat-figure text-primary"><UsersIcon className="w-8 h-8" /></div>
                    <div className="stat-title font-semibold opacity-60">Total Usuarios</div>
                    <div className="stat-value text-primary">{users.length}</div>
                </div>
                <div className="stat bg-base-100 shadow-sm border border-base-200 rounded-box">
                    <div className="stat-figure text-secondary"><AcademicCapIcon className="w-8 h-8" /></div>
                    <div className="stat-title font-semibold opacity-60">Estudiantes</div>
                    <div className="stat-value text-secondary">{users.filter(u => u.role === 'student').length}</div>
                </div>
                <div className="stat bg-base-100 shadow-sm border border-base-200 rounded-box">
                    <div className="stat-figure text-accent"><ShieldCheckIcon className="w-8 h-8" /></div>
                    <div className="stat-title font-semibold opacity-60">Personal</div>
                    <div className="stat-value text-accent">{users.filter(u => u.role !== 'student').length}</div>
                </div>
            </div>

            <div className="bg-base-100 rounded-box shadow-xl border border-base-200 overflow-hidden mb-8">
                <div className="p-6 border-b border-base-200 flex justify-between items-center bg-base-200/50">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <TrophyIcon className="w-6 h-6 text-primary" /> Directorio y Permisos
                    </h2>
                    <button className="btn btn-primary btn-sm" onClick={() => document.getElementById('create_user_modal').showModal()}>
                        <PlusCircleIcon className="w-4 h-4" /> Crear Usuario
                    </button>
                </div>

                <div className="overflow-x-auto">
                    <table className="table table-zebra w-full">
                        <thead>
                            <tr>
                                <th>Usuario</th>
                                <th>Acciones Académicas</th>
                                <th>Rol en el Sistema</th>
                                <th>Eliminar</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan="4" className="text-center py-10"><span className="loading loading-spinner loading-lg text-primary"></span></td></tr>
                            ) : users.map(user => {
                                const isAdminSelf = user.id === session?.user?.id;
                                const isStudent = user.role === 'student';
                                const isTutor = user.role === 'tutor';

                                return (
                                    <tr key={user.id} className="hover">
                                        <td>
                                            <div className="flex items-center gap-3">
                                                <div className="avatar">
                                                    <div className="mask mask-squircle h-12 w-12 bg-base-300">
                                                        <img src={user.avatar_url || `https://api.dicebear.com/7.x/notionists/svg?seed=${user.full_name}`} alt="Avatar" />
                                                    </div>
                                                </div>
                                                <div>
                                                    <div className="font-bold">{user.full_name || 'Usuario Sin Nombre'}</div>
                                                    <div className="text-xs opacity-50 font-mono">ID: {user.id.substring(0, 8)}...</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            {isStudent && (
                                                <button
                                                    onClick={() => handleActionClick('student', user, user.hasStudentData)}
                                                    className={`btn btn-sm gap-2 transition-all ${user.hasStudentData ? 'btn-secondary' : 'btn-outline btn-primary'}`}
                                                >
                                                    {user.hasStudentData ? <PencilSquareIcon className="h-4 w-4" /> : <BookOpenIcon className="h-4 w-4" />}
                                                    {user.hasStudentData ? 'Editar Carga' : 'Asignar Nivel'}
                                                </button>
                                            )}
                                            {isTutor && (
                                                <button
                                                    onClick={() => handleActionClick('tutor', user, user.hasTutorData)}
                                                    className={`btn btn-sm gap-2 transition-all ${user.hasTutorData ? 'btn-secondary' : 'btn-outline btn-info'}`}
                                                >
                                                    {user.hasTutorData ? <PencilSquareIcon className="h-4 w-4" /> : <BriefcaseIcon className="h-4 w-4" />}
                                                    {user.hasTutorData ? 'Editar Materias' : 'Asignar Materias'}
                                                </button>
                                            )}
                                            {(!isStudent && !isTutor) && (
                                                <span className="text-xs opacity-30 italic px-2">No requiere</span>
                                            )}
                                        </td>
                                        <td>
                                            <select
                                                className="select select-neutral select-sm w-full max-w-xs font-semibold"
                                                value={user.role}
                                                onChange={(e) => handleRoleChange(user.id, e.target.value)}
                                                disabled={isAdminSelf}
                                            >
                                                <option disabled={true} value="">Rol en Sistema</option>
                                                <option value="student">Estudiante</option>
                                                <option value="tutor">Tutor</option>
                                                <option value="coordinator">Coordinador</option>
                                                {user.role === 'admin' && <option value="admin">Administrador</option>}
                                            </select>
                                        </td>
                                        <th>
                                            {!isAdminSelf && (
                                                <button
                                                    onClick={() => handleDeleteUser(user.id)}
                                                    className="btn btn-ghost btn-xs text-error hover:bg-error/10"
                                                    disabled={isDeleting === user.id}
                                                >
                                                    {isDeleting === user.id ? <span className="loading loading-spinner loading-xs"></span> : <TrashIcon className="h-5 w-5" />}
                                                </button>
                                            )}
                                        </th>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            <dialog id="create_user_modal" className="modal modal-bottom sm:modal-middle">
                <div className="modal-box max-w-2xl">
                    <h3 className="font-bold text-lg">Crear Nuevo Usuario</h3>
                    <p className="py-4 text-slate-500">Ingresa los datos. Recuerda asignar la carga desde la tabla después.</p>
                    <form onSubmit={handleCreateNewUser} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="form-control">
                            <label className="label"><span className="label-text">Nombre</span></label>
                            <input type="text" required className="input input-bordered" value={newUserForm.nombre} onChange={e => setNewUserForm({ ...newUserForm, nombre: e.target.value })} />
                        </div>
                        <div className="form-control">
                            <label className="label"><span className="label-text">Apellido</span></label>
                            <input type="text" required className="input input-bordered" value={newUserForm.apellido} onChange={e => setNewUserForm({ ...newUserForm, apellido: e.target.value })} />
                        </div>
                        <div className="form-control sm:col-span-2">
                            <label className="label"><span className="label-text">Correo Electrónico</span></label>
                            <input type="email" required className="input input-bordered" value={newUserForm.email} onChange={e => setNewUserForm({ ...newUserForm, email: e.target.value })} />
                        </div>
                        <div className="form-control">
                            <label className="label"><span className="label-text">Contraseña (Mín. 6)</span></label>
                            <input type="text" required className="input input-bordered" minLength="6" value={newUserForm.password} onChange={e => setNewUserForm({ ...newUserForm, password: e.target.value })} />
                        </div>
                        <div className="form-control">
                            <label className="label"><span className="label-text">Rol Inicial</span></label>
                            <select className="select select-neutral w-full" value={newUserForm.role} onChange={e => setNewUserForm({ ...newUserForm, role: e.target.value })}>
                                <option disabled={true} value="">Elige el Rol</option>
                                <option value="student">Estudiante</option>
                                <option value="tutor">Tutor Académico</option>
                                <option value="coordinator">Coordinador</option>
                            </select>
                        </div>
                        <div className="modal-action sm:col-span-2 mt-6 flex justify-end gap-2">
                            <button type="button" className="btn btn-ghost" onClick={closeAllModals}>Cancelar</button>
                            <button type="submit" className="btn btn-primary" disabled={isCreatingUser}>
                                {isCreatingUser ? <span className="loading loading-spinner loading-xs"></span> : 'Guardar Usuario'}
                            </button>
                        </div>
                    </form>
                </div>
                <form method="dialog" className="modal-backdrop"><button>close</button></form>
            </dialog>

            <dialog id="warning_modal" className="modal">
                <div className="modal-box border-t-4 border-warning">
                    <h3 className="font-bold text-lg text-warning flex items-center gap-2">
                        <ExclamationTriangleIcon className="h-6 w-6" /> ¡Atención!
                    </h3>
                    <p className="py-4 text-base-content/70">
                        <strong>{warningData.user?.full_name}</strong> ya tiene una configuración académica.
                        Si guardas nuevos cambios, modificarás su estructura de forma permanente.
                    </p>
                    <div className="modal-action">
                        <button type="button" className="btn btn-ghost" onClick={closeAllModals}>Cancelar</button>
                        <button type="button" className="btn btn-warning text-warning-content" onClick={proceedFromWarning}>Entendido, Continuar</button>
                    </div>
                </div>
                <form method="dialog" className="modal-backdrop"><button>close</button></form>
            </dialog>

            <dialog id="enroll_modal" className="modal modal-bottom sm:modal-middle">
                <div className="modal-box">
                    <h3 className="font-bold text-lg">Matricular Estudiante</h3>
                    <p className="py-2 text-sm opacity-70">Alumno: <strong>{selectedStudent?.full_name}</strong></p>

                    <div className="form-control w-full mt-4">
                        <label className="label"><span className="label-text font-bold">1. Seleccionar Carrera</span></label>
                        <select className="select select-neutral w-full" value={selectedCareerId} onChange={(e) => setSelectedCareerId(e.target.value)}>
                            <option value="" disabled>-- Elige la Carrera --</option>
                            {careers.map(career => <option key={career.id} value={career.id}>{career.name}</option>)}
                        </select>
                    </div>
                    <div className="form-control w-full mt-4 mb-8">
                        <label className="label"><span className="label-text font-bold">2. Seleccionar Nivel</span></label>
                        <select className="select select-neutral w-full" value={selectedLevelId} onChange={(e) => setSelectedLevelId(e.target.value)}>
                            <option value="" disabled>-- Elige el Nivel --</option>
                            {levels.map(level => <option key={level.id} value={level.id}>{level.name}</option>)}
                        </select>
                    </div>
                    <div className="modal-action gap-2">
                        <button type="button" className="btn btn-ghost" onClick={closeAllModals}>Cancelar</button>
                        <button type="button" className="btn btn-primary" onClick={handleEnrollStudent} disabled={isEnrolling || !selectedCareerId || !selectedLevelId}>
                            {isEnrolling ? <span className="loading loading-spinner loading-xs"></span> : 'Guardar Matrícula'}
                        </button>
                    </div>
                </div>
                <form method="dialog" className="modal-backdrop"><button>close</button></form>
            </dialog>

            <dialog id="tutor_modal" className="modal modal-bottom sm:modal-middle">
                <div className="modal-box max-w-2xl">
                    <h3 className="font-bold text-lg">Asignar Materias</h3>
                    <p className="py-2 text-sm opacity-70">Profesor: <strong>{selectedTutor?.full_name}</strong></p>

                    <div className="grid grid-cols-2 gap-4 mt-4">
                        <div className="form-control w-full">
                            <label className="label"><span className="label-text font-bold">Carrera</span></label>
                            <select className="select select-neutral w-full" value={tutorCareerId} onChange={(e) => setTutorCareerId(e.target.value)}>
                                <option value="" disabled>-- Selecciona --</option>
                                {careers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                        <div className="form-control w-full">
                            <label className="label"><span className="label-text font-bold">Nivel</span></label>
                            <select className="select select-neutral w-full" value={tutorLevelId} onChange={(e) => setTutorLevelId(e.target.value)}>
                                <option value="" disabled>-- Selecciona --</option>
                                {levels.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="bg-base-200 rounded-box p-4 mt-6 min-h-[150px] max-h-[300px] overflow-y-auto border border-base-200 subject-list">
                        {!tutorCareerId || !tutorLevelId ? (
                            <p className="text-center text-sm opacity-50 py-10">Selecciona Carrera y Nivel arriba.</p>
                        ) : courseClasses.length === 0 ? (
                            <p className="text-center text-sm text-error py-10">No hay materias registradas en este nivel.</p>
                        ) : (
                            <div className="flex flex-col gap-2">
                                <p className="text-xs font-bold uppercase opacity-50 mb-2">Selecciona las materias:</p>
                                {courseClasses.map(cls => (
                                    <div key={cls.class_id} className="form-control subject-item">
                                        <label className="label cursor-pointer justify-start gap-4 p-3 bg-base-100 rounded-box border border-base-200 hover:bg-base-200 transition-all">
                                            <input type="checkbox" className="checkbox checkbox-info checkbox-sm" checked={cls.is_assigned} onChange={() => handleToggleClass(cls.class_id)} />
                                            <div>
                                                <span className="label-text font-bold text-base">{cls.subject_name}</span>
                                                {!cls.is_assigned && cls.current_tutor_name !== 'Sin Asignar' && (
                                                    <div className="text-xs text-error mt-1 font-semibold">⚠️ Dictada por: {cls.current_tutor_name}</div>
                                                )}
                                                {cls.is_assigned && (
                                                    <div className="text-xs text-info mt-1 font-bold">✓ Será asignada a este tutor</div>
                                                )}
                                            </div>
                                        </label>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="modal-action mt-6 mt-6 flex justify-end gap-2">
                        <button type="button" className="btn btn-ghost" onClick={closeAllModals}>Cancelar</button>
                        <button type="button" className="btn btn-info text-white" onClick={saveTutorAssignments} disabled={isAssigningTutor || courseClasses.length === 0}>
                            {isAssigningTutor ? <span className="loading loading-spinner loading-xs"></span> : 'Guardar Cambios'}
                        </button>
                    </div>
                </div>
                <form method="dialog" className="modal-backdrop"><button>close</button></form>
            </dialog>

        </div>
    )
}