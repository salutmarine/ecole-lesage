'use client'
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
    const [organizerDate, setOrganizerDate] = useState(() => parisDate(new Date()))
    const [organizerTarget, setOrganizerTarget] = useState<{ date?: string; slotId?: string }>({})
    function close() {
        setSelected(null)
        setRefresh((value) => value + 1)
    }
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
                <SidePanel titleId="teacher-session-title" busy={false} onClose={close}>
                    <span className="section_kicker">Détail du créneau</span>
                    <h2 id="teacher-session-title">Séance</h2>
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
                        Étudiants de la séance - {selected.reserved}/{selected.capacity}
                    </h3>
                    {!selected.students?.length && <p className="muted">Aucun étudiant inscrit à cette séance.</p>}
                    <ul className="slot_registered_students">
                        {selected.students?.map((student) => (
                            <li key={student.bookingId}>
                                {student.teacherId === user.id ? (
                                    <AttendanceControl
                                        bookingId={student.bookingId}
                                        initialAttendance={student.attendance ?? 'UNMARKED'}
                                        studentName={student.name}
                                        canEdit
                                    />
                                ) : (
                                    <strong>{student.name}</strong>
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
                                <span className="muted">
                                    {student.teacherId === user.id
                                        ? 'Pris en charge par vous'
                                        : student.teacher
                                          ? `Avec ${student.teacher}`
                                          : 'Professeur à définir'}
                                </span>
                            </li>
                        ))}
                    </ul>
                    {!selected.blocked && new Date(selected.endsAt) > new Date() && (
                        <button
                            className="btn btn-medium"
                            type="button"
                            onClick={() => {
                                setOrganizerDate(parisDate(new Date(selected.startsAt)))
                                setOrganizerTarget({ slotId: selected.id })
                                setSelected(null)
                                setView('organize')
                            }}
                        >
                            Organiser cette séance
                        </button>
                    )}
                </SidePanel>
            )}
        </>
    )
}
