import { Prisma } from '@prisma/client'

export async function deleteCourseWithRelations(tx: Prisma.TransactionClient, id: string) {
    const course = await tx.course.findUnique({ where: { id } })
    if (!course) throw Error('Cours introuvable.')
    // A reservation can retain its original purchase after its session changes course.
    await tx.booking.deleteMany({
        where: { OR: [{ courseId: id }, { slot: { courseId: id } }, { entitlement: { courseId: id } }] },
    })
    await tx.slot.deleteMany({ where: { courseId: id } })
    await tx.entitlement.deleteMany({ where: { courseId: id } })
    await tx.course.delete({ where: { id } })
}
