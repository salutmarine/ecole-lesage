import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()
async function main() {
    const admin = await db.user.upsert({
        where: { email: 'admin@ecole.test' },
        update: {},
        create: {
            email: 'admin@ecole.test',
            firstName: 'Alice',
            lastName: 'Admin',
            role: 'ADMIN',
        },
    })
    await db.user.upsert({
        where: { email: 'prof@ecole.test' },
        update: {},
        create: {
            email: 'prof@ecole.test',
            firstName: 'Camille',
            lastName: 'Professeur',
            role: 'TEACHER',
        },
    })
    const student = await db.user.upsert({
        where: { email: 'etudiant@ecole.test' },
        update: {},
        create: {
            email: 'etudiant@ecole.test',
            firstName: 'Marie',
            lastName: 'Dupont',
            role: 'STUDENT',
            language: 'fr',
        },
    })
    const defs = [
        {
            name: 'Initiation broderie 6h',
            sessionsCount: 2,
            validityMonths: 6,
            maxPerDay: 2,
            minGapHours: 0,
            maxPerWeek: 0,
            wooProductId: 1001,
        },
        {
            name: 'Initiation broderie 12h',
            sessionsCount: 4,
            validityMonths: 6,
            maxPerDay: 1,
            minGapHours: 0,
            maxPerWeek: 0,
            wooProductId: 1002,
        },
        {
            name: 'Broderie niveau 2 ruban',
            sessionsCount: 4,
            validityMonths: 6,
            maxPerDay: 1,
            minGapHours: 48,
            maxPerWeek: 0,
            wooProductId: 1003,
        },
        {
            name: 'Perfectionnement niveau 2',
            sessionsCount: 3,
            validityMonths: 12,
            maxPerDay: 1,
            minGapHours: 0,
            maxPerWeek: 0,
            wooProductId: 1004,
        },
        {
            name: 'Perfectionnement niveau 5',
            sessionsCount: 4,
            validityMonths: 12,
            maxPerDay: 1,
            minGapHours: 24,
            maxPerWeek: 3,
            wooProductId: 1005,
        },
        {
            name: 'Spécialisation',
            sessionsCount: 4,
            validityMonths: 12,
            maxPerDay: 1,
            minGapHours: 0,
            maxPerWeek: 0,
            wooProductId: 1006,
        },
    ]
    for (const def of defs)
        await db.course.upsert({
            where: { wooProductId: def.wooProductId },
            update: {},
            create: def,
        })
    const course = await db.course.findUniqueOrThrow({
        where: { wooProductId: 1002 },
    })
    const purchaseDate = new Date()
    purchaseDate.setDate(purchaseDate.getDate() - 7)
    const expiresAt = new Date(purchaseDate)
    expiresAt.setMonth(expiresAt.getMonth() + 6)
    await db.entitlement.upsert({
        where: { externalKey: 'demo:purchase:1' },
        update: {},
        create: {
            userId: student.id,
            courseId: course.id,
            totalSessions: 4,
            purchaseDate,
            expiresAt,
            source: 'MANUAL',
            externalKey: 'demo:purchase:1',
        },
    })
    const count = await db.slot.count()
    if (count === 0) {
        const today = new Date()
        for (let i = 3; i < 25; i++) {
            const d = new Date(today)
            d.setDate(d.getDate() + i)
            if (d.getDay() === 0 || d.getDay() === 6) continue
            for (const h of [9, 13]) {
                const start = new Date(d)
                start.setHours(h, 0, 0, 0)
                const end = new Date(start)
                end.setHours(h + 3)
                await db.slot.create({
                    data: { startsAt: start, endsAt: end, capacity: 12 },
                })
            }
        }
    }
    console.log('Données de démonstration créées', admin.email)
}
main().finally(() => db.$disconnect())
