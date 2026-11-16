'use client'
import DatePicker from '@/components/date-picker'
import { Fragment, useEffect, useState } from 'react'
import SidePanel from '@/components/side-panel'
import Toast, { ToastMessage } from '@/components/toast'
import BookingActions, { type MovedBooking } from '@/components/booking-actions'
import StudentCredits from './student-credits'
import StudentCourseActions from './student-course-actions'
import { courseLevels, type CourseLevel } from '@/lib/course-levels'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import AgendaExport from './agenda-export'
import { compareRecentBookings } from '@/lib/student-summary'
import { adminSections as sections, type AdminSection } from '@/lib/admin-navigation'
import { TeacherForm, CourseTemplateForm, StudentForm } from './admin-forms'
import { CalendarSlot, MonthCalendar, dateLabel } from '@/components/month-calendar'
type Student = {
    id: string
    name: string
    email: string
    firstName: string
    lastName: string
    phone: string | null
    language: string
    lastBookingAt: string | null
    entitlements: {
        id: string
        courseId: string
        course: string
        total: number
        bookings: { id: string; course: string; startsAt: string; endsAt: string; status: string; attendance: string }[]
        remaining: number
        status: string
        purchaseDate: string
        expiresAt: string
    }[]
}
type Course = {
    id: string
    name: string
    level: CourseLevel
    durationMinutes: number
    totalDurationMinutes: number
    capacity: number
    reminderDays: number | null
    cancellationHours: number
    defaultTeacherId: string | null
    minGapHours: number
    bookingDelayHours: number
}
type Teacher = {
    id: string
    name: string
    firstName: string
    lastName: string
    email: string
    nextSession: { startsAt: string; course: string } | null
    assignedSessions: {
        id: string
        startsAt: string
        endsAt: string
        studentCount: number
        courses: { id: string; name: string; level: CourseLevel }[]
    }[]
}
function teacherSessionLabel(session: Teacher['assignedSessions'][number]) {
    const day = new Date(session.startsAt).toLocaleDateString('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'Europe/Paris',
    })
    const time = (value: string) =>
        new Date(value).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })
    return `${day.charAt(0).toUpperCase() + day.slice(1)} de ${time(session.startsAt)} à ${time(session.endsAt)} · ${session.studentCount} ${session.studentCount === 1 ? 'élève' : 'élèves'}`
}
function TeacherSessionCourses({ session }: { session: Teacher['assignedSessions'][number] }) {
    return session.courses.length === 0 ? (
        <p className="muted">Aucun cours prévu.</p>
    ) : (
        <>
            {session.courses.map((course) => (
                <div key={course.id} className="slot_student_course_heading">
                    <span className="slot_student_course_name">
                        <span aria-hidden="true">➔ </span>
                        {course.name.toLocaleUpperCase('fr-FR')}
                    </span>
                    <span className={`month_event_level month_event_level_${course.level.toLowerCase()}`}>
                        {courseLevels[course.level]}
                    </span>
                </div>
            ))}
        </>
    )
}
export default function AdminDashboard({
    section,
    students,
    courses,
    teachers,
}: {
    section: AdminSection
    students: Student[]
    courses: Course[]
    teachers: Teacher[]
}) {
    const [planningCourseId, setPlanningCourseId] = useState('')
    const [planningTeacherId, setPlanningTeacherId] = useState('')
    const [courseLevel, setCourseLevel] = useState<CourseLevel | null>(null)
    const visibleCourses = courses
        .filter((course) => courseLevel === null || course.level === courseLevel)
        .sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base', numeric: true }))
    const [studentSort, setStudentSort] = useState<{ field: 'lastName' | 'firstName' | 'recent'; direction: 1 | -1 }>({
        field: 'recent',
        direction: -1,
    })
    const [editingStudent, setEditingStudent] = useState(false)
    const [studentBusy, setStudentBusy] = useState(false)
    const [studentError, setStudentError] = useState('')
    const sortedStudents = [...students].sort((a, b) => {
        if (studentSort.field === 'recent') return -studentSort.direction * compareRecentBookings(a, b)
        return (
            studentSort.direction *
            (a[studentSort.field].localeCompare(b[studentSort.field], 'fr', { sensitivity: 'base' }) ||
                a.firstName.localeCompare(b.firstName, 'fr'))
        )
    })
    function sortStudents(field: 'lastName' | 'firstName' | 'recent') {
        setStudentSort((current) => ({
            field,
            direction: current.field === field ? (current.direction === 1 ? -1 : 1) : field === 'recent' ? -1 : 1,
        }))
    }
    const [toast, setToast] = useState<{ message: string; id: number } | null>(null)
    useEffect(() => {
        if (!toast) return
        const timer = window.setTimeout(() => setToast(null), 2000)
        return () => window.clearTimeout(timer)
    }, [toast])
    const notify = (message: string) => setToast((current) => ({ message, id: (current?.id ?? 0) + 1 }))
    const [editingCourse, setEditingCourse] = useState<Course | null>(null)
    const [courseError, setCourseError] = useState('')
    const [courseBusy, setCourseBusy] = useState(false)
    const [creatingSlot, setCreatingSlot] = useState(false)
    const [editingSlot, setEditingSlot] = useState<CalendarSlot | null>(null)
    const [slotError, setSlotError] = useState('')
    const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null)
    const teacherDetails = teachers.find((teacher) => teacher.id === selectedTeacher?.id) ?? selectedTeacher
    const nextTeacherSession = teacherDetails?.assignedSessions
        .filter((session) => new Date(session.endsAt) > new Date())
        .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())[0]

    const [editingTeacher, setEditingTeacher] = useState(false)
    const [teacherBusy, setTeacherBusy] = useState(false)
    const [teacherError, setTeacherError] = useState('')
    const router = useRouter()
    const [studentSearchOpen, setStudentSearchOpen] = useState(false)
    const [studentSearch, setStudentSearch] = useState('')
    const [bookingError, setBookingError] = useState('')
    const [refresh, setRefresh] = useState(0),
        [selected, setSelected] = useState<CalendarSlot | null>(null),
        [message, setMessage] = useState(''),
        [busy, setBusy] = useState(false),
        [student, setStudent] = useState<Student | null>(null)
    const nextStudentSession = student?.entitlements
        .flatMap((entitlement) => entitlement.bookings)
        .filter((booking) => booking.status === 'BOOKED' && new Date(booking.startsAt).getTime() > Date.now())
        .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())[0]
    const [start, setStart] = useState(''),
        [capacity, setCapacity] = useState(12)
    const [durationMinutes, setDurationMinutes] = useState(180)
    const [teacherIds, setTeacherIds] = useState<string[]>([])
    const [repeatUnit, setRepeatUnit] = useState('')
    const [repeatInterval, setRepeatInterval] = useState(1)
    const [repeatUntil, setRepeatUntil] = useState('')
    function openCreateSlot(date?: string) {
        setEditingSlot(null)
        setRepeatUnit('')
        setRepeatInterval(1)
        setRepeatUntil('')
        setSelected(null)
        setStart(date ? `${date}T09:00` : '')
        setDurationMinutes(180)
        setTeacherIds([])
        setCapacity(12)
        setSlotError('')
        setMessage('')
        setCreatingSlot(true)
    }
    const eligible = selected
        ? students
              .filter((s) => !selected.students?.some((item) => item.id === s.id))
              .flatMap((s) =>
                  s.entitlements
                      .filter(
                          (e) =>
                              e.status === 'ACTIVE' &&
                              e.remaining > 0 &&
                              new Date(e.purchaseDate) <= new Date(selected.startsAt) &&
                              new Date(e.expiresAt) > new Date(selected.startsAt),
                      )
                      .map((e) => ({ student: s, entitlement: e })),
              )
        : []
    const canAdd =
        selected &&
        !selected.blocked &&
        selected.reserved < selected.capacity &&
        new Date(selected.startsAt) > new Date()
    const normalizeSearch = (value: string) =>
        value
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLocaleLowerCase('fr-FR')
            .trim()
    const matchingStudents = eligible.filter(({ student }) =>
        normalizeSearch(`${student.name} ${student.email}`).includes(normalizeSearch(studentSearch)),
    )
    async function addStudent(entitlementId: string) {
        const choice = eligible.find((item) => item.entitlement.id === entitlementId)
        if (!selected || !choice || !canAdd || busy) return
        setBusy(true)
        setBookingError('')
        setMessage('')
        try {
            const response = await fetch('/api/bookings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: choice.student.id,
                    entitlementId: choice.entitlement.id,
                    slotId: selected.id,
                }),
            })
            const data = await response.json()
            if (!response.ok) throw Error(data.error || 'Ajout impossible.')
            setSelected((current) =>
                current
                    ? {
                          ...current,
                          reserved: current.reserved + 1,
                          students: [
                              ...(current.students ?? []),
                              {
                                  id: choice.student.id,
                                  name: choice.student.name,
                                  email: choice.student.email,
                                  status: 'BOOKED',
                                  bookingId: data.id,
                                  entitlementId: choice.entitlement.id,
                                  course: choice.entitlement.course,
                                  level: courses.find((course) => course.id === choice.entitlement.courseId)?.level,
                              },
                          ],
                      }
                    : current,
            )
            setStudentSearch('')
            setRefresh((n) => n + 1)
            router.refresh()
            notify(`${choice.student.name} a été ajouté au cours.`)
        } catch (error) {
            setBookingError(error instanceof Error ? error.message : 'Ajout impossible.')
        } finally {
            setBusy(false)
        }
    }
    async function create(e: React.FormEvent) {
        e.preventDefault()
        if (busy) return
        setBusy(true)
        setMessage('')
        setSlotError('')
        try {
            const d = new Date(start)
            if (Number.isNaN(d.getTime())) throw Error('Choisissez une date')
            const r = await fetch('/api/admin/slots', {
                method: editingSlot ? 'PATCH' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: editingSlot?.id,
                    courseId: null,
                    startsAt: d.toISOString(),
                    endsAt: new Date(d.getTime() + durationMinutes * 60000).toISOString(),
                    teacherIds,
                    capacity,
                    recurrence:
                        !editingSlot && repeatUnit
                            ? { unit: repeatUnit, interval: repeatInterval, until: repeatUntil }
                            : undefined,
                }),
            })
            const data = await r.json()
            if (!r.ok) throw Error(data.error)
            setRefresh((n) => n + 1)
            router.refresh()
            router.push('/admin/planning')
            notify(
                editingSlot
                    ? 'Séance modifiée avec succès.'
                    : data.count > 1
                      ? `${data.count} créneaux créés avec succès.`
                      : 'Créneau créé avec succès.',
            )
            setCreatingSlot(false)
            setEditingSlot(null)
        } catch (e) {
            setSlotError(e instanceof Error ? e.message : 'Erreur')
        } finally {
            setBusy(false)
        }
    }
    function updateIndividualBooking(id: string, moved?: MovedBooking) {
        setStudent((current) =>
            current
                ? {
                      ...current,
                      entitlements: current.entitlements.map((entitlement) => {
                          const old = entitlement.bookings.find((booking) => booking.id === id)
                          if (!old) return entitlement
                          return {
                              ...entitlement,
                              remaining:
                                  !moved && old.status === 'BOOKED' ? entitlement.remaining + 1 : entitlement.remaining,
                              bookings: entitlement.bookings.map((booking) =>
                                  booking.id !== id
                                      ? booking
                                      : moved
                                        ? {
                                              ...booking,
                                              course: moved.course,
                                              startsAt: moved.date,
                                              endsAt: moved.endsAt,
                                              attendance: 'UNMARKED',
                                          }
                                        : { ...booking, status: 'CANCELLED' },
                              ),
                          }
                      }),
                  }
                : null,
        )
        setSelected((current) =>
            current && moved?.slotId === current.id
                ? {
                      ...current,
                      students: current.students?.map((item) =>
                          item.bookingId === id
                              ? {
                                    ...item,
                                    course: moved.course,
                                    entitlementId: moved.entitlementId,
                                    level: moved.level,
                                    teacherId: moved.teacherId,
                                    teacher: moved.teacher,
                                }
                              : item,
                      ),
                  }
                : current && current.students?.some((item) => item.bookingId === id)
                  ? {
                        ...current,
                        reserved: Math.max(0, current.reserved - 1),
                        students: current.students.filter((item) => item.bookingId !== id),
                    }
                  : current,
        )
        setRefresh((n) => n + 1)
        router.refresh()
    }
    async function deleteTeacher() {
        if (
            !selectedTeacher ||
            teacherBusy ||
            !confirm(
                `Supprimer ${selectedTeacher.name} ? Ses cours et créneaux seront conservés sans professeur affecté.`,
            )
        )
            return
        setTeacherBusy(true)
        setTeacherError('')
        try {
            const response = await fetch('/api/admin/teachers', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: selectedTeacher.id }),
            })
            const data = await response.json()
            if (!response.ok) throw Error(data.error || 'Suppression impossible.')
            setTeacherIds((current) => current.filter((id) => id !== selectedTeacher.id))
            setSelectedTeacher(null)
            router.refresh()
            setRefresh((n) => n + 1)
            notify('Professeur supprimé.')
        } catch (error) {
            setTeacherError(error instanceof Error ? error.message : 'Suppression impossible.')
        } finally {
            setTeacherBusy(false)
        }
    }
    async function deleteStudent() {
        if (
            !student ||
            studentBusy ||
            !confirm(
                `Supprimer ${student.firstName} ${student.lastName.toLocaleUpperCase('fr-FR')}, ses achats et tout son historique de réservations ? Cette suppression concerne uniquement le planning.`,
            )
        )
            return
        setStudentBusy(true)
        setStudentError('')
        try {
            const response = await fetch('/api/admin/students', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: student.id }),
            })
            const data = await response.json()
            if (!response.ok) throw Error(data.error || 'Suppression impossible.')
            setStudent(null)
            setRefresh((n) => n + 1)
            router.refresh()
            notify('Étudiant supprimé.')
        } catch (error) {
            setStudentError(error instanceof Error ? error.message : 'Suppression impossible.')
        } finally {
            setStudentBusy(false)
        }
    }
    async function deleteCourse() {
        if (
            !editingCourse ||
            courseBusy ||
            !confirm(
                `Supprimer définitivement le cours « ${editingCourse.name.toLocaleUpperCase('fr-FR')} », ses créneaux, les achats et toutes les réservations associés ? Cette action est irréversible.`,
            )
        )
            return
        setCourseBusy(true)
        setCourseError('')
        try {
            const response = await fetch('/api/admin/courses', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: editingCourse.id }),
            })
            const data = await response.json()
            if (!response.ok) throw Error(data.error || 'Suppression impossible.')
            setEditingCourse(null)
            setRefresh((n) => n + 1)
            router.refresh()
            notify('Cours supprimé.')
        } catch (error) {
            setCourseError(error instanceof Error ? error.message : 'Suppression impossible.')
        } finally {
            setCourseBusy(false)
        }
    }
    async function remove() {
        if (
            !selected ||
            busy ||
            !confirm(
                'Supprimer cette séance et toutes ses réservations ? Les séances seront recréditées aux étudiants.',
            )
        )
            return
        setSlotError('')
        setBusy(true)
        try {
            const r = await fetch('/api/admin/slots', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: selected.id }),
            })
            const data = await r.json()
            if (!r.ok) throw Error(data.error)
            setSelected(null)
            setRefresh((n) => n + 1)
            router.refresh()
            notify('Séance supprimée.')
        } catch (e) {
            setSlotError(e instanceof Error ? e.message : 'Erreur')
        } finally {
            setBusy(false)
        }
    }
    const slotForm = (
        <form onSubmit={create}>
            <label htmlFor="slot-start">Date et heure de début</label>
            <DatePicker id="slot-start" withTime value={start} onChange={setStart} required />
            {!editingSlot && (
                <>
                    <label htmlFor="slot-repeat">Répétition</label>
                    <select id="slot-repeat" value={repeatUnit} onChange={(event) => setRepeatUnit(event.target.value)}>
                        <option value="">Ne pas répéter</option>
                        <option value="day">Tous les N jours</option>
                        <option value="week">Toutes les N semaines</option>
                    </select>
                    {repeatUnit && (
                        <>
                            <label htmlFor="slot-repeat-interval">
                                {repeatUnit === 'day'
                                    ? 'Tous les combien de jours ?'
                                    : 'Toutes les combien de semaines ?'}
                            </label>
                            <input
                                id="slot-repeat-interval"
                                type="number"
                                min="1"
                                max="365"
                                step="1"
                                required
                                value={repeatInterval}
                                onChange={(event) => setRepeatInterval(Number(event.target.value))}
                            />
                            <label htmlFor="slot-repeat-until">Répéter jusqu’au (inclus)</label>
                            <DatePicker id="slot-repeat-until" value={repeatUntil} onChange={setRepeatUntil} required />
                            <p className="muted">
                                Chaque occurrence conserve l’heure de début, la durée, la capacité et les professeurs.
                                Maximum : 366 créneaux. En cas de conflit, aucun créneau n’est créé.
                            </p>
                        </>
                    )}
                </>
            )}
            <label htmlFor="slot-duration">Durée (en heures)</label>
            <input
                id="slot-duration"
                type="number"
                min="0.25"
                max="12"
                step="0.25"
                required
                value={durationMinutes / 60}
                onChange={(e) => setDurationMinutes(Number(e.target.value) * 60)}
            />
            <fieldset className="slot_teacher_choices">
                <legend>Professeurs</legend>
                {teachers.length === 0 && <p className="muted">Aucun professeur disponible.</p>}
                {teachers.map((teacher) => (
                    <label className="attendance_checkbox" key={teacher.id}>
                        <input
                            type="checkbox"
                            checked={teacherIds.includes(teacher.id)}
                            onChange={(event) =>
                                setTeacherIds((current) =>
                                    event.target.checked
                                        ? [...current, teacher.id]
                                        : current.filter((id) => id !== teacher.id),
                                )
                            }
                        />
                        <span>{teacher.name}</span>
                    </label>
                ))}
                {teacherIds.length === 0 && <p className="muted">Professeurs à définir</p>}
            </fieldset>
            <label>Capacité d’accueil</label>
            <input
                type="number"
                min="1"
                max="100"
                value={capacity}
                onChange={(e) => setCapacity(Number(e.target.value))}
                required
            />
            <button className="btn btn-medium" disabled={busy} type="submit">
                {editingSlot ? 'Enregistrer les modifications' : 'Créer le créneau'}
            </button>
            {editingSlot && (
                <button
                    type="button"
                    className="btn btn-medium secondary"
                    disabled={busy}
                    onClick={() => {
                        setEditingSlot(null)
                        setSelected(editingSlot)
                        setSlotError('')
                    }}
                >
                    Annuler
                </button>
            )}
        </form>
    )
    return (
        <>
            <div className="admin_toast_region" role="status" aria-live="polite" aria-atomic="true">
                {toast && !student && !selected && <ToastMessage key={toast.id} message={toast.message} />}
            </div>
            <div className="admin_workspace">
                <div className="admin_sidebar_column">
                    <div className="hero_panel">
                        <div>
                            <div className="section_kicker">Administrateur</div>
                            <h1>{sections.find((item) => item.id === section)?.label}</h1>
                            <p>Gérez les séances, les étudiants et les professeurs.</p>
                        </div>
                    </div>
                    <aside className="admin_sidebar">
                        <nav aria-label="Navigation administrateur">
                            {sections.map((item) => (
                                <Fragment key={item.id}>
                                    <Link
                                        className="btn"
                                        href={item.href}
                                        prefetch={false}
                                        key={item.id}
                                        aria-current={section === item.id ? 'page' : undefined}
                                        aria-controls="admin-content"
                                        onClick={() => {
                                            if (item.id === 'slots') {
                                                setEditingSlot(null)
                                                setStart('')
                                            }
                                            setMessage('')
                                        }}
                                    >
                                        {item.label}
                                    </Link>
                                    {item.id === 'planning' && section === 'planning' && (
                                        <div className="admin_planning_filters">
                                            <label htmlFor="planning-course">Filtrer par cours</label>
                                            <select
                                                id="planning-course"
                                                value={planningCourseId}
                                                onChange={(event) => setPlanningCourseId(event.target.value)}
                                            >
                                                <option value="">Tous les cours</option>
                                                {courses.map((course) => (
                                                    <option key={course.id} value={course.id}>
                                                        {course.name.toLocaleUpperCase('fr-FR')}
                                                    </option>
                                                ))}
                                            </select>
                                            <label htmlFor="planning-teacher">Filtrer par professeur</label>
                                            <select
                                                id="planning-teacher"
                                                value={planningTeacherId}
                                                onChange={(event) => setPlanningTeacherId(event.target.value)}
                                            >
                                                <option value="">Tous les professeurs</option>
                                                {teachers.map((teacher) => (
                                                    <option key={teacher.id} value={teacher.id}>
                                                        {teacher.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    )}
                                </Fragment>
                            ))}
                        </nav>
                    </aside>
                </div>
                <div className="admin_content" id="admin-content">
                    {section === 'slots' && !editingSlot && (
                        <div className="admin_create">
                            <div className="card">
                                <h2>Gestion des créneaux</h2>
                                <p>
                                    Ajoutez un créneau ouvert à tous les cours en choisissant la date, le nombre de
                                    places et le professeur.
                                </p>
                                {slotForm}
                            </div>
                        </div>
                    )}
                    {section === 'planning' && (
                        <div>
                            <div className="card">
                                <MonthCalendar
                                    mode="admin"
                                    onCreateSlot={openCreateSlot}
                                    courseId={planningCourseId}
                                    teacherId={planningTeacherId}
                                    refresh={refresh}
                                    onSelect={(slot) => {
                                        setSelected(slot)
                                        setSlotError('')
                                        setStudentSearchOpen(false)
                                        setStudentSearch('')
                                        setBookingError('')
                                    }}
                                />
                            </div>
                            <AgendaExport />
                        </div>
                    )}
                    {section === 'students' && (
                        <div className="admin_management_blocks">
                            <div className="card">
                                <StudentForm onNotify={notify} />
                            </div>
                            <div className="card">
                                <h2>Liste des étudiants</h2>
                                <div className="attendance_views" role="group" aria-label="Trier les étudiants">
                                    {(
                                        [
                                            { field: 'recent', label: 'Réservations récentes' },
                                            { field: 'lastName', label: 'Nom' },
                                            { field: 'firstName', label: 'Prénom' },
                                        ] as const
                                    ).map(({ field, label }) => (
                                        <button
                                            key={field}
                                            type="button"
                                            className={`btn ${studentSort.field === field ? '' : 'secondary'}`}
                                            aria-pressed={studentSort.field === field}
                                            onClick={() => sortStudents(field)}
                                        >
                                            Trier par {label}{' '}
                                            {studentSort.field === field
                                                ? studentSort.direction === 1
                                                    ? '↑'
                                                    : '↓'
                                                : ''}
                                        </button>
                                    ))}
                                </div>
                                {sortedStudents.map((s) => {
                                    const nextSession = s.entitlements
                                        .flatMap((entitlement) => entitlement.bookings)
                                        .filter(
                                            (booking) =>
                                                booking.status === 'BOOKED' &&
                                                new Date(booking.startsAt).getTime() > Date.now(),
                                        )
                                        .sort(
                                            (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
                                        )[0]
                                    return (
                                        <div
                                            className="reservation_row course_list_item student_list_row"
                                            key={s.id}
                                            role="button"
                                            tabIndex={0}
                                            aria-haspopup="dialog"
                                            aria-label={`Voir la fiche de ${s.firstName} ${s.lastName.toLocaleUpperCase('fr-FR')}`}
                                            onClick={() => {
                                                setStudent(s)
                                                setEditingStudent(false)
                                                setStudentError('')
                                            }}
                                            onKeyDown={(event) => {
                                                if (event.key === 'Enter' || event.key === ' ') {
                                                    event.preventDefault()
                                                    setStudent(s)
                                                    setEditingStudent(false)
                                                    setStudentError('')
                                                }
                                            }}
                                        >
                                            <div>
                                                <strong>
                                                    {s.lastName.toLocaleUpperCase('fr-FR')} {s.firstName}
                                                </strong>
                                                <p className="muted">{s.email}</p>
                                                <p className="muted">{s.phone || 'Téléphone non renseigné'}</p>
                                            </div>
                                            <div className="student_next_booking">
                                                {nextSession ? (
                                                    <>
                                                        <span>{dateLabel(nextSession.startsAt)}</span>
                                                        <span className="muted">
                                                            {nextSession.course.toLocaleUpperCase('fr-FR')}
                                                        </span>
                                                    </>
                                                ) : (
                                                    <span className="muted">Aucune séance à venir</span>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                                {students.length === 0 && <p className="muted">Aucun étudiant enregistré.</p>}
                            </div>
                        </div>
                    )}
                    {section === 'teachers' && (
                        <div className="admin_management_blocks">
                            <div className="card">
                                <TeacherForm onNotify={notify} />
                            </div>
                            <div className="card">
                                <h2>Liste des professeurs</h2>
                                {teachers.length === 0 && <p className="muted">Aucun professeur enregistré.</p>}
                                {teachers.map((teacher) => (
                                    <div
                                        className="reservation_row course_list_item"
                                        key={teacher.id}
                                        role="button"
                                        tabIndex={0}
                                        aria-haspopup="dialog"
                                        aria-label={`Voir la fiche de ${teacher.name}`}
                                        onClick={() => {
                                            setSelectedTeacher(teacher)
                                            setEditingTeacher(false)
                                            setTeacherError('')
                                        }}
                                        onKeyDown={(event) => {
                                            if (event.key === 'Enter' || event.key === ' ') {
                                                event.preventDefault()
                                                setSelectedTeacher(teacher)
                                                setEditingTeacher(false)
                                                setTeacherError('')
                                            }
                                        }}
                                    >
                                        <div>
                                            <strong>{teacher.name}</strong>
                                            <p className="muted">{teacher.email}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    {section === 'settings' && (
                        <div className="admin_management_blocks">
                            <div className="card">
                                <CourseTemplateForm teachers={teachers} onNotify={notify} />
                            </div>
                            <div className="card">
                                <h2>Liste des cours</h2>
                                <div className="attendance_views" role="group" aria-label="Niveau des cours">
                                    {Object.entries(courseLevels).map(([value, label]) => (
                                        <button
                                            key={value}
                                            type="button"
                                            className={courseLevel === value ? 'btn' : 'btn secondary'}
                                            aria-pressed={courseLevel === value}
                                            onClick={() =>
                                                setCourseLevel((current) =>
                                                    current === value ? null : (value as CourseLevel),
                                                )
                                            }
                                        >
                                            {label}
                                        </button>
                                    ))}
                                </div>
                                <p className="muted" role="status">
                                    {visibleCourses.length} cours affiché(s)
                                </p>
                                {visibleCourses.length === 0 && (
                                    <p className="muted">
                                        {courses.length === 0
                                            ? 'Aucun cours enregistré.'
                                            : 'Aucun cours ne correspond à ces filtres.'}
                                    </p>
                                )}
                                {visibleCourses.map((course) => (
                                    <div
                                        className="reservation_row course_list_item"
                                        key={course.id}
                                        role="button"
                                        tabIndex={0}
                                        aria-label={`Modifier ou supprimer le cours ${course.name.toLocaleUpperCase('fr-FR')}`}
                                        aria-haspopup="dialog"
                                        onClick={() => {
                                            setEditingCourse(course)
                                            setCourseError('')
                                            setMessage('')
                                        }}
                                        onKeyDown={(event) => {
                                            if (event.key === 'Enter' || event.key === ' ') {
                                                event.preventDefault()
                                                setEditingCourse(course)
                                                setCourseError('')
                                                setMessage('')
                                            }
                                        }}
                                    >
                                        <div className="admin_course_details">
                                            <div className="admin_course_heading">
                                                <strong>{course.name.toLocaleUpperCase('fr-FR')}</strong>
                                                <span
                                                    className={`month_event_level month_event_level_${course.level.toLowerCase()}`}
                                                >
                                                    {courseLevels[course.level]}
                                                </span>
                                            </div>
                                            <p className="muted">
                                                Durée totale :{' '}
                                                {(course.totalDurationMinutes / 60).toLocaleString('fr-FR')} h
                                            </p>
                                            <p className="muted">
                                                {(course.durationMinutes / 60).toLocaleString('fr-FR')} h / séance ·{' '}
                                                Délai : {course.minGapHours} h
                                            </p>
                                            <p className="muted">
                                                Rappel :{' '}
                                                {course.reminderDays === null
                                                    ? 'désactivé'
                                                    : `J-${course.reminderDays}`}{' '}
                                                · Annulation jusqu’à {course.cancellationHours} h avant le cours
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    {message && <Toast message={message} variant="error" />}
                </div>
            </div>
            {selectedTeacher && (
                <SidePanel titleId="admin-teacher-title" busy={teacherBusy} onClose={() => setSelectedTeacher(null)}>
                    <span className="section_kicker">
                        {editingTeacher ? 'Modifier un professeur' : 'Fiche professeur'}
                    </span>
                    <h2 id="admin-teacher-title">{selectedTeacher.name}</h2>
                    {editingTeacher ? (
                        <TeacherForm
                            teacher={selectedTeacher}
                            onNotify={notify}
                            onBusyChange={setTeacherBusy}
                            onSaved={() => {
                                setSelectedTeacher(null)
                                setRefresh((n) => n + 1)
                            }}
                            onCancel={() => setEditingTeacher(false)}
                        />
                    ) : (
                        <>
                            <dl className="admin_settings">
                                <div>
                                    <dt>Email</dt>
                                    <dd>{selectedTeacher.email}</dd>
                                </div>
                            </dl>
                            {teacherDetails && (
                                <>
                                    <div className="profile_next_session">
                                        <span className="section_kicker">Prochaine séance attribuée</span>
                                        {nextTeacherSession ? (
                                            <>
                                                <strong>{teacherSessionLabel(nextTeacherSession)}</strong>
                                                <TeacherSessionCourses session={nextTeacherSession} />
                                            </>
                                        ) : (
                                            <p className="muted">Aucune séance à venir planifiée.</p>
                                        )}
                                    </div>
                                    {(['upcoming', 'past'] as const).map((period) => {
                                        const sessions = teacherDetails.assignedSessions
                                            .filter((session) =>
                                                period === 'upcoming'
                                                    ? new Date(session.endsAt) > new Date()
                                                    : new Date(session.endsAt) <= new Date(),
                                            )
                                            .sort((a, b) =>
                                                period === 'upcoming'
                                                    ? new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
                                                    : new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime(),
                                            )
                                        return (
                                            <div key={period} className="profile_assignments">
                                                <h3>{period === 'upcoming' ? 'Séances à venir' : 'Séances passées'}</h3>
                                                {sessions.length === 0 ? (
                                                    <p className="muted">
                                                        {period === 'upcoming'
                                                            ? 'Aucune séance à venir.'
                                                            : 'Aucune séance passée.'}
                                                    </p>
                                                ) : (
                                                    <ul className="profile_assigned_courses">
                                                        {sessions.map((session) => (
                                                            <li key={session.id}>
                                                                <strong>{teacherSessionLabel(session)}</strong>
                                                                <TeacherSessionCourses session={session} />
                                                            </li>
                                                        ))}
                                                    </ul>
                                                )}
                                            </div>
                                        )
                                    })}
                                </>
                            )}
                            <div className="form_actions">
                                <button
                                    type="button"
                                    className="btn btn-medium"
                                    disabled={teacherBusy}
                                    onClick={() => setEditingTeacher(true)}
                                >
                                    Modifier
                                </button>
                                <button
                                    type="button"
                                    className="btn  btn-medium danger"
                                    disabled={teacherBusy}
                                    onClick={deleteTeacher}
                                >
                                    Supprimer
                                </button>
                            </div>
                        </>
                    )}
                    {teacherError && (
                        <p className="error" role="alert">
                            {teacherError}
                        </p>
                    )}
                </SidePanel>
            )}
            {student && (
                <SidePanel titleId="admin-student-title" busy={studentBusy} onClose={() => setStudent(null)}>
                    <span className="section_kicker">{editingStudent ? 'Modifier un étudiant' : 'Fiche étudiant'}</span>
                    <h2 id="admin-student-title">
                        {student.firstName} {student.lastName.toLocaleUpperCase('fr-FR')}
                    </h2>
                    {editingStudent ? (
                        <StudentForm
                            student={student}
                            onBusyChange={setStudentBusy}
                            onNotify={notify}
                            onSaved={() => setStudent(null)}
                            onCancel={() => setEditingStudent(false)}
                        />
                    ) : (
                        <div>
                            <dl className="admin_settings">
                                <div>
                                    <dt>Email</dt>
                                    <dd>{student.email}</dd>
                                </div>
                                <div>
                                    <dt>Téléphone</dt>
                                    <dd>{student.phone || 'Non renseigné'}</dd>
                                </div>
                                <div>
                                    <dt>Langue</dt>
                                    <dd>
                                        {(
                                            { fr: 'Français (fr)', en: 'Anglais (en)', ja: 'Japonais (ja)' } as Record<
                                                string,
                                                string
                                            >
                                        )[student.language] ?? student.language}
                                    </dd>
                                </div>
                            </dl>
                        </div>
                    )}
                    <div className="admin_toast_region" role="status" aria-live="polite" aria-atomic="true">
                        {toast && <ToastMessage key={toast.id} message={toast.message} />}
                    </div>
                    {!editingStudent && (
                        <div className="profile_assignments">
                            <h3>Ses cours et séances</h3>
                            <div className="profile_next_session">
                                <span className="section_kicker">Prochaine séance réservée</span>
                                {nextStudentSession ? (
                                    <>
                                        <strong>{dateLabel(nextStudentSession.startsAt)}</strong>
                                        <span>{nextStudentSession.course.toLocaleUpperCase('fr-FR')}</span>
                                    </>
                                ) : (
                                    <p className="muted">Aucune séance à venir réservée.</p>
                                )}
                            </div>
                            {student.entitlements.length === 0 && (
                                <p className="muted">Aucun cours attribué. Ajoutez son premier cours pour commencer.</p>
                            )}
                            <ul className="profile_assigned_courses">
                                {student.entitlements
                                    .slice()
                                    .sort(
                                        (a, b) =>
                                            Number(a.remaining <= 0) - Number(b.remaining <= 0) ||
                                            new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime(),
                                    )
                                    .map((e) => (
                                        <li key={e.id}>
                                            <details className="student_purchase">
                                                <summary className="student_purchase_heading">
                                                    <strong>{e.course.toLocaleUpperCase('fr-FR')}</strong>
                                                    <span
                                                        className={`month_event_level month_event_level_${(courses.find((course) => course.id === e.courseId)?.level ?? 'INITIATION').toLowerCase()}`}
                                                    >
                                                        {
                                                            courseLevels[
                                                                courses.find((course) => course.id === e.courseId)
                                                                    ?.level ?? 'INITIATION'
                                                            ]
                                                        }
                                                    </span>
                                                    <span
                                                        className={`student_status_badge${e.status !== 'SUSPENDED' && new Date(e.expiresAt) > new Date() && e.remaining <= 0 ? ' student_status_badge_exhausted' : ''}`}
                                                    >
                                                        {e.status === 'SUSPENDED'
                                                            ? 'Suspendu'
                                                            : new Date(e.expiresAt) <= new Date()
                                                              ? 'Expiré'
                                                              : e.remaining <= 0
                                                                ? 'Épuisé'
                                                                : 'Actif'}
                                                    </span>
                                                </summary>
                                                {!editingStudent && (
                                                    <StudentCourseActions
                                                        userId={student.id}
                                                        entitlement={e}
                                                        busy={studentBusy}
                                                        onBusyChange={setStudentBusy}
                                                        onNotify={notify}
                                                        onUpdated={(updated) => {
                                                            setStudent((current) =>
                                                                current
                                                                    ? {
                                                                          ...current,
                                                                          entitlements: current.entitlements.map(
                                                                              (item) =>
                                                                                  item.id === updated.id
                                                                                      ? updated
                                                                                      : item,
                                                                          ),
                                                                      }
                                                                    : null,
                                                            )
                                                            setRefresh((value) => value + 1)
                                                            router.refresh()
                                                        }}
                                                        onDeleted={(id) => {
                                                            setStudent((current) =>
                                                                current
                                                                    ? {
                                                                          ...current,
                                                                          entitlements: current.entitlements.filter(
                                                                              (item) => item.id !== id,
                                                                          ),
                                                                      }
                                                                    : null,
                                                            )
                                                            setRefresh((value) => value + 1)
                                                            router.refresh()
                                                        }}
                                                    />
                                                )}
                                                <dl className="admin_settings">
                                                    <div>
                                                        <dt>Date d’attribution</dt>
                                                        <dd>{new Date(e.purchaseDate).toLocaleDateString('fr-FR')}</dd>
                                                    </div>
                                                    <div>
                                                        <dt>Valable jusqu’au</dt>
                                                        <dd>{new Date(e.expiresAt).toLocaleDateString('fr-FR')}</dd>
                                                    </div>
                                                    <div>
                                                        <dt>Séances restantes</dt>
                                                        <dd>
                                                            {Math.max(0, e.remaining)} sur {e.total}
                                                        </dd>
                                                    </div>
                                                </dl>
                                                {(['upcoming', 'past'] as const).map((period) => {
                                                    const bookings = e.bookings
                                                        .filter((booking) =>
                                                            period === 'upcoming'
                                                                ? new Date(booking.endsAt) > new Date()
                                                                : new Date(booking.endsAt) <= new Date(),
                                                        )
                                                        .sort((a, b) =>
                                                            period === 'upcoming'
                                                                ? new Date(a.startsAt).getTime() -
                                                                  new Date(b.startsAt).getTime()
                                                                : new Date(b.startsAt).getTime() -
                                                                  new Date(a.startsAt).getTime(),
                                                        )
                                                    if (period === 'past' && bookings.length === 0) return null
                                                    return (
                                                        <section key={period} className="student_history_details">
                                                            <h4>
                                                                {period === 'upcoming'
                                                                    ? 'Séances à venir'
                                                                    : 'Séances passées'}
                                                            </h4>
                                                            {bookings.length === 0 ? (
                                                                <p className="muted">
                                                                    {period === 'upcoming'
                                                                        ? 'Aucune séance à venir.'
                                                                        : 'Aucune séance passée.'}
                                                                </p>
                                                            ) : (
                                                                <ul className="student_booking_history">
                                                                    {bookings.map((booking) => (
                                                                        <li key={booking.id}>
                                                                            {period === 'upcoming' ? (
                                                                                <strong>
                                                                                    {new Date(
                                                                                        booking.startsAt,
                                                                                    ).toLocaleDateString('fr-FR', {
                                                                                        weekday: 'long',
                                                                                        day: 'numeric',
                                                                                        month: 'long',
                                                                                        year: 'numeric',
                                                                                        timeZone: 'Europe/Paris',
                                                                                    })}{' '}
                                                                                    de{' '}
                                                                                    {new Date(
                                                                                        booking.startsAt,
                                                                                    ).toLocaleTimeString('fr-FR', {
                                                                                        hour: '2-digit',
                                                                                        minute: '2-digit',
                                                                                        timeZone: 'Europe/Paris',
                                                                                    })}{' '}
                                                                                    à{' '}
                                                                                    {new Date(
                                                                                        booking.endsAt,
                                                                                    ).toLocaleTimeString('fr-FR', {
                                                                                        hour: '2-digit',
                                                                                        minute: '2-digit',
                                                                                        timeZone: 'Europe/Paris',
                                                                                    })}
                                                                                </strong>
                                                                            ) : (
                                                                                <>
                                                                                    <strong>
                                                                                        {dateLabel(booking.startsAt)}
                                                                                    </strong>{' '}
                                                                                    ·{' '}
                                                                                    {booking.course.toLocaleUpperCase(
                                                                                        'fr-FR',
                                                                                    )}
                                                                                </>
                                                                            )}
                                                                            {(booking.status === 'CANCELLED' ||
                                                                                booking.attendance === 'PRESENT' ||
                                                                                booking.attendance === 'ABSENT' ||
                                                                                booking.status === 'COMPLETED' ||
                                                                                new Date(booking.endsAt) <=
                                                                                    new Date()) && (
                                                                                <span className="muted">
                                                                                    {' '}
                                                                                    ·{' '}
                                                                                    {booking.status === 'CANCELLED'
                                                                                        ? 'Annulée'
                                                                                        : booking.attendance ===
                                                                                            'PRESENT'
                                                                                          ? 'Présent'
                                                                                          : booking.attendance ===
                                                                                              'ABSENT'
                                                                                            ? 'Absent'
                                                                                            : booking.status ===
                                                                                                'COMPLETED'
                                                                                              ? 'Terminée'
                                                                                              : new Date(
                                                                                                      booking.endsAt,
                                                                                                  ) < new Date()
                                                                                                ? 'Passée · Présence non renseignée'
                                                                                                : ''}
                                                                                </span>
                                                                            )}
                                                                            {booking.status === 'BOOKED' && (
                                                                                <BookingActions
                                                                                    compact
                                                                                    bookingId={booking.id}
                                                                                    busy={studentBusy}
                                                                                    onBusyChange={setStudentBusy}
                                                                                    onNotify={notify}
                                                                                    onMoved={(moved) =>
                                                                                        updateIndividualBooking(
                                                                                            booking.id,
                                                                                            moved,
                                                                                        )
                                                                                    }
                                                                                    onCancelled={() =>
                                                                                        updateIndividualBooking(
                                                                                            booking.id,
                                                                                        )
                                                                                    }
                                                                                />
                                                                            )}
                                                                        </li>
                                                                    ))}
                                                                </ul>
                                                            )}
                                                        </section>
                                                    )
                                                })}
                                            </details>
                                        </li>
                                    ))}
                            </ul>
                            {!editingStudent && (
                                <StudentCredits
                                    key={student.id}
                                    userId={student.id}
                                    courses={courses}
                                    entitlements={student.entitlements}
                                    busy={studentBusy}
                                    onBusyChange={setStudentBusy}
                                    onNotify={notify}
                                    onUpdated={(entitlement) => {
                                        setStudent((current) =>
                                            current
                                                ? {
                                                      ...current,
                                                      entitlements: current.entitlements.some(
                                                          (e) => e.id === entitlement.id,
                                                      )
                                                          ? current.entitlements.map((e) =>
                                                                e.id === entitlement.id ? entitlement : e,
                                                            )
                                                          : [entitlement, ...current.entitlements],
                                                  }
                                                : null,
                                        )
                                        router.refresh()
                                    }}
                                />
                            )}
                        </div>
                    )}
                    {!editingStudent && (
                        <div className="form_actions">
                            <button
                                type="button"
                                className="btn btn-medium"
                                disabled={studentBusy}
                                onClick={() => setEditingStudent(true)}
                            >
                                Modifier
                            </button>
                            <button
                                type="button"
                                className="btn btn-medium danger"
                                disabled={studentBusy}
                                onClick={deleteStudent}
                            >
                                Supprimer l’étudiant
                            </button>
                        </div>
                    )}
                    {studentError && (
                        <p className="error" role="alert">
                            {studentError}
                        </p>
                    )}
                </SidePanel>
            )}

            {editingCourse && (
                <SidePanel titleId="admin-course-title" busy={courseBusy} onClose={() => setEditingCourse(null)}>
                    <span className="section_kicker">Modifier un cours</span>
                    <h2 id="admin-course-title">{editingCourse.name.toLocaleUpperCase('fr-FR')}</h2>
                    <CourseTemplateForm
                        onNotify={notify}
                        key={editingCourse.id}
                        teachers={teachers}
                        course={editingCourse}
                        onBusyChange={setCourseBusy}
                        onSaved={() => {
                            setEditingCourse(null)
                            setRefresh((n) => n + 1)
                        }}
                    />
                    <hr className="subtle_rule" />
                    <button
                        type="button"
                        className="btn btn-medium danger"
                        disabled={courseBusy}
                        onClick={deleteCourse}
                    >
                        Supprimer le cours
                    </button>
                    {courseError && (
                        <p className="error" role="alert">
                            {courseError}
                        </p>
                    )}
                </SidePanel>
            )}
            {creatingSlot && (
                <SidePanel
                    titleId="admin-create-slot-title"
                    busy={busy}
                    onClose={() => {
                        setCreatingSlot(false)
                        setSlotError('')
                    }}
                >
                    <div id="admin-create-slot-panel">
                        <span className="section_kicker">Gestion des créneaux</span>
                        <h2 id="admin-create-slot-title">Ajouter un créneau</h2>
                        {slotForm}
                        {slotError && (
                            <p className="error" role="alert">
                                {slotError}
                            </p>
                        )}
                    </div>
                </SidePanel>
            )}
            {editingSlot && (
                <SidePanel
                    titleId="admin-edit-slot-title"
                    busy={busy}
                    onClose={() => {
                        setSelected(editingSlot)
                        setEditingSlot(null)
                        setSlotError('')
                    }}
                >
                    <span className="section_kicker">Modifier une séance</span>
                    <h2 id="admin-edit-slot-title">{editingSlot.course.toLocaleUpperCase('fr-FR')}</h2>
                    {slotForm}
                    {slotError && (
                        <p className="error" role="alert">
                            {slotError}
                        </p>
                    )}
                </SidePanel>
            )}
            {selected && (
                <SidePanel titleId="admin-slot-title" busy={busy} onClose={() => setSelected(null)}>
                    <div className="admin_toast_region" role="status" aria-live="polite" aria-atomic="true">
                        {toast && <ToastMessage key={toast.id} message={toast.message} />}
                    </div>
                    <span className="section_kicker">Détail du créneau</span>
                    <h2 id="admin-slot-title">Séance</h2>

                    <p>{dateLabel(selected.startsAt)}</p>
                    <p className="muted">
                        Durée :{' '}
                        {(
                            (new Date(selected.endsAt).getTime() - new Date(selected.startsAt).getTime()) /
                            3600000
                        ).toLocaleString('fr-FR')}{' '}
                        h · {selected.teacher || 'Professeur à définir'}
                    </p>
                    <hr className="subtle_rule" />
                    <h3>
                        Étudiants de la séance –{' '}
                        {selected.reserved >= selected.capacity
                            ? 'Complet'
                            : `${selected.reserved}/${selected.capacity}`}
                    </h3>
                    {selected.students?.length ? (
                        <ul className="slot_registered_students" aria-label="Étudiants inscrits">
                            {selected.students.map((student) => (
                                <li key={student.bookingId}>
                                    <button
                                        type="button"
                                        className="student_profile_link"
                                        disabled={busy}
                                        onClick={() => {
                                            const profile = students.find((item) => item.id === student.id)
                                            if (!profile) return
                                            setSelected(null)
                                            setStudent(profile)
                                            setEditingStudent(false)
                                            setStudentError('')
                                        }}
                                    >
                                        {student.name}
                                    </button>
                                    <p className="muted">{student.teacher || 'Professeur à définir'}</p>
                                    <div className="slot_student_courses">
                                        {students
                                            .find((item) => item.id === student.id)
                                            ?.entitlements.filter(
                                                (entitlement) => entitlement.id === student.entitlementId,
                                            )
                                            .map((entitlement) => {
                                                const level = courses.find(
                                                    (course) => course.id === entitlement.courseId,
                                                )?.level
                                                const precedingSessions = entitlement.bookings.filter(
                                                    (booking) =>
                                                        booking.id !== student.bookingId &&
                                                        booking.status !== 'CANCELLED' &&
                                                        new Date(booking.startsAt) < new Date(selected.startsAt),
                                                ).length
                                                const sessionNumber = precedingSessions + 1
                                                return (
                                                    <div key={entitlement.id} className="slot_student_course">
                                                        <div className="slot_student_course_heading">
                                                            <span className="slot_student_course_name">
                                                                {entitlement.course}{' '}
                                                                <span className="muted" style={{ fontSize: '14px' }}>
                                                                    ({sessionNumber}/{entitlement.total})
                                                                </span>
                                                            </span>
                                                            {level && (
                                                                <span
                                                                    className={`month_event_level month_event_level_${level.toLowerCase()}`}
                                                                >
                                                                    {courseLevels[level]}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                    </div>
                                    {student.status === 'BOOKED' && (
                                        <BookingActions
                                            compact
                                            bookingId={student.bookingId}
                                            currentSlotId={selected.id}
                                            currentEntitlementId={student.entitlementId}
                                            currentTeacherId={student.teacherId}
                                            teacherOptions={teachers}
                                            courseOptions={students
                                                .find((item) => item.id === student.id)
                                                ?.entitlements.filter(
                                                    (ent) =>
                                                        ent.id === student.entitlementId ||
                                                        (ent.status === 'ACTIVE' &&
                                                            ent.remaining > 0 &&
                                                            new Date(ent.expiresAt) > new Date()),
                                                )
                                                .map((ent) => ({
                                                    id: ent.id,
                                                    course: ent.course,
                                                    level: courses.find((course) => course.id === ent.courseId)?.level,
                                                }))}

                                            busy={busy}
                                            onBusyChange={setBusy}
                                            onNotify={notify}
                                            onMoved={(moved) => updateIndividualBooking(student.bookingId, moved)}
                                            onCancelled={() => updateIndividualBooking(student.bookingId)}
                                        />
                                    )}
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="muted">Aucun étudiant inscrit à cette séance.</p>
                    )}
                    <button
                        className="btn"
                        type="button"
                        disabled={busy || !canAdd}
                        aria-expanded={studentSearchOpen}
                        aria-controls="slot-student-search"
                        onClick={() => setStudentSearchOpen((open) => !open)}
                    >
                        Ajouter un étudiant
                    </button>
                    {!canAdd && (
                        <p className="muted">
                            <br />
                            Ajout impossible : ce créneau est passé, bloqué ou complet.
                        </p>
                    )}
                    {studentSearchOpen && canAdd && (
                        <div id="slot-student-search" className="slot_student_search">
                            <label htmlFor="booking-student-search">Rechercher un étudiant</label>
                            <input
                                id="booking-student-search"
                                type="search"
                                placeholder="Nom ou adresse email"
                                autoFocus
                                value={studentSearch}
                                disabled={busy}
                                onChange={(event) => setStudentSearch(event.target.value)}
                            />
                            <p className="muted">
                                Cliquez sur un étudiant pour l’ajouter. Une séance de son cours acheté sera utilisée.
                            </p>
                            <div className="slot_student_results" aria-label="Étudiants disponibles" aria-busy={busy}>
                                {matchingStudents.map(({ student, entitlement }) => (
                                    <button
                                        key={entitlement.id}
                                        className="slot_student_result"
                                        type="button"
                                        disabled={busy}
                                        aria-label={`Ajouter ${student.name} au cours`}
                                        onClick={() => addStudent(entitlement.id)}
                                    >
                                        <span className="slot_student_result_details">
                                            <strong>{student.name}</strong>
                                            <small>
                                                {entitlement.course} ·{' '}
                                                {
                                                    courseLevels[
                                                        courses.find((course) => course.id === entitlement.courseId)
                                                            ?.level ?? 'INITIATION'
                                                    ]
                                                }{' '}
                                                · {entitlement.remaining}{' '}
                                                {entitlement.remaining > 1 ? 'séances restantes' : 'séance restante'}
                                            </small>
                                        </span>
                                        <span className="slot_student_result_add" aria-hidden="true">
                                            +
                                        </span>
                                    </button>
                                ))}
                            </div>
                            {matchingStudents.length === 0 && (
                                <p className="muted" role="status">
                                    {eligible.length === 0
                                        ? 'Aucun étudiant ne dispose de séances valides.'
                                        : 'Aucun étudiant ne correspond à votre recherche.'}
                                </p>
                            )}
                        </div>
                    )}
                    {bookingError && <Toast message={bookingError} variant="error" />}
                    {slotError && (
                        <p className="error" role="alert">
                            {slotError}
                        </p>
                    )}
                    <hr className="subtle_rule" />
                    <div className="form_actions">
                        <button
                            className="btn btn-medium"
                            disabled={busy}
                            onClick={() => {
                                const date = new Date(selected.startsAt)
                                const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
                                setStart(local.toISOString().slice(0, 16))
                                setDurationMinutes((new Date(selected.endsAt).getTime() - date.getTime()) / 60000)
                                setCapacity(selected.capacity)
                                setTeacherIds(
                                    selected.teachers?.map((teacher) => teacher.id) ??
                                        (selected.teacherId ? [selected.teacherId] : []),
                                )
                                setEditingSlot(selected)
                                setSelected(null)
                                setMessage('')
                                setSlotError('')
                            }}
                        >
                            Modifier
                        </button>
                        <button className="btn btn-medium danger" disabled={busy} onClick={remove}>
                            Supprimer
                        </button>
                    </div>
                </SidePanel>
            )}
        </>
    )
}
