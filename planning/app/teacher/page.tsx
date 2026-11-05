import { redirect } from 'next/navigation'
import { sessionUser } from '@/lib/auth'
import { db } from '@/lib/db'
import Link from 'next/link'
import AttendanceControl from './attendance-control'
import { courseLevels } from '@/lib/course-levels'
export default async function Page({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
    const past = (await searchParams).view === 'past'
    const now = new Date()
    const user = await sessionUser()
    if (!user || user.role !== 'TEACHER') redirect('/')
    const slots = await db.slot.findMany({
        where: { teacherId: user.id, endsAt: past ? { lt: now } : { gte: now } },
        include: {
            course: true,
            teacher: { select: { firstName: true, lastName: true } },
            bookings: {
                where: { status: { in: ['BOOKED', 'COMPLETED'] } },
                include: {
                    user: {
                        select: {
                            firstName: true,
                            lastName: true,
                            entitlements: {
                                select: {
                                    courseId: true,
                                    totalSessions: true,
                                    _count: {
                                        select: { bookings: { where: { status: { not: 'CANCELLED' } } } },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
        orderBy: { startsAt: past ? 'desc' : 'asc' },
        take: 100,
    })
    return (
        <>
            <div className="hero_panel">
                <div>
                    <div className="section_kicker">Professeur</div>
                    <h1>Mon agenda</h1>
                    <p>Consultez les séances et pointez les élèves de vos cours.</p>
                </div>
            </div>
            <nav className="attendance_views" aria-label="Période des séances">
                <Link
                    className={past ? 'btn secondary' : 'btn'}
                    href="/teacher"
                    aria-current={!past ? 'page' : undefined}
                >
                    En cours et à venir
                </Link>
                <Link
                    className={past ? 'btn' : 'btn secondary'}
                    href="/teacher?view=past"
                    aria-current={past ? 'page' : undefined}
                >
                    Séances passées
                </Link>
            </nav>
            {slots.length === 0 && <p className="card">Aucune séance pour cette période.</p>}
            {slots.map((s) => {
                const registered = s.bookings.length
                const full = registered >= s.capacity
                const occupancy = s.capacity > 0 ? Math.min(100, Math.round((registered / s.capacity) * 100)) : 0
                return (
                    <div className="card" key={s.id}>
                        <div className="teacher_session_heading">
                            <h2>{s.course?.name || 'Cours non attribué'}</h2>
                            <p className="teacher_session_date">
                                {s.startsAt.toLocaleString('fr-FR', { dateStyle: 'full', timeStyle: 'short' })}
                            </p>
                            {s.course && (
                                <span className={`month_event_level month_event_level_${s.course.level.toLowerCase()}`}>
                                    {courseLevels[s.course.level]}
                                </span>
                            )}
                        </div>
                        <div className="session_occupancy">
                            <label htmlFor={`occupancy-${s.id}`}>
                                {registered}/{s.capacity} {registered === 1 ? 'inscrit' : 'inscrits'}
                                {full ? ' · Complet' : ''} · {occupancy} %
                            </label>
                            <progress
                                id={`occupancy-${s.id}`}
                                value={registered}
                                max={Math.max(1, s.capacity, registered)}
                            >
                                {occupancy} %
                            </progress>
                        </div>
                        {s.bookings.map((b) => {
                            const entitlements = b.user.entitlements.filter((e) => e.courseId === b.courseId)
                            const totalSessions = entitlements.reduce((total, e) => total + e.totalSessions, 0)
                            const remaining = entitlements.reduce(
                                (total, e) => total + Math.max(0, e.totalSessions - e._count.bookings),
                                0,
                            )
                            return (
                                <div className="slot" key={b.id}>
                                    <div className="attendance_row">
                                        <AttendanceControl
                                            bookingId={b.id}
                                            initialAttendance={b.attendance}
                                            studentName={`${b.user.lastName} ${b.user.firstName}`}
                                            canEdit={s.teacherId === user.id}
                                        />
                                        <span className="muted">
                                            {remaining} sur {totalSessions}{' '}
                                            {totalSessions === 1 ? 'séance restante' : 'séances restantes'}
                                        </span>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )
            })}
        </>
    )
}
