import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { db } from '@/lib/db'
import { validateBooking } from '@/lib/booking'
import { z } from 'zod'

export async function GET(req: NextRequest) {
    if (!(await requireRole(['ADMIN']))) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    const parsed = z
        .object({ userId: z.string().min(1), entitlementId: z.string().min(1) })
        .safeParse(Object.fromEntries(req.nextUrl.searchParams))
    if (!parsed.success) return NextResponse.json({ error: 'Choisissez un cours de l’étudiant.' }, { status: 400 })
    try {
        const { userId, entitlementId } = parsed.data
        const slots = await db.$transaction(
            async (tx) => {
                const entitlement = await tx.entitlement.findUnique({
                    where: { id: entitlementId },
                    include: { user: true },
                })
                if (
                    !entitlement ||
                    entitlement.userId !== userId ||
                    entitlement.user.role !== 'STUDENT' ||
                    entitlement.status !== 'ACTIVE'
                )
                    throw Error('Cours de l’étudiant indisponible.')
                const candidates = await tx.slot.findMany({
                    where: {
                        courseId: entitlement.courseId,
                        blocked: false,
                        startsAt: { gt: new Date(), gte: entitlement.purchaseDate, lt: entitlement.expiresAt },
                    },
                    include: {
                        teacher: { select: { firstName: true, lastName: true } },
                        _count: { select: { bookings: { where: { status: 'BOOKED' } } } },
                    },
                    orderBy: { startsAt: 'asc' },
                })
                const available = []
                for (const slot of candidates) {
                    try {
                        await validateBooking(tx, userId, entitlementId, slot.id, undefined, true)
                    } catch {
                        continue
                    }
                    available.push({
                        id: slot.id,
                        startsAt: slot.startsAt.toISOString(),
                        endsAt: slot.endsAt.toISOString(),
                        places: slot.capacity - slot._count.bookings,
                        teacher: slot.teacher ? `${slot.teacher.firstName} ${slot.teacher.lastName}` : null,
                    })
                }
                return available
            },
            { timeout: 15000 },
        )
        return NextResponse.json(slots, { headers: { 'Cache-Control': 'no-store' } })
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Chargement impossible.' },
            { status: 400 },
        )
    }
}
