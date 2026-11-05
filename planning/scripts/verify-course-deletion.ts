import assert from 'node:assert/strict'
import { PrismaClient } from '@prisma/client'
import { deleteCourseWithRelations } from '../lib/admin-courses'

const db = new PrismaClient()
const rollback = new Error('Rollback des données de vérification')
async function main() {
    try {
        await db.$transaction(
            async (tx) => {
                const student = await tx.user.create({
                    data: {
                        email: `test-delete-${crypto.randomUUID()}@example.test`,
                        firstName: 'Test',
                        lastName: 'Suppression',
                    },
                })
                const target = await tx.course.create({ data: { name: 'Test suppression' } })
                const other = await tx.course.create({ data: { name: 'Test conservation' } })
                const start = new Date(Date.now() + 86400000)
                const end = new Date(start.getTime() + 10800000)
                const targetSlot = await tx.slot.create({ data: { courseId: target.id, startsAt: start, endsAt: end } })
                const otherSlot = await tx.slot.create({ data: { courseId: other.id, startsAt: start, endsAt: end } })
                const entitlementData = {
                    userId: student.id,
                    totalSessions: 10,
                    purchaseDate: new Date(),
                    expiresAt: new Date(Date.now() + 31536000000),
                }
                const targetPurchase = await tx.entitlement.create({
                    data: { ...entitlementData, courseId: target.id },
                })
                const otherPurchase = await tx.entitlement.create({ data: { ...entitlementData, courseId: other.id } })
                const booking = (courseId: string, slotId: string, entitlementId: string) =>
                    tx.booking.create({ data: { userId: student.id, courseId, slotId, entitlementId } })
                await booking(target.id, targetSlot.id, targetPurchase.id)
                await booking(target.id, otherSlot.id, otherPurchase.id)
                await booking(other.id, targetSlot.id, otherPurchase.id)
                await booking(other.id, otherSlot.id, targetPurchase.id)
                const kept = await booking(other.id, otherSlot.id, otherPurchase.id)
                await deleteCourseWithRelations(tx, target.id)
                assert.equal(await tx.course.findUnique({ where: { id: target.id } }), null)
                assert.equal(await tx.slot.findUnique({ where: { id: targetSlot.id } }), null)
                assert.equal(await tx.entitlement.findUnique({ where: { id: targetPurchase.id } }), null)
                assert.equal(await tx.booking.count({ where: { userId: student.id } }), 1)
                assert.ok(await tx.booking.findUnique({ where: { id: kept.id } }))
                assert.ok(await tx.slot.findUnique({ where: { id: otherSlot.id } }))
                assert.ok(await tx.entitlement.findUnique({ where: { id: otherPurchase.id } }))
                assert.ok(await tx.user.findUnique({ where: { id: student.id } }))
                throw rollback
            },
            { timeout: 10000 },
        )
    } catch (error) {
        if (error !== rollback) throw error
    }
    console.log(
        'Suppression vérifiée : liens directs et croisés supprimés, autres cours et étudiant conservés. Données de test annulées.',
    )
}
main()
    .catch((error) => {
        console.error(error)
        process.exitCode = 1
    })
    .finally(() => db.$disconnect())
