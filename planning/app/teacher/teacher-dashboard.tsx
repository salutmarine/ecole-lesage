'use client'
import StudentLanguage from '@/components/student-language'
import { useState } from 'react'
import { courseLevels } from '@/lib/course-levels'
import { parisDate } from '@/lib/agenda-period'
import { MonthCalendar, type CalendarSlot } from '@/components/month-calendar'
import SidePanel from '@/components/side-panel'
import DatePicker from '@/components/date-picker'
import AttendanceControl from './attendance-control'
import TeacherDayOrganizer from './teacher-day-organizer'

export default function TeacherDashboard({ user }: { user: { id: string; firstName: string; lastName: string } }) {
    const [view, setView] = useState<'calendar' | 'organize'>('calendar')
    const [selected, setSelected] = useState<CalendarSlot | null>(null)
    const [refresh, setRefresh] = useState(0)
    const [claiming, setClaiming] = useState<string | null>(null)
    const [claimError, setClaimError] = useState('')
    const [organizingSession, setOrganizingSession] = useState(false)
    const [callingRoll, setCallingRoll] = useState(false)
    const [attendanceBusy, setAttendanceBusy] = useState(false)
    const [organizerDate, setOrganizerDate] = useState(() => parisDate(new Date()))
    const [organizerTarget, setOrganizerTarget] = useState<{ date?: string; slotId?: string }>({})
    function close() {
        setOrganizingSession(false)
        setCallingRoll(false)
        setClaimError('')
        setSelected(null)
        setRefresh((value) => value + 1)
    }
    async function claimStudent(bookingId: string, release = false) {
        if (!selected || claiming) return
        setClaiming(bookingId)
        setClaimError('')
        try {
            const response = await fetch('/api/teacher/assignments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ slotId: selected.id, bookingIds: [bookingId], release }),
            })
            const data = await response.json()
            if (!response.ok) throw Error(data.error || 'Prise en charge impossible.')
            setSelected((current) =>
                current
                    ? {
                          ...current,
                          students: current.students?.map((student) =>
                              student.bookingId === bookingId
                                  ? {
                                        ...student,
                                        teacherId: release ? null : user.id,
                                        teacher: release ? null : `${user.firstName} ${user.lastName}`,
                                    }
                                  : student,
                          ),
                      }
                    : current,
            )
            setRefresh((value) => value + 1)
        } catch (error) {
            setClaimError(error instanceof Error ? error.message : 'Prise en charge impossible.')
        } finally {
            setClaiming(null)
        }
    }
    const studentRank = (teacherId?: string | null) => (teacherId === user.id ? 0 : teacherId ? 2 : 1)
    const sortedStudents = [...(selected?.students ?? [])].sort(
        (a, b) => studentRank(a.teacherId) - studentRank(b.teacherId),
    )
    const myStudents = sortedStudents.filter(
        (student) => student.teacherId === user.id && ['BOOKED', 'COMPLETED'].includes(student.status),
    )
    const rollcallStudents = callingRoll ? myStudents : sortedStudents
    return (
        <>
            <div className="admin_workspace">
                <div className="admin_sidebar_column">
                    <div className="hero_panel">
                        <div>
                            <span className="section_kicker">Professeur</span>
                            <h1>Mon agenda</h1>
                            <p>Consultez les séances et organisez la prise en charge de vos élèves.</p>
                        </div>
                    </div>
                    <aside className="admin_sidebar">
                        <nav aria-label="Navigation professeur">
                            <button
                                type="button"
                                className="btn"
                                aria-current={view === 'calendar' ? 'page' : undefined}
                                aria-controls="teacher-content"
                                onClick={() => {
                                    setView('calendar')
                                    setRefresh((value) => value + 1)
                                }}
                            >
                                Calendrier
                            </button>
                            <button
                                type="button"
                                className="btn"
                                aria-current={view === 'organize' ? 'page' : undefined}
                                aria-controls="teacher-content"
                                onClick={() => {
                                    setOrganizerTarget({})
                                    setView('organize')
                                }}
                            >
                                Organiser ma journée
                            </button>
                            {view === 'organize' && (
                                <div className="admin_planning_filters">
                                    <label htmlFor="teacher-date">Journée</label>
                                    <DatePicker
                                        id="teacher-date"
                                        value={organizerDate}
                                        onChange={setOrganizerDate}
                                        required
                                    />
                                </div>
                            )}
                        </nav>
                    </aside>
                </div>
                <div className="admin_content" id="teacher-content">
                    {view === 'calendar' ? (
                        <div className="card">
                            <MonthCalendar mode="teacher" refresh={refresh} onSelect={setSelected} />
                        </div>
                    ) : (
                        <TeacherDayOrganizer
                            key={organizerTarget.slotId ?? 'day'}
                            user={user}
                            date={organizerDate}
                            onDateChange={setOrganizerDate}
                            initialSlotId={organizerTarget.slotId}
                            onUpdated={() => setRefresh((value) => value + 1)}
                            onBackToCalendar={() => {
                                setView('calendar')
                                setRefresh((value) => value + 1)
                            }}
                        />
                    )}
                </div>
            </div>
            {selected && (
                <SidePanel titleId="teacher-session-title" busy={!!claiming || attendanceBusy} onClose={close}>
                    <span className="section_kicker">Détail du créneau</span>
                    <h2 id="teacher-session-title">{callingRoll ? 'Faire l’appel' : 'Séance'}</h2>
                    <p>
                        {new Date(selected.startsAt).toLocaleDateString('fr-FR', {
                            dateStyle: 'full',
                            timeZone: 'Europe/Paris',
                        })}{' '}
                        de{' '}
                        {new Date(selected.startsAt).toLocaleTimeString('fr-FR', {
                            hour: '2-digit',
                            minute: '2-digit',
                            timeZone: 'Europe/Paris',
                        })}{' '}
                        à{' '}
                        {new Date(selected.endsAt).toLocaleTimeString('fr-FR', {
                            hour: '2-digit',
                            minute: '2-digit',
                            timeZone: 'Europe/Paris',
                        })}
                    </p>
                    <p className="muted">
                        Durée :{' '}
                        {(
                            (new Date(selected.endsAt).getTime() - new Date(selected.startsAt).getTime()) /
                            3600000
                        ).toLocaleString('fr-FR')}{' '}
                        h
                    </p>
                    {selected.blocked && <p className="muted">Créneau bloqué</p>}
                    <hr className="subtle_rule" />
                    <h3>
                        {callingRoll
                            ? `Mes élèves (${myStudents.length})`
                            : `Étudiants de la séance - ${selected.reserved}/${selected.capacity}`}
                    </h3>
                    {callingRoll && (
                        <p className="muted" role="status">
                            Chaque pointage est enregistré immédiatement.
                        </p>
                    )}
                    {!selected.students?.length && <p className="muted">Aucun étudiant inscrit à cette séance.</p>}
                    {claimError && (
                        <p className="error" role="alert">
                            {claimError}
                        </p>
                    )}
                    {organizingSession && (
                        <p className="muted" role="status">
                            Cochez les élèves à prendre en charge, décochez les vôtres pour les libérer. Chaque
                            changement est enregistré immédiatement. Un élève déjà pointé ne peut pas être libéré.
                        </p>
                    )}
                    <ul className="slot_registered_students">
                        {rollcallStudents.map((student) => (
                            <li
                                key={student.bookingId}
                                className={`teacher_session_student${student.teacherId && student.teacherId !== user.id ? ' teacher_session_student_other' : ''}`}
                            >
                                {organizingSession ? (
                                    <label className="attendance_checkbox">
                                        <input
                                            type="checkbox"
                                            checked={student.teacherId === user.id}
                                            disabled={
                                                !!claiming ||
                                                !!(student.teacherId && student.teacherId !== user.id) ||
                                                student.status !== 'BOOKED' ||
                                                selected.blocked ||
                                                new Date(selected.endsAt) <= new Date() ||
                                                (student.teacherId === user.id &&
                                                    !!student.attendance &&
                                                    student.attendance !== 'UNMARKED')
                                            }
                                            onChange={() =>
                                                void claimStudent(student.bookingId, student.teacherId === user.id)
                                            }
                                        />
                                        <strong>{student.name} <StudentLanguage language={student.language} /></strong>
                                    </label>
                                ) : callingRoll ? (
                                    <AttendanceControl
                                        bookingId={student.bookingId}
                                        initialAttendance={student.attendance ?? 'UNMARKED'}
                                        studentName={student.name}
                                        studentLanguage={student.language}
                                        canEdit={!attendanceBusy}
                                        variant="rollcall"
                                        onBusyChange={setAttendanceBusy}
                                        onUpdated={(attendance) => {
                                            setSelected((current) =>
                                                current
                                                    ? {
                                                          ...current,
                                                          students: current.students?.map((item) =>
                                                              item.bookingId === student.bookingId
                                                                  ? { ...item, attendance }
                                                                  : item,
                                                          ),
                                                      }
                                                    : current,
                                            )
                                            setRefresh((value) => value + 1)
                                        }}
                                    />
                                ) : (
                                    <strong>{student.name} <StudentLanguage language={student.language} /></strong>
                                )}
                                <div className="slot_student_course_heading">
                                    <span className="slot_student_course_name">{student.course}</span>
                                    {student.level && (
                                        <span
                                            className={`month_event_level month_event_level_${student.level.toLowerCase()}`}
                                        >
                                            {courseLevels[student.level]}
                                        </span>
                                    )}
                                </div>
                                {!callingRoll && <span className="muted">
                                    {student.teacherId === user.id && !organizingSession
                                        ? `Pris en charge par vous · ${student.attendance === 'PRESENT' ? 'Présent' : student.attendance === 'ABSENT' ? 'Absent' : 'Non pointé'}`
                                        : student.teacherId === user.id
                                          ? 'Pris en charge par vous'
                                          : student.teacher
                                            ? `Avec ${student.teacher}`
                                            : 'Professeur à définir'}
                                </span>}
                                {!organizingSession &&
                                    !callingRoll &&
                                    !student.teacherId &&
                                    student.status === 'BOOKED' &&
                                    !selected.blocked &&
                                    new Date(selected.endsAt) > new Date() && (
                                        <button
                                            type="button"
                                            className="teacher_session_claim"
                                            disabled={!!claiming}
                                            aria-label={`Prendre en charge cet élève : ${student.name}`}
                                            onClick={() => void claimStudent(student.bookingId)}
                                        >
                                            <span className="btn">
                                                {claiming === student.bookingId
                                                    ? 'Enregistrement…'
                                                    : 'Prendre en charge cet élève'}
                                            </span>
                                        </button>
                                    )}
                            </li>
                        ))}
                    </ul>
                    <div className="teacher_session_actions">
                        {myStudents.length > 0 && !organizingSession && (
                            <button
                                type="button"
                                className="btn btn-medium"
                                disabled={!!claiming || attendanceBusy}
                                onClick={() => setCallingRoll((value) => !value)}
                            >
                                {callingRoll ? 'Terminer l’appel' : 'Faire l’appel'}
                            </button>
                        )}
                        {!callingRoll && !selected.blocked && new Date(selected.endsAt) > new Date() && (
                            <button
                                className="btn btn-medium"
                                type="button"
                                disabled={!!claiming}
                                onClick={() => {
                                    setClaimError('')
                                    setOrganizingSession((value) => !value)
                                }}
                            >
                                {organizingSession ? 'Terminer' : 'Organiser cette séance'}
                            </button>
                        )}
                    </div>
                </SidePanel>
            )}
        </>
    )
}
