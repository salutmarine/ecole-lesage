import { Prisma } from '@prisma/client'
import { db } from './db'
import { validateBooking } from './booking'
import { validateSlotTeachers } from './slot-teachers'

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

export async function moveBookingInTransaction(
    tx: Client,
    actor: Actor,
    id: string,
    slotId: string,
    entitlementId?: string,
    teacherId?: string | null,
) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`booking:${id}`}))`
    const booking = await managedBooking(tx, id, actor)
    for (const key of [...new Set([booking.slotId, slotId])].sort())
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${booking.entitlementId}))`
    const targetEntitlementId = actor.role === 'ADMIN' && entitlementId ? entitlementId : booking.entitlementId
    if (targetEntitlementId !== booking.entitlementId)
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${targetEntitlementId}))`
    if (teacherId !== undefined && actor.role !== 'ADMIN') throw Error('Non autorisé.')
    if (slotId === booking.slotId && targetEntitlementId === booking.entitlementId && teacherId === undefined)
        throw Error('Choisissez un autre créneau.')
    const destination = await tx.slot.findUnique({ where: { id: slotId } })
    if (!destination) throw Error('Séance introuvable.')
    const { ent } = await validateBooking(
        tx,
        booking.userId,
        targetEntitlementId,
        slotId,
        id,
        actor.role === 'ADMIN',
        actor.role === 'ADMIN',
    )
    if (teacherId) await validateSlotTeachers(tx, [teacherId], destination.startsAt, destination.endsAt, destination.id)
    return tx.booking.update({
        where: { id },
        data: {
            slotId,
            entitlementId: targetEntitlementId,
            courseId: ent.courseId,
            teacherId:
                teacherId !== undefined
                    ? teacherId
                    : slotId !== booking.slotId || ent.courseId !== booking.courseId
                      ? null
                      : booking.teacherId,
            attendance: 'UNMARKED',
            reminderSentFor: null,
        },
        include: { course: true, teacher: true, slot: { include: { course: true, teacher: true } } },
    })
}
export async function moveBooking(
    actor: Actor,
    id: string,
    slotId: string,
    entitlementId?: string,
    teacherId?: string | null,
) {
    return db.$transaction((tx) => moveBookingInTransaction(tx, actor, id, slotId, entitlementId, teacherId), {
        isolationLevel: 'Serializable',
        timeout: 15000,
    })
}
export async function cancelBookingInTransaction(tx: Client, actor: Actor, id: string) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`booking:${id}`}))`
    const booking = await managedBooking(tx, id, actor)
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${booking.slotId}))`
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${booking.entitlementId}))`
    return tx.booking.update({ where: { id }, data: { status: 'CANCELLED', teacherId: null, reminderSentFor: null } })
}
export async function cancelBooking(actor: Actor, id: string) {
    return db.$transaction((tx) => cancelBookingInTransaction(tx, actor, id), {
        isolationLevel: 'Serializable',
        timeout: 15000,
    })
}
