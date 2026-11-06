import { redirect } from 'next/navigation'
import { sessionUser } from '@/lib/auth'
import { db } from '@/lib/db'
import AdminDashboard from './admin-dashboard'
import type { AdminSection } from '@/lib/admin-navigation'
export default async function AdminPage({ section }: { section: AdminSection }) {
    const user = await sessionUser()
    if (!user || user.role !== 'ADMIN') redirect('/')
    const now = new Date()
    const [students, courses, teachers] = await Promise.all([
        db.user.findMany({
            where: { role: 'STUDENT' },
            include: {
                bookings: { select: { createdAt: true }, orderBy: { createdAt: 'desc' }, take: 1 },
                entitlements: {
                    include: {
                        course: true,
                        bookings: {
                            include: { slot: true, course: true },
                            orderBy: { slot: { startsAt: 'desc' } },
                        },
                    },
                    orderBy: { purchaseDate: 'desc' },
                },
            },
            orderBy: { lastName: 'asc' },
        }),
        db.course.findMany({ orderBy: { name: 'asc' } }),
        db.user.findMany({
            where: { role: 'TEACHER' },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                defaultCourses: { select: { id: true, name: true, level: true }, orderBy: { name: 'asc' } },
                teachingSlots: {
                    where: { startsAt: { gte: now }, blocked: false },
                    orderBy: { startsAt: 'asc' },
                    select: { startsAt: true, course: { select: { id: true, name: true, level: true } } },
                },
            },
            orderBy: { lastName: 'asc' },
        }),
    ])
    return (
        <AdminDashboard
            section={section}
            students={students.map((s) => ({
                id: s.id,
                name: `${s.firstName} ${s.lastName.toLocaleUpperCase('fr-FR')}`,
                email: s.email,
                firstName: s.firstName,
                lastName: s.lastName,
                phone: s.phone,
                language: s.language,
                lastBookingAt: s.bookings[0]?.createdAt.toISOString() ?? null,
                entitlements: s.entitlements.map((e) => ({
                    id: e.id,
                    courseId: e.courseId,
                    status: e.status,
                    purchaseDate: e.purchaseDate.toISOString(),
                    expiresAt: e.expiresAt.toISOString(),
                    course: e.course.name,
                    total: e.totalSessions,
                    bookings: e.bookings.map((b) => ({
                        id: b.id,
                        course: b.course.name,
                        startsAt: b.slot.startsAt.toISOString(),
                        endsAt: b.slot.endsAt.toISOString(),
                        status: b.status,
                        attendance: b.attendance,
                    })),
                    remaining: e.totalSessions - e.bookings.filter((b) => b.status !== 'CANCELLED').length,
                })),
            }))}
            teachers={teachers.map((teacher) => ({
                id: teacher.id,
                firstName: teacher.firstName,
                lastName: teacher.lastName,
                name: `${teacher.firstName} ${teacher.lastName.toLocaleUpperCase('fr-FR')}`,
                email: teacher.email,
                nextSession: teacher.teachingSlots[0]
                    ? {
                          startsAt: teacher.teachingSlots[0].startsAt.toISOString(),
                          course: teacher.teachingSlots[0].course?.name ?? 'Cours non attribué',
                      }
                    : null,
                assignedCourses: [
                    ...new Map(
                        [
                            ...teacher.defaultCourses,
                            ...teacher.teachingSlots.flatMap((slot) => (slot.course ? [slot.course] : [])),
                        ].map((course) => [course.id, course]),
                    ).values(),
                ]
                    .sort((a, b) => a.name.localeCompare(b.name, 'fr'))
                    .map((course) => ({
                        ...course,
                        nextSessionAt:
                            teacher.teachingSlots
                                .find((slot) => slot.course?.id === course.id)
                                ?.startsAt.toISOString() ?? null,
                    })),
            }))}
            courses={courses.map((c) => ({
                id: c.id,
                name: c.name,
                level: c.level,
                totalDurationMinutes:
                    c.totalDurationMinutes ?? (c.durationMinutes ?? c.durationHours * 60) * c.sessionsCount,
                durationMinutes: c.durationMinutes ?? c.durationHours * 60,
                capacity: c.capacity,
                reminderDays: c.reminderDays,
                cancellationHours: c.cancellationHours,
                defaultTeacherId: c.defaultTeacherId,
                minGapHours: c.minGapHours,
                bookingDelayHours: c.bookingDelayHours,
            }))}
        />
    )
}
