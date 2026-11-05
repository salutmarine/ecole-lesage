import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { cancelBooking, moveBooking } from '@/lib/booking-management'
import { book } from '@/lib/booking'
import { z } from 'zod'
const createSchema = z.object({
    entitlementId: z.string(),
    slotId: z.string(),
    userId: z.string().optional(),
})
export async function POST(req: NextRequest) {
    const actor = await requireRole(['STUDENT', 'ADMIN'])
    if (!actor) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    try {
        const data = createSchema.parse(await req.json())
        const userId = actor.role === 'ADMIN' ? data.userId || actor.id : actor.id
        const booking = await book(userId, data.entitlementId, data.slotId, actor.role === 'ADMIN')
        return NextResponse.json(booking, { status: 201 })
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur' }, { status: 400 })
    }
}
export async function DELETE(req: NextRequest) {
    const actor = await requireRole(['STUDENT', 'ADMIN'])
    if (!actor) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    try {
        const { id } = z.object({ id: z.string() }).parse(await req.json())
        await cancelBooking(actor, id)
        return NextResponse.json({ ok: true })
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur' }, { status: 400 })
    }
}

export async function PATCH(req: NextRequest) {
    const actor = await requireRole(['STUDENT', 'ADMIN'])
    if (!actor) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    try {
        const { id, slotId } = z.object({ id: z.string().min(1), slotId: z.string().min(1) }).parse(await req.json())
        const booking = await moveBooking(actor, id, slotId)
        return NextResponse.json({
            id: booking.id,
            slotId: booking.slotId,
            entitlementId: booking.entitlementId,
            course: booking.slot.course?.name ?? booking.course.name,
            date: booking.slot.startsAt.toISOString(),
            endsAt: booking.slot.endsAt.toISOString(),
            status: booking.status,
            cancellationHours: booking.slot.course?.cancellationHours ?? 48,
            teacher: booking.slot.teacher ? `${booking.slot.teacher.firstName} ${booking.slot.teacher.lastName}` : null,
        })
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Déplacement impossible.' },
            { status: 400 },
        )
    }
}
