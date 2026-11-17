import type { Prisma } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { db } from '@/lib/db'
import { agendaPeriod, parisDate } from '@/lib/agenda-period'

export async function GET(req: NextRequest) {
    if (!(await requireRole(['TEACHER']))) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    try {
        const { from, to } = agendaPeriod(req.nextUrl.searchParams.get('date') || parisDate(new Date()), 'day')
        const query = {
            where: { startsAt: { gte: from, lt: to } },
            orderBy: { startsAt: 'asc' },
            select: {
                id: true,
                startsAt: true,
                endsAt: true,
                capacity: true,
                blocked: true,
                bookings: {
                    where: { status: { in: ['BOOKED', 'COMPLETED'] } },
                    orderBy: [{ user: { lastName: 'asc' } }, { user: { firstName: 'asc' } }],
                    select: {
                        id: true,
                        teacherId: true,
                        attendance: true,
                        status: true,
                        entitlement: {
                            select: {
                                totalSessions: true,
                                bookings: {
                                    where: { status: { in: ['BOOKED', 'COMPLETED'] } },
                                    select: { slot: { select: { startsAt: true } } },
                                },
                            },
                        },
                        user: { select: { firstName: true, lastName: true, language: true } },
                        course: { select: { id: true, name: true, level: true } },
                        teacher: { select: { firstName: true, lastName: true } },
                    },
                },
            },
        } satisfies Prisma.SlotFindManyArgs
        let slots = await db.slot.findMany(query)
        if (
            !slots.some(
                (slot) =>
                    !slot.blocked &&
                    slot.endsAt > new Date() &&
                    slot.bookings.some((booking) => booking.status === 'BOOKED'),
            ) &&
            req.nextUrl.searchParams.get('next') === '1'
        ) {
            const upcoming = await db.slot.findMany({
                ...query,
                where: {
                    startsAt: { gte: to },
                    endsAt: { gt: new Date() },
                    blocked: false,
                    bookings: { some: { status: 'BOOKED' } },
                },
                take: 1,
            })
            if (upcoming.length) slots = upcoming
        }
        return NextResponse.json(
            slots.map((slot) => ({
                id: slot.id,
                startsAt: slot.startsAt.toISOString(),
                endsAt: slot.endsAt.toISOString(),
                capacity: slot.capacity,
                blocked: slot.blocked,
                students: slot.bookings.map((booking) => ({
                    bookingId: booking.id,
                    sessionNumber:
                        1 + booking.entitlement.bookings.filter((other) => other.slot.startsAt < slot.startsAt).length,
                    totalSessions: booking.entitlement.totalSessions,
                    name: `${booking.user.firstName} ${booking.user.lastName.toLocaleUpperCase('fr-FR')}`,
                    language: booking.user.language,
                    courseId: booking.course.id,
                    course: booking.course.name,
                    level: booking.course.level,
                    teacherId: booking.teacherId,
                    teacher: booking.teacher
                        ? `${booking.teacher.firstName} ${booking.teacher.lastName.toLocaleUpperCase('fr-FR')}`
                        : null,
                    attendance: booking.attendance,
                    status: booking.status,
                })),
            })),
            { headers: { 'Cache-Control': 'no-store' } },
        )
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Chargement impossible.' },
            { status: 400 },
        )
    }
}
