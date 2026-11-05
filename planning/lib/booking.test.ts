import assert from 'node:assert/strict'
import test from 'node:test'
import { validateBooking } from './booking'

function transaction() {
    const startsAt = new Date(Date.now() + 7 * 86400000)
    const endsAt = new Date(startsAt.getTime() + 3600000)
    return {
        entitlement: {
            findUnique: async () => ({
                userId: 'student',
                courseId: 'original-course',
                status: 'ACTIVE',
                purchaseDate: new Date(Date.now() - 7 * 86400000),
                expiresAt: new Date(Date.now() + 30 * 86400000),
                totalSessions: 5,
                course: { maxPerDay: 0, maxPerWeek: 0, minGapHours: 0 },
            }),
        },
        slot: {
            findUnique: async () => ({
                courseId: 'new-course',
                blocked: false,
                startsAt,
                endsAt,
                capacity: 1,
                bookings: [{ id: 'existing-booking' }],
            }),
        },
        blockout: { findFirst: async () => null },
        booking: { findMany: async () => [], count: async () => 0 },
    } as unknown as Parameters<typeof validateBooking>[0]
}

test('permet de déplacer une réservation existante après un changement de cours par un administrateur', async () => {
    const { ent, slot } = await validateBooking(
        transaction(),
        'student',
        'purchase',
        'slot',
        'existing-booking',
        true,
        true,
    )
    assert.equal(ent.courseId, 'original-course')
    assert.equal(slot.courseId, 'new-course')
})

test('exige toujours le cours acheté pour les nouvelles réservations et les modifications sans dérogation', async () => {
    for (const [bookingId, adminOverride, preservePurchasedCourse] of [
        [undefined, true, true],
        ['existing-booking', false, true],
        ['existing-booking', true, false],
    ] as const) {
        await assert.rejects(
            validateBooking(
                transaction(),
                'student',
                'purchase',
                'slot',
                bookingId,
                adminOverride,
                preservePurchasedCourse,
            ),
            /ne correspond pas au cours acheté/,
        )
    }
})
