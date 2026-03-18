import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import "cally";
import {
  BookOpenIcon, StarIcon, CheckCircleIcon,
  FunnelIcon, MagnifyingGlassIcon, CalendarDaysIcon, XCircleIcon
} from '@heroicons/react/24/outline'

const printStyles = `
  @media print {
    @page { size: A4 landscape; margin: 10mm; }
    body { background: white !important; color: black !important; font-family: sans-serif; }
    .navbar, .no-print, button, select, .dropdown { display: none !important; }
    .overflow-x-auto, .overflow-hidden { overflow: visible !important; display: block !important; max-height: none !important; }
    table { width: 100% !important; border-collapse: collapse !important; font-size: 9pt !important; }
    th { background-color: #f3f4f6 !important; border: 1px solid #000 !important; padding: 8px; text-transform: uppercase; }
    td { border: 1px solid #d1d5db !important; padding: 6px; }
    .print-header { display: block !important; text-align: center; margin-bottom: 20px; }
  }
  @media screen { .print-header { display: none; } }
`

const StarRating = ({ rating }) => {
  if (rating === undefined || rating === null) return <span className="text-[10px] opacity-40 italic">Sin calificar</span>;
  return (
    <div className="flex items-center gap-1 justify-center text-warning font-black">
      <StarIcon className="w-3 h-3 fill-current" />
      <span className="text-[11px]">{Number(rating).toFixed(1)}/5</span>
    </div>
  )
}

