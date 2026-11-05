import { Prisma } from '@prisma/client'
import { db } from './db'
import { validateBooking } from './booking'

type Actor = { id: string; role: string }
type Client = Prisma.TransactionClient
export async function managedBooking(tx: Client, id: string, actor: Actor) {
    const booking = await tx.booking.findUnique({
        where: { id },
        include: { slot: { include: { course: true } }, course: true },
    })
    if (!booking || (actor.role !== 'ADMIN' && booking.userId !== actor.id)) throw Error('Réservation introuvable.')
    if (booking.status !== 'BOOKED') throw Error('Seule une réservation confirmée peut être modifiée ou annulée.')
    if (actor.role !== 'ADMIN') {
        const hours = booking.slot.course?.cancellationHours ?? 48
        if (booking.slot.startsAt <= new Date() || booking.slot.startsAt.getTime() - Date.now() < hours * 3600000)
            throw Error(`Modification ou annulation impossible moins de ${hours} h avant la séance.`)
    }
    return booking
}

export async function moveBookingInTransaction(tx: Client, actor: Actor, id: string, slotId: string) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`booking:${id}`}))`
    const booking = await managedBooking(tx, id, actor)
    for (const key of [...new Set([booking.slotId, slotId])].sort())
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${booking.entitlementId}))`
    if (slotId === booking.slotId) throw Error('Choisissez un autre créneau.')
    const destination = await tx.slot.findUnique({ where: { id: slotId } })
    if (!destination || destination.courseId !== booking.courseId) throw Error('Choisissez une séance du même cours.')
    await validateBooking(
        tx,
        booking.userId,
        booking.entitlementId,
        slotId,
        id,
        actor.role === 'ADMIN',
        actor.role === 'ADMIN',
    )
    return tx.booking.update({
        where: { id },
        data: { slotId, attendance: 'UNMARKED', reminderSentFor: null },
        include: { course: true, slot: { include: { course: true, teacher: true } } },
    })
}
export async function moveBooking(actor: Actor, id: string, slotId: string) {
    return db.$transaction((tx) => moveBookingInTransaction(tx, actor, id, slotId), {
        isolationLevel: 'Serializable',
        timeout: 15000,
    })
}
export async function cancelBookingInTransaction(tx: Client, actor: Actor, id: string) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`booking:${id}`}))`
    const booking = await managedBooking(tx, id, actor)
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${booking.slotId}))`
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${booking.entitlementId}))`
    return tx.booking.update({ where: { id }, data: { status: 'CANCELLED', reminderSentFor: null } })
}
export async function cancelBooking(actor: Actor, id: string) {
    return db.$transaction((tx) => cancelBookingInTransaction(tx, actor, id), {
        isolationLevel: 'Serializable',
        timeout: 15000,
    })
}
