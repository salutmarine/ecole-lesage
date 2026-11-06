import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth'
import { validateBooking } from '@/lib/booking'
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
        where: { startsAt: { gte: from, lt: to }, ...(user.role === 'TEACHER' ? { teacherId: user.id } : {}) },
        include: {
            course: true,
            teacher: { select: { firstName: true, lastName: true } },
            _count: { select: { bookings: { where: { status: { in: ['BOOKED', 'COMPLETED'] } } } } },
            bookings: {
                where: {
                    status: { in: ['BOOKED', 'COMPLETED'] },
                    ...(user.role !== 'STUDENT' ? {} : { id: { in: [] } }),
                },
                select: {
                    id: true,
                    status: true,
                    attendance: true,
                    user: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            email: true,
                            phone: true,
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
    let visibleSlots = slots
    if (user.role === 'STUDENT') {
        const reservations = await db.booking.findMany({
            where: {
                userId: user.id,
                status: { in: ['BOOKED', 'COMPLETED'] },
                slotId: { in: slots.map((slot) => slot.id) },
            },
            select: { slotId: true },
        })
        const bookedIds = new Set(reservations.map((booking) => booking.slotId))
        const entitlements = await db.entitlement.findMany({
            where: { userId: user.id, status: 'ACTIVE', expiresAt: { gt: new Date() } },
            orderBy: { expiresAt: 'asc' },
        })
        visibleSlots = []
        for (const slot of slots) {
            if (bookedIds.has(slot.id)) {
                visibleSlots.push(slot)
                continue
            }
            if (slot.blocked || slot.startsAt <= new Date() || slot._count.bookings >= slot.capacity) continue
            for (const entitlement of entitlements.filter((entitlement) => entitlement.courseId === slot.courseId)) {
                try {
                    await validateBooking(db, user.id, entitlement.id, slot.id)
                    visibleSlots.push(slot)
                    break
                } catch {
                    // Hide slots that fail the same eligibility checks as a reservation.
                }
            }
        }
    }
    return NextResponse.json(
        visibleSlots.map((s) => ({
            id: s.id,
            courseId: s.courseId,
            course: s.course?.name || 'Cours non attribué',
            level: s.course?.level ?? null,
            startsAt: s.startsAt.toISOString(),
            endsAt: s.endsAt.toISOString(),
            capacity: s.capacity,
            cancellationHours: s.course?.cancellationHours ?? 48,
            blocked: s.blocked,
            teacherId: s.teacherId,
            teacher: s.teacher ? `${s.teacher.firstName} ${s.teacher.lastName.toLocaleUpperCase('fr-FR')}` : null,
            reserved: s._count.bookings,
            ...(user.role !== 'STUDENT'
                ? {
                      students: s.bookings.map((booking) => ({
                          bookingId: booking.id,
                          status: booking.status,
                          attendance: booking.attendance,
                          phone: booking.user.phone,
                          id: booking.user.id,
                          name: `${booking.user.firstName} ${booking.user.lastName.toLocaleUpperCase('fr-FR')}`,
                          email: booking.user.email,
                          sessions: booking.user.entitlements
                              .filter(
                                  (entitlement) =>
                                      entitlement.courseId === s.courseId &&
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
        })),
    )
}