export default function CoordinatorDashboard({ onNotify }) {
  const [loading, setLoading] = useState(false)
  const [loadingInitial, setLoadingInitial] = useState(true)
  const [allAppointments, setAllAppointments] = useState([])
  const [reportData, setReportData] = useState([])
  const [filters, setFilters] = useState({ startDate: '', endDate: '', tutorId: '', careerId: '', levelId: '', subjectId: '', status: '' })

  const safe = (data) => {
    if (!data) return [];
    return Array.isArray(data) ? data : [data];
  };

  useEffect(() => {
    const fetchEverything = async () => {
      try {
        const { data: apps, error } = await supabase
          .from('appointments')
          .select(`
                    id, created_at, status, topic, tutor_feedback, cancellation_reason,
                    slot:availability_slots!slot_id(start_time),
                    tutor:profiles!tutor_id(id, full_name),
                    subject:subjects!subject_id(id, name),
                    student:profiles!student_id(
                        id, full_name, nee,
                        enrollments:student_enrollments(career:careers(id, name), level:levels(id, name))
                    ),
                    feedback(student_rating, tech_tools_worked)
                `)
          .in('status', ['completed', 'cancelled'])
          .order('created_at', { ascending: false })

        if (error) throw error
        setAllAppointments(apps || [])
        setReportData(apps || [])
      } catch (error) {
        console.error("Error cargando datos:", error)
      } finally {
        setLoadingInitial(false)
      }
    }
    fetchEverything()
  }, [])

  // CATÁLOGOS DINÁMICOS EN CASCADA
  const catalogs = useMemo(() => {
    let base = allAppointments;
    if (filters.tutorId) base = base.filter(a => String(a.tutor?.id) === String(filters.tutorId));

    const tutors = Array.from(new Map(allAppointments.map(a => [a.tutor?.id, a.tutor])).values()).filter(Boolean);
    const careers = Array.from(new Map(base.flatMap(a => safe(a.student?.enrollments).map(e => [e.career?.id, e.career]))).values()).filter(Boolean);
    const levels = Array.from(new Map(base.flatMap(a => safe(a.student?.enrollments).map(e => [e.level?.id, e.level]))).values()).filter(Boolean);
    const subjects = Array.from(new Map(base.map(a => [a.subject?.id, a.subject])).values()).filter(Boolean);

    return { tutors, careers, levels, subjects };
  }, [allAppointments, filters.tutorId]);

  // FILTRADO 
  const applyFilters = () => {
    setLoading(true)
    let filtered = [...allAppointments]

    if (filters.startDate) filtered = filtered.filter(a => new Date(a.slot?.start_time || a.created_at) >= new Date(filters.startDate + 'T00:00:00'))
    if (filters.endDate) filtered = filtered.filter(a => new Date(a.slot?.start_time || a.created_at) <= new Date(filters.endDate + 'T23:59:59'))

    if (filters.status) filtered = filtered.filter(a => a.status === filters.status)
    if (filters.tutorId) filtered = filtered.filter(a => String(a.tutor?.id) === String(filters.tutorId))
    if (filters.subjectId) filtered = filtered.filter(a => String(a.subject?.id) === String(filters.subjectId))

    if (filters.careerId) filtered = filtered.filter(a => safe(a.student?.enrollments).some(e => String(e.career?.id) === String(filters.careerId)))
    if (filters.levelId) filtered = filtered.filter(a => safe(a.student?.enrollments).some(e => String(e.level?.id) === String(filters.levelId)))

    setReportData(filtered)
    setLoading(false)
  }

  const resetFilters = () => {
    setFilters({ startDate: '', endDate: '', tutorId: '', careerId: '', levelId: '', subjectId: '', status: '' })
    setReportData(allAppointments)
  }

  // ESTADÍSTICAS 
  const stats = useMemo(() => {
    const completed = reportData.filter(a => a.status === 'completed')
    const cancelled = reportData.filter(a => a.status === 'cancelled')
    let stars = 0, countFB = 0, techOK = 0

    completed.forEach(a => {
      const fb = safe(a.feedback)[0]
      if (fb && fb.student_rating) {
        stars += Number(fb.student_rating);
        countFB++;
        if (fb.tech_tools_worked === true) techOK++;
      }
    })

    return {
      impartidas: completed.length,
      canceladas: cancelled.length,
      avg: countFB > 0 ? (stars / countFB).toFixed(1) : "0",
      tech: countFB > 0 ? Math.round((techOK / countFB) * 100) : 0
    }
  }, [reportData])

  if (loadingInitial) return <div className="py-20 flex justify-center"><span className="loading loading-infinity loading-lg text-primary"></span></div>

  return (
    <div className="w-full animate-fade-in mb-10 px-4">
      <style>{printStyles}</style>

      <div id="coordinator-report" className="flex flex-col gap-6 max-w-7xl mx-auto">
        <div className="print-header hidden">
          <h1 className="text-2xl font-black">REPORTE DE TUTORÍAS INSTITUCIONALES</h1>
          <p>SENDA | {new Date().toLocaleDateString()}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 no-print">
          <div className="bg-base-100 p-5 rounded-box shadow-sm border border-base-200 flex justify-between items-center transition-all hover:scale-[1.02]">
            <div><h3 className="text-[10px] uppercase font-bold opacity-50 tracking-tighter">Realizadas</h3><div className="text-3xl font-black text-primary">{stats.impartidas}</div></div>
            <CheckCircleIcon className="w-8 h-8 text-primary/20" />
          </div>
          <div className="bg-base-100 p-5 rounded-box shadow-sm border border-base-200 flex justify-between items-center transition-all hover:scale-[1.02]">
            <div><h3 className="text-[10px] uppercase font-bold opacity-50 tracking-tighter">Canceladas</h3><div className="text-3xl font-black text-error">{stats.canceladas}</div></div>
            <XCircleIcon className="w-8 h-8 text-error/20" />
          </div>
          <div className="bg-base-100 p-5 rounded-box shadow-sm border border-base-200 flex justify-between items-center transition-all hover:scale-[1.02]">
            <div><h3 className="text-[10px] uppercase font-bold opacity-50 tracking-tighter">Promedio</h3><div className="text-3xl font-black text-warning">{stats.avg}<span className="text-xs opacity-30">/5</span></div></div>
            <StarIcon className="w-8 h-8 text-warning/20" />
          </div>
          <div className="bg-base-100 p-5 rounded-box shadow-sm border border-base-200 flex justify-between items-center transition-all hover:scale-[1.02]">
            <div><h3 className="text-[10px] uppercase font-bold opacity-50 tracking-tighter">Éxito TICs</h3><div className="text-3xl font-black text-success">{stats.tech}%</div></div>
            <BookOpenIcon className="w-8 h-8 text-success/20" />
          </div>
        </div>

        <div className="bg-base-100 rounded-box shadow-md border border-base-200 no-print">
          <div className="p-4 bg-base-200/50 border-b border-base-200 flex justify-between items-center">
            <h2 className="font-bold text-sm flex items-center gap-2"><FunnelIcon className="w-4 h-4 text-primary" /> Filtros del Sistema</h2>
            <div className="flex gap-2">
              <button onClick={resetFilters} className="btn btn-xs btn-ghost text-error">Limpiar</button>
              <button onClick={applyFilters} className="btn btn-primary btn-xs px-6 text-white font-bold">Aplicar Filtros</button>
            </div>
          </div>

          <div className="p-5 grid grid-cols-1 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7 gap-3">
            <div className="form-control">
              <label className="label py-0"><span className="label-text text-[9px] font-black opacity-50 uppercase">Estado</span></label>
              <select className="select select-bordered select-xs" value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value })}>
                <option value="">Todas</option>
                <option value="completed">Completadas</option>
                <option value="cancelled">Canceladas</option>
              </select>
            </div>
            <div className="form-control">
              <label className="label py-0"><span className="label-text text-[9px] font-black opacity-50 uppercase">Tutor</span></label>
              <select className="select select-bordered select-xs" value={filters.tutorId} onChange={e => setFilters({ ...filters, tutorId: e.target.value })}>
                <option value="">Todos</option>
                {catalogs.tutors.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
              </select>
            </div>
            <div className="form-control">
              <label className="label py-0"><span className="label-text text-[9px] font-black opacity-50 uppercase">Carrera</span></label>
              <select className="select select-bordered select-xs" value={filters.careerId} onChange={e => setFilters({ ...filters, careerId: e.target.value })}>
                <option value="">Todas</option>
                {catalogs.careers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="form-control">
              <label className="label py-0"><span className="label-text text-[9px] font-black opacity-50 uppercase">Nivel</span></label>
              <select className="select select-bordered select-xs" value={filters.levelId} onChange={e => setFilters({ ...filters, levelId: e.target.value })}>
                <option value="">Todos</option>
                {catalogs.levels.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
            <div className="form-control">
              <label className="label py-0"><span className="label-text text-[9px] font-black opacity-50 uppercase">Materia</span></label>
              <select className="select select-bordered select-xs" value={filters.subjectId} onChange={e => setFilters({ ...filters, subjectId: e.target.value })}>
                <option value="">Todas</option>
                {catalogs.subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="form-control relative">
              <label className="label py-0"><span className="label-text text-[9px] font-black opacity-50 uppercase">Desde</span></label>
              <div className="dropdown dropdown-bottom w-full">
                <div tabIndex={0} role="button" className="input input-xs input-bordered w-full flex items-center justify-between text-[10px]">{filters.startDate || "yyyy-mm-dd"}</div>
                <div tabIndex={0} className="dropdown-content z-[100] p-2 shadow-2xl bg-base-100 rounded-box border border-base-200 mt-1">
                  <calendar-date className="cally" onchange={e => { setFilters({ ...filters, startDate: e.target.value }); document.activeElement.blur(); }}>
                    <div slot="previous"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg></div>
                    <div slot="next"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg></div>
                    <calendar-month></calendar-month>
                  </calendar-date>
                </div>
              </div>
            </div>
            <div className="form-control relative">
              <label className="label py-0"><span className="label-text text-[9px] font-black opacity-50 uppercase">Hasta</span></label>
              <div className="dropdown dropdown-bottom w-full">
                <div tabIndex={0} role="button" className="input input-xs input-bordered w-full flex items-center justify-between text-[10px]">{filters.endDate || "yyyy-mm-dd"}</div>
                <div tabIndex={0} className="dropdown-content z-[100] p-2 shadow-2xl bg-base-100 rounded-box border border-base-200 mt-1">
                  <calendar-date className="cally" onchange={e => { setFilters({ ...filters, endDate: e.target.value }); document.activeElement.blur(); }}>
                    <div slot="previous"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg></div>
                    <div slot="next"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg></div>
                    <calendar-month></calendar-month>
                  </calendar-date>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-base-100 rounded-box p-5 shadow-sm border border-base-200">
          <div className="flex justify-between items-center mb-6 px-1">
            <h2 className="text-lg font-bold flex items-center gap-2">Bitácora de Actividad <div className="badge badge-primary font-mono text-xs">{reportData.length} registros</div></h2>
            <button onClick={() => window.print()} className="btn btn-neutral btn-sm no-print shadow-md">🖨️ Imprimir PDF</button>
          </div>
          <div className="overflow-x-auto pb-4">
            <table className="table table-xs table-zebra w-full border-separate border-spacing-0">
              <thead>
                <tr className="bg-base-200/80 text-left uppercase text-base-content/60">
                  <th className="rounded-tl-lg py-3">Fecha</th>
                  <th>Tutor</th>
                  <th>Carrera</th>
                  <th>Materia</th>
                  <th>Estudiante</th>
                  <th className="text-center">Calif.</th>
                  <th className="rounded-tr-lg">Observaciones</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="7" className="text-center py-10"><span className="loading loading-spinner text-primary"></span></td></tr>
                ) : reportData.length === 0 ? (
                  <tr><td colSpan="7" className="text-center py-10 opacity-40 italic font-bold">No hay registros con estos filtros.</td></tr>
                ) : reportData.map((item) => {
                  const date = new Date(item.slot?.start_time || item.created_at);
                  const enrollments = safe(item.student?.enrollments);
                  const careerName = enrollments[0]?.career?.name || "-";
                  const fb = safe(item.feedback)[0];

                  return (
                    <tr key={item.id} className="hover">
                      <td className="font-mono text-[10px] py-3">{date.toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                      <td className="font-bold text-primary">{item.tutor?.full_name}</td>
                      <td className="text-[10px] font-medium">{careerName}</td>
                      <td className="max-w-[120px] truncate" title={item.subject?.name}>{item.subject?.name}</td>
                      <td className="font-medium">{item.student?.full_name}</td>
                      <td className="text-center">
                        {item.status === 'completed' ? <StarRating rating={fb?.student_rating} /> : <span className="text-[9px] text-error font-black uppercase">Cancelada</span>}
                      </td>
                      <td className="max-w-[180px] text-[10px] leading-tight opacity-70 italic">
                        {item.status === 'completed' ? (item.tutor_feedback || "-") : ("Motivo: " + (item.cancellation_reason || "N/A"))}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}