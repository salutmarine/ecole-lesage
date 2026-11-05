import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { db } from '@/lib/db'
import { z } from 'zod'

const schema = z.object({
    bookingId: z.string().min(1),
    attendance: z.enum(['UNMARKED', 'PRESENT', 'ABSENT']),
})
export async function PATCH(req: NextRequest) {
    const actor = await requireRole(['TEACHER'])
    if (!actor) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    try {
        const { bookingId, attendance } = schema.parse(await req.json())
        const result = await db.booking.updateMany({
            where: { id: bookingId, status: { in: ['BOOKED', 'COMPLETED'] }, slot: { teacherId: actor.id } },
            data: { attendance },
        })
        if (!result.count)
            return NextResponse.json(
                { error: 'Inscription introuvable ou séance non affectée à votre compte.' },
                { status: 404 },
            )
        return NextResponse.json({ attendance })
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof z.ZodError ? 'Pointage invalide.' : 'Impossible d’enregistrer le pointage.' },
            { status: 400 },
        )
    }
}
