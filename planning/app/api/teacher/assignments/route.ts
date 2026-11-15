import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { requireRole } from '@/lib/auth'
import { db } from '@/lib/db'
import { assignStudents } from '@/lib/teacher-assignment'

export async function POST(req: NextRequest) {
    const actor = await requireRole(['TEACHER'])
    if (!actor) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    try {
        const data = z
            .object({
                slotId: z.string().min(1),
                bookingIds: z.array(z.string().min(1)).min(1).max(100),
                release: z.boolean().default(false),
            })
            .parse(await req.json())
        const result = await db.$transaction(
            (tx) => assignStudents(tx, actor.id, data.slotId, data.bookingIds, data.release),
            { isolationLevel: 'Serializable', timeout: 10000 },
        )
        return NextResponse.json(result)
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034')
            return NextResponse.json(
                { error: 'La prise en charge a changé pendant votre sélection. Actualisez la séance et réessayez.' },
                { status: 409 },
            )
        return NextResponse.json(
            {
                error:
                    error instanceof z.ZodError
                        ? 'Sélection invalide.'
                        : error instanceof Error
                          ? error.message
                          : 'Prise en charge impossible.',
            },
            { status: 400 },
        )
    }
}
