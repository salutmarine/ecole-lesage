import { Prisma, PrismaClient } from '@prisma/client'
import { addHours, startOfDay, endOfDay, startOfWeek, endOfWeek } from 'date-fns'
import { db } from './db'
type Client = Prisma.TransactionClient
export async function validateBooking(
    tx: Client,
    userId: string,
    entitlementId: string,
    slotId: string,
    excludeBookingId?: string,
    adminOverride = false,
    preservePurchasedCourse = false,
) {
    const [ent, slot] = await Promise.all([
        tx.entitlement.findUnique({
            where: { id: entitlementId },
            include: { course: true },
        }),
        tx.slot.findUnique({
            where: { id: slotId },
            include: { bookings: { where: { status: 'BOOKED' } } },
        }),
    ])
    if (!ent || ent.userId !== userId || ent.status !== 'ACTIVE')
        throw Error('Droit de réservation introuvable ou suspendu.')
    if (!slot || slot.blocked) throw Error('Créneau indisponible.')
    // Only an administrator editing an existing reservation may retain its original purchase.
    if (slot.courseId !== ent.courseId && !(adminOverride && excludeBookingId && preservePurchasedCourse))
        throw Error('Ce créneau ne correspond pas au cours acheté.')
    if (slot.startsAt >= slot.endsAt) throw Error('Créneau invalide.')
    if (slot.startsAt < new Date()) throw Error('Le créneau est passé.')
    if (slot.startsAt >= ent.expiresAt) throw Error('Le cours a expiré.')
    if (slot.startsAt < ent.purchaseDate) throw Error('Créneau antérieur à l’achat.')
    if (!adminOverride && slot.startsAt < addHours(ent.purchaseDate, ent.course.bookingDelayHours ?? 72))
        throw Error(`Réservation possible ${ent.course.bookingDelayHours ?? 72} h après l’achat.`)
    const block = await tx.blockout.findFirst({
        where: { startsAt: { lt: slot.endsAt }, endsAt: { gt: slot.startsAt } },
    })
    if (block) throw Error('Une indisponibilité bloque ce créneau.')
    if (slot.bookings.filter((b) => b.id !== excludeBookingId).length >= slot.capacity)
        throw Error('Ce créneau est complet.')
    const active = await tx.booking.findMany({
        where: {
            userId,
            status: 'BOOKED',
            id: excludeBookingId ? { not: excludeBookingId } : undefined,
        },
        include: { slot: true },
    })
    if (active.some((b) => b.slot.startsAt < slot.endsAt && b.slot.endsAt > slot.startsAt))
        throw Error('Vous avez déjà une réservation à cet horaire.')
    const used = await tx.booking.count({
        where: {
            entitlementId,
            status: { in: ['BOOKED', 'COMPLETED'] },
            id: excludeBookingId ? { not: excludeBookingId } : undefined,
        },
    })
    if (used >= ent.totalSessions) throw Error('Aucune séance restante.')
    const sameCourse = active.filter((b) => b.courseId === ent.courseId)
    if (!adminOverride) {
        if (
            ent.course.maxPerDay > 0 &&
            sameCourse.filter(
                (b) => b.slot.startsAt >= startOfDay(slot.startsAt) && b.slot.startsAt <= endOfDay(slot.startsAt),
            ).length >= ent.course.maxPerDay
        )
            throw Error('Limite quotidienne atteinte.')
        if (
            ent.course.maxPerWeek > 0 &&
            sameCourse.filter(
                (b) =>
                    b.slot.startsAt >= startOfWeek(slot.startsAt, { weekStartsOn: 1 }) &&
                    b.slot.startsAt <= endOfWeek(slot.startsAt, { weekStartsOn: 1 }),
            ).length >= ent.course.maxPerWeek
        )
            throw Error('Limite hebdomadaire atteinte.')
        if (
            ent.course.minGapHours > 0 &&
            sameCourse.some(
                (b) => Math.abs(b.slot.startsAt.getTime() - slot.startsAt.getTime()) < ent.course.minGapHours * 3600000,
            )
        )
            throw Error(`Respectez ${ent.course.minGapHours}h entre deux séances.`)
    }
    return { ent, slot }
}
export async function book(userId: string, entitlementId: string, slotId: string, adminOverride = false) {
    return db.$transaction(
        async (tx) => {
            // PostgreSQL advisory lock serializes reservations of a slot and protects its capacity.
            await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${slotId}))`
            await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${entitlementId}))`
            const { ent } = await validateBooking(tx, userId, entitlementId, slotId, undefined, adminOverride)
            return tx.booking.create({
                data: { userId, entitlementId, courseId: ent.courseId, slotId },
            })
        },
        { isolationLevel: 'Serializable', timeout: 10000 },
    )
}
