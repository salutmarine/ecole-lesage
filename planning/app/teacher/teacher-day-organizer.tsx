'use client'
import { useEffect, useState } from 'react'
import { courseLevels, type CourseLevel } from '@/lib/course-levels'
import { parisDate } from '@/lib/agenda-period'
import type { TeacherSession } from '@/lib/teacher-sessions'
import AttendanceControl from './attendance-control'
import Toast from '@/components/toast'

export default function TeacherDayOrganizer({
    user,
    date,
    onDateChange,
    initialSlotId,
    onUpdated,
}: {
    user: { id: string; firstName: string; lastName: string }
    date: string
    onDateChange: (date: string) => void
    initialSlotId?: string
    onUpdated?: () => void
}) {
    const [fallbackFrom, setFallbackFrom] = useState('')
    const [fallbackDate, setFallbackDate] = useState('')
    const [sessions, setSessions] = useState<TeacherSession[]>([])
    const [selectedId, setSelectedId] = useState(initialSlotId || '')
    const [checked, setChecked] = useState<string[]>([])
    const [level, setLevel] = useState('')
    const [courseId, setCourseId] = useState('')
    const [mine, setMine] = useState(false)
    const [refresh, setRefresh] = useState(0)
    const [loading, setLoading] = useState(true)
    const [busy, setBusy] = useState(false)
    const [loadError, setLoadError] = useState('')
    const [toast, setToast] = useState<{ id: number; message: string; error: boolean } | null>(null)
    const notify = (message: string, error = false) => setToast((old) => ({ id: (old?.id ?? 0) + 1, message, error }))
    useEffect(() => {
        const controller = new AbortController()
        setLoading(true)
        setLoadError('')
        setChecked([])
        fetch(`/api/teacher/sessions?${new URLSearchParams({ date, next: '1' })}`, {
            signal: controller.signal,
            cache: 'no-store',
        })
            .then(async (response) => {
                const data = await response.json()
                if (!response.ok) throw Error(data.error || 'Chargement impossible.')
                return data as TeacherSession[]
            })
            .then((data) => {
                if (controller.signal.aborted) return
                if (data[0] && parisDate(new Date(data[0].startsAt)) !== date) {
                    setFallbackFrom(date)
                    setFallbackDate(parisDate(new Date(data[0].startsAt)))
                    setSelectedId(data[0].id)
                    onDateChange(parisDate(new Date(data[0].startsAt)))
                    return
                }
                setSessions(data)
                setSelectedId((current) =>
                    data.some((session) => session.id === current)
                        ? current
                        : (data.find(
                              (session) =>
                                  !session.blocked &&
                                  new Date(session.endsAt) > new Date() &&
                                  session.students.some((student) => student.status === 'BOOKED'),
                          )?.id ??
                          data[0]?.id ??
                          ''),
                )
            })
            .catch((error) => {
                if (!controller.signal.aborted) setLoadError(error.message)
            })
            .finally(() => {
                if (!controller.signal.aborted) setLoading(false)
            })
        return () => controller.abort()
    }, [date, refresh, onDateChange])
    useEffect(() => {
        setCourseId('')
        setLevel('')
    }, [date])
    // Refresh other teachers’ claims while this view is open.
    useEffect(() => {
        const timer = window.setInterval(() => {
            if (!busy && checked.length === 0 && document.visibilityState === 'visible')
                setRefresh((value) => value + 1)
        }, 30000)
        return () => window.clearInterval(timer)
    }, [busy, checked.length])
    const selected = sessions.find((session) => session.id === selectedId)
    const availableSessions = mine
        ? sessions.filter((session) => session.students.some((student) => student.teacherId === user.id))
        : sessions
    const courseOptions = [
        ...new Map((selected?.students ?? []).map((student) => [student.courseId, student.course])).entries(),
    ].sort((a, b) => a[1].localeCompare(b[1], 'fr'))
    const visible = (selected?.students ?? []).filter(
        (student) =>
            (!mine || student.teacherId === user.id) &&
            (!level || student.level === level) &&
            (!courseId || student.courseId === courseId),
    )
    const ended = !!selected && new Date(selected.endsAt) <= new Date()
    const canClaim = !!selected && !selected.blocked && !ended && !loading && !loadError
    const time = (iso: string) =>
        new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })
    async function assign(releaseIds?: string[]) {
        if (!selected || busy || !canClaim) return
        const ids = releaseIds ?? checked
        if (!ids.length) return
        setBusy(true)
        try {
            const response = await fetch('/api/teacher/assignments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ slotId: selected.id, bookingIds: ids, release: !!releaseIds }),
            })
            const data = await response.json()
            if (!response.ok) throw Error(data.error || 'Prise en charge impossible.')
            setSessions((current) =>
                current.map((session) =>
                    session.id === selected.id
                        ? {
                              ...session,
                              students: session.students.map((student) =>
                                  ids.includes(student.bookingId)
                                      ? {
                                            ...student,
                                            teacherId: releaseIds ? null : user.id,
                                            teacher: releaseIds
                                                ? null
                                                : `${user.firstName} ${user.lastName.toLocaleUpperCase('fr-FR')}`,
                                        }
                                      : student,
                              ),
                          }
                        : session,
                ),
            )
            setChecked([])
            onUpdated?.()
            notify(releaseIds ? 'Élève libéré.' : `${data.count} élève(s) ajouté(s) à votre journée.`)
        } catch (error) {
            notify(error instanceof Error ? error.message : 'Prise en charge impossible.', true)
        } finally {
            setBusy(false)
            setRefresh((value) => value + 1)
        }
    }
    function changeSlot(id: string) {
        setSelectedId(id)
        setChecked([])
        setCourseId('')
        setLevel('')
    }
    return (
        <div className="card teacher_dispatch">
            {toast && <Toast key={toast.id} message={toast.message} variant={toast.error ? 'error' : 'success'} />}
            <div className="teacher_dispatch_header">
                <div>
                    <h2>
                        Organiser ma journée du{' '}
                        {new Date(`${date}T12:00:00`).toLocaleDateString('fr-FR', {
                            weekday: 'long',
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                        })}
                    </h2>
                </div>
            </div>

            {loading && <p role="status">Chargement des séances…</p>}
            {loadError && (
                <p role="alert" className="error">
                    {loadError}
                </p>
            )}
            {!loading && !loadError && (
                <>
                    <div className="teacher_dispatch_slots" aria-label="Créneaux de la journée">
                        {availableSessions.map((session) => (
                            <button
                                key={session.id}
                                type="button"
                                className={`btn teacher_dispatch_slot ${session.id === selectedId ? '' : 'secondary'}`}
                                disabled={busy}
                                aria-pressed={session.id === selectedId}
                                onClick={() => changeSlot(session.id)}
                            >
                                <strong>
                                    {time(session.startsAt)} – {time(session.endsAt)}
                                </strong>
                                <span>
                                    {
                                        session.students.filter(
                                            (student) => !student.teacherId && student.status === 'BOOKED',
                                        ).length
                                    }{' '}
                                    élève(s) sans professeur
                                </span>
                                {session.blocked ? (
                                    <span>Bloqué</span>
                                ) : new Date(session.endsAt) <= new Date() ? (
                                    <span>Terminé</span>
                                ) : null}
                            </button>
                        ))}
                    </div>
                    {availableSessions.length === 0 && (
                        <p className="muted">
                            {mine
                                ? 'Vous ne prenez encore aucun élève en charge ce jour-là.'
                                : 'Aucun créneau ce jour-là et aucun prochain créneau à venir.'}
                        </p>
                    )}
                    {selected && availableSessions.some((session) => session.id === selected.id) && (
                        <section className="teacher_dispatch_roster" aria-labelledby="teacher-session-heading">
                            <h2 id="teacher-session-heading">
                                Séance de {time(selected.startsAt)} à {time(selected.endsAt)}
                            </h2>
                            <p className="muted">
                                {selected.students.length} inscrit(s) ·{' '}
                                {selected.students.filter((student) => student.teacherId === user.id).length} pris en
                                charge par vous
                            </p>
                            <div className="teacher_dispatch_filters">
                                <div>
                                    <label htmlFor="teacher-level">Niveau</label>
                                    <select
                                        id="teacher-level"
                                        value={level}
                                        disabled={busy}
                                        onChange={(event) => {
                                            setLevel(event.target.value)
                                            setChecked([])
                                        }}
                                    >
                                        <option value="">Tous les niveaux</option>
                                        {Object.entries(courseLevels).map(([value, label]) => (
                                            <option key={value} value={value}>
                                                {label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label htmlFor="teacher-course">Cours</label>
                                    <select
                                        id="teacher-course"
                                        value={courseId}
                                        disabled={busy}
                                        onChange={(event) => {
                                            setCourseId(event.target.value)
                                            setChecked([])
                                        }}
                                    >
                                        <option value="">Tous les cours</option>
                                        {courseOptions.map(([id, name]) => (
                                            <option key={id} value={id}>
                                                {name.toLocaleUpperCase('fr-FR')}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <button
                                    className="btn secondary"
                                    type="button"
                                    disabled={
                                        busy ||
                                        !canClaim ||
                                        !visible.some((student) => !student.teacherId && student.status === 'BOOKED')
                                    }
                                    onClick={() =>
                                        setChecked(
                                            visible
                                                .filter((student) => !student.teacherId && student.status === 'BOOKED')
                                                .map((student) => student.bookingId),
                                        )
                                    }
                                >
                                    Sélectionner les élèves disponibles
                                </button>
                            </div>
                            {ended && (
                                <p className="muted">
                                    Séance terminée : les prises en charge ne sont plus modifiables.
                                </p>
                            )}
                            {selected.blocked && <p className="muted">Ce créneau est bloqué.</p>}
                            <ul className="teacher_dispatch_students">
                                {visible.map((student) => (
                                    <li key={student.bookingId}>
                                        <div className="teacher_dispatch_student">
                                            {student.teacherId === user.id ? (
                                                <AttendanceControl
                                                    key={`${student.bookingId}-${student.attendance}`}
                                                    bookingId={student.bookingId}
                                                    initialAttendance={student.attendance}
                                                    studentName={student.name}
                                                    canEdit={!busy}
                                                />
                                            ) : (
                                                <label className="attendance_checkbox">
                                                    <input
                                                        type="checkbox"
                                                        checked={checked.includes(student.bookingId)}
                                                        disabled={
                                                            busy ||
                                                            !canClaim ||
                                                            !!student.teacherId ||
                                                            student.status !== 'BOOKED'
                                                        }
                                                        onChange={(event) =>
                                                            setChecked((current) =>
                                                                event.target.checked
                                                                    ? [...current, student.bookingId]
                                                                    : current.filter((id) => id !== student.bookingId),
                                                            )
                                                        }
                                                    />
                                                    <span>{student.name}</span>
                                                </label>
                                            )}
                                            <div className="teacher_dispatch_course">
                                                <span>
                                                    {student.course.toLocaleUpperCase('fr-FR')}{' '}
                                                    <span className="muted">
                                                        ({student.sessionNumber}/{student.totalSessions})
                                                    </span>
                                                </span>
                                                <span
                                                    className={`month_event_level month_event_level_${student.level.toLowerCase()}`}
                                                >
                                                    {courseLevels[student.level as CourseLevel]}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="teacher_dispatch_owner">
                                            <span className="muted">
                                                {student.teacherId === user.id
                                                    ? 'Pris en charge par vous'
                                                    : student.teacher
                                                      ? `Avec ${student.teacher}`
                                                      : 'Sans professeur'}
                                            </span>
                                            {student.teacherId === user.id &&
                                                canClaim &&
                                                student.attendance === 'UNMARKED' &&
                                                student.status === 'BOOKED' && (
                                                    <button
                                                        type="button"
                                                        className="btn danger"
                                                        disabled={busy}
                                                        onClick={() => void assign([student.bookingId])}
                                                    >
                                                        Libérer cet élève
                                                    </button>
                                                )}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                            {!visible.length && <p className="muted">Aucun élève ne correspond à ces critères.</p>}
                            <div className="teacher_dispatch_footer">
                                <button
                                    type="button"
                                    className="btn btn-medium"
                                    disabled={busy || !canClaim || checked.length === 0}
                                    onClick={() => void assign()}
                                >
                                    {busy
                                        ? 'Enregistrement…'
                                        : `Prendre en charge ${checked.length} ${checked.length === 1 ? 'élève' : 'élèves'}`}
                                </button>
                            </div>
                        </section>
                    )}
                </>
            )}
        </div>
    )
}
