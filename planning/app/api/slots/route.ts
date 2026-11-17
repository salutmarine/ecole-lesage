import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'
export async function GET(req: NextRequest) {
    const user = await requireRole(['ADMIN', 'STUDENT', 'TEACHER'])
    if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    const month = req.nextUrl.searchParams.get('month')
    if (!month || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month))
        return NextResponse.json({ error: 'Mois invalide (YYYY-MM)' }, { status: 400 })
    const [y, m] = month.split('-').map(Number)
    const from = new Date(y, m - 1, 1),
        to = new Date(y, m, 1)
    const slots = await db.slot.findMany({
        where: {
            startsAt: { gte: from, lt: to },
        },
        include: {
            course: true,
            teachers: { select: { id: true, firstName: true, lastName: true } },
            teacher: { select: { id: true, firstName: true, lastName: true } },
            _count: { select: { bookings: { where: { status: { in: ['BOOKED', 'COMPLETED'] } } } } },
            bookings: {
                where: {
                    status: { in: ['BOOKED', 'COMPLETED'] },
                    ...(user.role !== 'STUDENT' ? {} : { id: { in: [] } }),
                },
                select: {
                    id: true,
                    entitlementId: true,
                    teacherId: true,
                    teacher: { select: { id: true, firstName: true, lastName: true } },
                    course: { select: { name: true, level: true } },
                    status: true,
                    attendance: true,
                    user: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            email: true,
                            phone: true,
                            language: true,
                            entitlements: {
                                select: {
                                    courseId: true,
                                    totalSessions: true,
                                    status: true,
                                    purchaseDate: true,
                                    expiresAt: true,
                                    _count: {
                                        select: {
                                            bookings: {
                                                where: {
                                                    status: { not: 'CANCELLED' },
                                                    slot: { endsAt: { lte: new Date() } },
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
                orderBy: [{ user: { lastName: 'asc' } }, { user: { firstName: 'asc' } }],
            },
        },
        orderBy: { startsAt: 'asc' },
    })
    return NextResponse.json(
        slots.map((s) => {
            const teachers = [
                ...new Map(
                    [
                        ...s.teachers,
                        ...(s.teacher ? [s.teacher] : []),
                        ...s.bookings.flatMap((booking) => (booking.teacher ? [booking.teacher] : [])),
                    ].map((teacher) => [
                        teacher.id,
                        { id: teacher.id, name: `${teacher.firstName} ${teacher.lastName.toLocaleUpperCase('fr-FR')}` },
                    ]),
                ).values(),
            ].sort((a, b) => a.name.localeCompare(b.name, 'fr'))
            return {
                id: s.id,
                courseId: s.courseId,
                course: 'Séance',
                level: s.course?.level ?? null,
                startsAt: s.startsAt.toISOString(),
                endsAt: s.endsAt.toISOString(),
                capacity: s.capacity,
                cancellationHours: s.course?.cancellationHours ?? 48,
                blocked: s.blocked,
                teacherId: s.teacherId,
                teachers: user.role === 'STUDENT' ? [] : teachers,
                teacher: user.role === 'STUDENT' ? null : teachers.map((teacher) => teacher.name).join(', ') || null,
                reserved: s._count.bookings,
                ...(user.role !== 'STUDENT'
                    ? {
                          students: s.bookings.map((booking) => ({
                              bookingId: booking.id,
                              entitlementId: booking.entitlementId,
                              teacherId: booking.teacherId,
                              teacher: booking.teacher
                                  ? `${booking.teacher.firstName} ${booking.teacher.lastName.toLocaleUpperCase('fr-FR')}`
                                  : null,
                              course: booking.course.name,
                              level: booking.course.level,
                              status: booking.status,
                              attendance: booking.attendance,
                              phone: booking.user.phone,
                              id: booking.user.id,
                              name: `${booking.user.firstName} ${booking.user.lastName.toLocaleUpperCase('fr-FR')}`,
                              email: booking.user.email,
                              language: booking.user.language,
                              sessions: booking.user.entitlements
                                  .filter(
                                      (entitlement) =>
                                          entitlement.status === 'ACTIVE' &&
                                          entitlement.purchaseDate <= new Date() &&
                                          entitlement.expiresAt > new Date(),
                                  )
                                  .reduce(
                                      (summary, entitlement) => ({
                                          total: summary.total + entitlement.totalSessions,
                                          remaining:
                                              summary.remaining +
                                              Math.max(0, entitlement.totalSessions - entitlement._count.bookings),
                                      }),
                                      { total: 0, remaining: 0 },
                                  ),
                          })),
                      }
                    : {}),
            }
        }),
    )
}
