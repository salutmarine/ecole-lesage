import type { Prisma } from '@prisma/client'

export async function validateSlotTeachers(
    tx: Prisma.TransactionClient,
    teacherIds: string[],
    start: Date,
    end: Date,
    excludeSlotId?: string,
) {
    for (const id of [...teacherIds].sort()) {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${id}))`
        const teacher = await tx.user.findUnique({ where: { id } })
        if (!teacher || teacher.role !== 'TEACHER') throw Error('Professeur inconnu.')
        const overlap = await tx.slot.findFirst({
            where: {
                ...(excludeSlotId ? { id: { not: excludeSlotId } } : {}),
                startsAt: { lt: end },
                endsAt: { gt: start },
                OR: [
                    { teacherId: id },
                    { teachers: { some: { id } } },
                    { bookings: { some: { teacherId: id, status: { in: ['BOOKED', 'COMPLETED'] } } } },
                ],
            },
        })
        if (overlap) throw Error(`${teacher.firstName} ${teacher.lastName} a déjà une séance à cet horaire.`)
    }
}
