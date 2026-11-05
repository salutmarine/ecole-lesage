import assert from 'node:assert/strict'
import { PrismaClient } from '@prisma/client'
import { moveBookingInTransaction, cancelBookingInTransaction } from '../lib/booking-management'
import { validateBooking } from '../lib/booking'
const db = new PrismaClient()
const rollback = new Error('Annulation des données de test')
async function main() {
    try {
        await db.$transaction(
            async (tx) => {
                const now = Date.now(),
                    day = 86400000
                const student = await tx.user.create({
                    data: {
                        firstName: 'Test',
                        lastName: 'Déplacement',
                        email: `test-move-${crypto.randomUUID()}@example.test`,
                    },
                })
                const other = await tx.user.create({
                    data: {
                        firstName: 'Autre',
                        lastName: 'Étudiant',
                        email: `test-other-${crypto.randomUUID()}@example.test`,
                    },
                })
                const actor = { id: student.id, role: 'STUDENT' },
                    admin = { id: 'test-admin', role: 'ADMIN' }
                const course = await tx.course.create({
                    data: { name: 'Test déplacement', bookingDelayHours: 24, minGapHours: 0, maxPerDay: 0 },
                })
                const createSlot = (days: number, capacity = 1) =>
                    tx.slot.create({
                        data: {
                            courseId: course.id,
                            startsAt: new Date(now + days * day),
                            endsAt: new Date(now + days * day + 3600000),
                            capacity,
                        },
                    })
                const oldSlot = await createSlot(10),
                    destination = await createSlot(12),
                    fullSlot = await createSlot(14)
                const purchase = await tx.entitlement.create({
                    data: {
                        userId: student.id,
                        courseId: course.id,
                        purchaseDate: new Date(now - day),
                        expiresAt: new Date(now + 40 * day),
                        totalSessions: 1,
                    },
                })
                const otherPurchase = await tx.entitlement.create({
                    data: {
                        userId: other.id,
                        courseId: course.id,
                        purchaseDate: new Date(now - day),
                        expiresAt: new Date(now + 40 * day),
                        totalSessions: 2,
                    },
                })
                await tx.booking.create({
                    data: {
                        userId: other.id,
                        courseId: course.id,
                        entitlementId: otherPurchase.id,
                        slotId: fullSlot.id,
                    },
                })
                const booking = await tx.booking.create({
                    data: {
                        userId: student.id,
                        courseId: course.id,
                        entitlementId: purchase.id,
                        slotId: oldSlot.id,
                        reminderSentFor: oldSlot.startsAt,
                        attendance: 'PRESENT',
                    },
                })
                await assert.rejects(moveBookingInTransaction(tx, actor, booking.id, fullSlot.id), /complet/)
                assert.deepEqual(
                    await tx.booking.findUnique({ where: { id: booking.id } }),
                    booking,
                    'Un refus doit conserver intégralement la réservation',
                )
                await assert.rejects(
                    moveBookingInTransaction(tx, { id: other.id, role: 'STUDENT' }, booking.id, destination.id),
                    /introuvable/,
                )
                const moved = await moveBookingInTransaction(tx, actor, booking.id, destination.id)
                assert.equal(moved.id, booking.id)
                assert.equal(moved.entitlementId, purchase.id)
                assert.equal(moved.slotId, destination.id)
                assert.equal(moved.reminderSentFor, null)
                assert.equal(moved.attendance, 'UNMARKED')
                assert.equal(
                    await tx.booking.count({ where: { entitlementId: purchase.id, status: 'BOOKED' } }),
                    1,
                    'Le déplacement conserve le solde, même si aucune séance n’est restante',
                )
                // A competing reservation prevents the move, and leaves the previous destination intact.
                const conflict = await tx.booking.create({
                    data: { userId: student.id, courseId: course.id, entitlementId: purchase.id, slotId: oldSlot.id },
                })
                await assert.rejects(moveBookingInTransaction(tx, actor, booking.id, oldSlot.id), /complet|réservation/)
                await tx.booking.delete({ where: { id: conflict.id } })
                const nearSlot = await createSlot(1 / 24)
                await tx.booking.update({ where: { id: booking.id }, data: { slotId: nearSlot.id } })
                await assert.rejects(moveBookingInTransaction(tx, actor, booking.id, oldSlot.id), /48 h/)
                await assert.rejects(cancelBookingInTransaction(tx, actor, booking.id), /48 h/)
                await moveBookingInTransaction(tx, admin, booking.id, oldSlot.id)
                const recentSlot = await createSlot(0.5)
                // Move the purchase date to exercise the custom delay against a future slot.
                await tx.entitlement.update({ where: { id: purchase.id }, data: { purchaseDate: new Date(now) } })
                await assert.rejects(validateBooking(tx, student.id, purchase.id, recentSlot.id, booking.id), /24 h/)
                await tx.course.update({ where: { id: course.id }, data: { bookingDelayHours: 0 } })
                await validateBooking(tx, student.id, purchase.id, recentSlot.id, booking.id)
                await cancelBookingInTransaction(tx, admin, booking.id)
                assert.equal(
                    await tx.booking.count({
                        where: { entitlementId: purchase.id, status: { in: ['BOOKED', 'COMPLETED'] } },
                    }),
                    0,
                    'Une annulation rend la séance disponible',
                )
                await assert.rejects(cancelBookingInTransaction(tx, admin, booking.id), /confirmée/)
                throw rollback
            },
            { timeout: 20000 },
        )
    } catch (error) {
        if (error !== rollback) throw error
    }
    console.log(
        'Vérifié : déplacement atomique, refus sans perte, contrôle du propriétaire, délai après achat, délai de modification, dérogation admin, annulation et solde. Données temporaires annulées.',
    )
}
main()
    .catch((error) => {
        console.error(error)
        process.exitCode = 1
    })
    .finally(() => db.$disconnect())
