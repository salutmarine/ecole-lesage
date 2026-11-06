'use client'
import { useState } from 'react'
import { courseLevels } from '@/lib/course-levels'
import { CalendarSlot, MonthCalendar, dateLabel } from '@/components/month-calendar'
import SidePanel from '@/components/side-panel'
import AttendanceControl from './attendance-control'

export default function TeacherDashboard({
    user,
    courses,
}: {
    user: { id: string; firstName: string; lastName: string }
    courses: { id: string; name: string }[]
}) {
    const [courseId, setCourseId] = useState('')
    const [selected, setSelected] = useState<CalendarSlot | null>(null)
    const [refresh, setRefresh] = useState(0)
    function close() {
        setSelected(null)
        setRefresh((value) => value + 1)
    }
    return (
        <>
            <div className="student_workspace">
                <aside className="student_summary">
                    <div className="hero_panel">
                        <div>
                            <div className="section_kicker">Professeur</div>
                            <h1>Mon agenda</h1>
                            <p>
                                {user.firstName} {user.lastName.toLocaleUpperCase('fr-FR')}
                            </p>
                            <p>Consultez vos séances et faites l’appel des étudiants.</p>
                        </div>
                    </div>
                    <div className="teacher_planning_filters">
                        <label htmlFor="teacher-course">Filtrer par cours</label>
                        <select
                            id="teacher-course"
                            value={courseId}
                            onChange={(event) => setCourseId(event.target.value)}
                        >
                            <option value="">Tous les cours</option>
                            {[...courses]
                                .sort((a, b) =>
                                    a.name.localeCompare(b.name, 'fr', { sensitivity: 'base', numeric: true }),
                                )
                                .map((course) => (
                                    <option key={course.id} value={course.id}>
                                        {course.name.toLocaleUpperCase('fr-FR')}
                                    </option>
                                ))}
                        </select>
                    </div>
                </aside>
                <div className="card student_calendar">
                    <MonthCalendar
                        mode="teacher"
                        courseId={courseId}
                        teacherId={user.id}
                        refresh={refresh}
                        onSelect={setSelected}
                    />
                </div>
            </div>
            {selected && (
                <SidePanel titleId="teacher-session-title" busy={false} onClose={close}>
                    <span className="section_kicker">Ma séance</span>
                    <h2 id="teacher-session-title">{selected.course.toLocaleUpperCase('fr-FR')}</h2>
                    {selected.level && (
                        <span className={`month_event_level month_event_level_${selected.level.toLowerCase()}`}>
                            {courseLevels[selected.level]}
                        </span>
                    )}
                    <dl className="admin_settings">
                        <div>
                            <dt>Début</dt>
                            <dd>{dateLabel(selected.startsAt)}</dd>
                        </div>
                        <div>
                            <dt>Fin</dt>
                            <dd>{dateLabel(selected.endsAt)}</dd>
                        </div>
                        <div>
                            <dt>Inscrits</dt>
                            <dd>
                                {selected.reserved} sur {selected.capacity}
                            </dd>
                        </div>
                    </dl>
                    <h3>Liste des étudiants</h3>
                    <p className="muted">Cochez les étudiants présents pour faire l’appel.</p>
                    {!selected.students?.length && <p className="muted">Aucun étudiant inscrit à cette séance.</p>}
                    {selected.students?.map((student) => (
                        <div className="slot teacher_student_row" key={student.bookingId}>
                            <AttendanceControl
                                bookingId={student.bookingId}
                                initialAttendance={student.attendance ?? 'UNMARKED'}
                                studentName={student.name}
                                canEdit={selected.teacherId === user.id}
                            />
                            {student.sessions && (
                                <span className="muted teacher_student_sessions">
                                    {student.sessions.remaining} sur {student.sessions.total}
                                    <br />
                                    {student.sessions.remaining > 1 ? 'séances restantes' : 'séance restante'}
                                </span>
                            )}
                        </div>
                    ))}
                </SidePanel>
            )}
        </>
    )
}
