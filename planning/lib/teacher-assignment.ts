import type { Prisma } from '@prisma/client'

export async function assignStudents(
    tx: Prisma.TransactionClient,
    teacherId: string,
    slotId: string,
    bookingIds: string[],
    release = false,
) {
    const ids = [...new Set(bookingIds)].sort()
    for (const id of ids) await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`booking:${id}`}))`
    const slot = await tx.slot.findUnique({ where: { id: slotId } })
    if (!slot || slot.blocked) throw Error('Ce créneau est indisponible.')
    if (slot.endsAt <= new Date()) throw Error('Cette séance est terminée.')
    const bookings = await tx.booking.findMany({ where: { id: { in: ids }, slotId, status: 'BOOKED' } })
    if (bookings.length !== ids.length) throw Error('Une inscription a été annulée ou déplacée. Actualisez la séance.')
    if (bookings.some((booking) => (release ? booking.teacherId !== teacherId : booking.teacherId !== null)))
        throw Error(
            release
                ? 'Vous ne pouvez libérer que vos propres élèves.'
                : 'Un élève a déjà été pris en charge. Actualisez la séance.',
        )
    if (release && bookings.some((booking) => booking.attendance !== 'UNMARKED'))
        throw Error('Un élève déjà pointé ne peut pas être libéré.')
    const result = await tx.booking.updateMany({
        where: { id: { in: ids }, slotId, status: 'BOOKED', teacherId: release ? teacherId : null },
        data: { teacherId: release ? null : teacherId },
    })
    if (result.count !== ids.length) throw Error('Les prises en charge ont changé. Actualisez la séance.')
    return { count: result.count }
}
