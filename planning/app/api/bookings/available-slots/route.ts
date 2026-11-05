import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { db } from '@/lib/db'
import { managedBooking } from '@/lib/booking-management'
import { validateBooking } from '@/lib/booking'
export async function GET(req: NextRequest) {
    const actor = await requireRole(['STUDENT', 'ADMIN'])
    if (!actor) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    const id = req.nextUrl.searchParams.get('bookingId')
    if (!id) return NextResponse.json({ error: 'Réservation manquante.' }, { status: 400 })
    try {
        const result = await db.$transaction(
            async (tx) => {
                const booking = await managedBooking(tx, id, actor)
                const slots = await tx.slot.findMany({
                    where: {
                        id: { not: booking.slotId },
                        courseId: booking.courseId,
                        blocked: false,
                        startsAt: { gt: new Date() },
                    },
                    include: { teacher: true },
                    orderBy: { startsAt: 'asc' },
                })
                const available = []
                for (const slot of slots) {
                    try {
                        await validateBooking(
                            tx,
                            booking.userId,
                            booking.entitlementId,
                            slot.id,
                            id,
                            actor.role === 'ADMIN',
                            actor.role === 'ADMIN',
                        )
                    } catch {
                        continue
                    }
                    available.push({
                        id: slot.id,
                        startsAt: slot.startsAt.toISOString(),
                        endsAt: slot.endsAt.toISOString(),
                        teacher: slot.teacher ? `${slot.teacher.firstName} ${slot.teacher.lastName}` : null,
                    })
                }
                return available
            },
            { timeout: 15000 },
        )
        return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Chargement impossible.' },
            { status: 400 },
        )
    }
}
