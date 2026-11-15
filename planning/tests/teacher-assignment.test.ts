import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PrismaClient, type Booking } from '@prisma/client'
import { validateSlotTeachers } from '../lib/slot-teachers'
import { assignStudents } from '../lib/teacher-assignment'
import { moveBookingInTransaction } from '../lib/booking-management'

const db = new PrismaClient()
test('prises en charge en base : concurrence, partage, libération et déplacement', async () => {
    const suffix = crypto.randomUUID()
    const people: string[] = []
    let courseId = ''
    const slots: string[] = []
    try {
        for (const role of ['TEACHER', 'TEACHER', 'STUDENT', 'STUDENT', 'ADMIN'] as const) {
            const user = await db.user.create({
                data: {
                    firstName: 'Test',
                    lastName: suffix,
                    email: `${role}-${people.length}-${suffix}@example.test`,
                    role,
                },
            })
            people.push(user.id)
        }
        const course = await db.course.create({
            data: { name: `Test ${suffix}`, minGapHours: 0, bookingDelayHours: 0 },
        })
        courseId = course.id
        const start = new Date(Date.now() + 7 * 86400000)
        for (let i = 0; i < 2; i++) {
            const slot = await db.slot.create({
                data: {
                    startsAt: new Date(+start + i * 86400000),
                    endsAt: new Date(+start + i * 86400000 + 3 * 3600000),
                    capacity: 6,
                },
            })
            slots.push(slot.id)
        }
        await db.$transaction(async (tx) => {
            await validateSlotTeachers(tx, people.slice(0, 2), start, new Date(+start + 3600000), slots[0])
            await tx.slot.update({
                where: { id: slots[0] },
                data: { teachers: { set: people.slice(0, 2).map((id) => ({ id })) } },
            })
        })
        assert.equal(
            (await db.slot.findUniqueOrThrow({ where: { id: slots[0] }, include: { teachers: true } })).teachers.length,
            2,
        )
        await assert.rejects(() =>
            db.$transaction((tx) => validateSlotTeachers(tx, [people[1]], start, new Date(+start + 3600000))),
        )
        const bookings: Booking[] = []
        for (const userId of people.slice(2, 4)) {
            const entitlement = await db.entitlement.create({
                data: {
                    userId,
                    courseId,
                    totalSessions: 4,
                    purchaseDate: new Date(Date.now() - 86400000),
                    expiresAt: new Date(+start + 365 * 86400000),
                },
            })
            bookings.push(
                await db.booking.create({
                    data: { userId, courseId, entitlementId: entitlement.id, slotId: slots[0] },
                }),
            )
        }
        const claim = (teacherId: string, ids: string[], release = false) =>
            db.$transaction((tx) => assignStudents(tx, teacherId, slots[0], ids, release), {
                isolationLevel: 'Serializable',
                timeout: 10000,
            })
        assert.equal(bookings[0].teacherId, null)
        await db.$transaction((tx) =>
            moveBookingInTransaction(
                tx,
                { id: people[4], role: 'ADMIN' },
                bookings[0].id,
                slots[0],
                bookings[0].entitlementId,
                people[1],
            ),
        )
        assert.equal((await db.booking.findUniqueOrThrow({ where: { id: bookings[0].id } })).teacherId, people[1])
        await assert.rejects(() =>
            db.$transaction((tx) =>
                moveBookingInTransaction(
                    tx,
                    { id: people[2], role: 'STUDENT' },
                    bookings[0].id,
                    slots[0],
                    undefined,
                    people[0],
                ),
            ),
        )
        await db.$transaction((tx) =>
            moveBookingInTransaction(
                tx,
                { id: people[4], role: 'ADMIN' },
                bookings[0].id,
                slots[0],
                bookings[0].entitlementId,
                null,
            ),
        )

        const race = await Promise.allSettled([claim(people[0], [bookings[0].id]), claim(people[1], [bookings[0].id])])
        assert.equal(race.filter((result) => result.status === 'fulfilled').length, 1)
        const winner = (await db.booking.findUniqueOrThrow({ where: { id: bookings[0].id } })).teacherId!
        const other = winner === people[0] ? people[1] : people[0]
        await assert.rejects(() => claim(other, [bookings[0].id, bookings[1].id]))
        assert.equal((await db.booking.findUniqueOrThrow({ where: { id: bookings[1].id } })).teacherId, null)
        await claim(other, [bookings[1].id])
        await assert.rejects(() => claim(other, [bookings[0].id], true))
        await claim(winner, [bookings[0].id], true)
        await claim(winner, [bookings[0].id])
        await db.booking.update({ where: { id: bookings[0].id }, data: { attendance: 'PRESENT' } })
        await assert.rejects(() => claim(winner, [bookings[0].id], true))
        const unauthorizedAttendance = await db.booking.updateMany({
            where: { id: bookings[0].id, teacherId: other },
            data: { attendance: 'ABSENT' },
        })
        assert.equal(unauthorizedAttendance.count, 0)
        await db.$transaction((tx) =>
            moveBookingInTransaction(tx, { id: people[4], role: 'ADMIN' }, bookings[0].id, slots[1]),
        )
        assert.equal((await db.booking.findUniqueOrThrow({ where: { id: bookings[0].id } })).teacherId, null)
        await assert.rejects(() => claim(winner, [bookings[0].id]))
    } finally {
        // Only fixtures created by this test are removed.
        await db.booking.deleteMany({ where: { slotId: { in: slots } } })
        await db.entitlement.deleteMany({ where: { courseId } })
        await db.slot.deleteMany({ where: { id: { in: slots } } })
        if (courseId) await db.course.delete({ where: { id: courseId } })
        await db.user.deleteMany({ where: { id: { in: people } } })
        await db.$disconnect()
    }
})
