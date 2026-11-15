import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { db } from '@/lib/db'
import { entitlementAdjustmentSchema } from '@/lib/admin-schemas'
import { ZodError, z } from 'zod'

export async function POST(req: NextRequest) {
    if (!(await requireRole(['ADMIN']))) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    try {
        const data = entitlementAdjustmentSchema.parse(await req.json())
        const entitlement = await db.$transaction(
            async (tx) => {
                const student = await tx.user.findUnique({ where: { id: data.userId } })
                if (!student || student.role !== 'STUDENT') throw Error('Étudiant introuvable.')
                const include = {
                    course: true,
                    bookings: {
                        include: { slot: true, course: true },
                        orderBy: { slot: { startsAt: 'desc' as const } },
                    },
                }
                if (data.action === 'add-course') {
                    const course = await tx.course.findUnique({ where: { id: data.courseId } })
                    if (!course) throw Error('Cours introuvable.')
                    const expiresAt = new Date(data.expiresAt)
                    if (expiresAt <= new Date()) throw Error('La date de validité doit être future.')
                    return tx.entitlement.create({
                        data: {
                            userId: data.userId,
                            courseId: course.id,
                            totalSessions: data.sessions,
                            purchaseDate: new Date(),
                            expiresAt,
                            source: 'MANUAL',
                        },
                        include,
                    })
                }
                await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${data.entitlementId}))`
                const current = await tx.entitlement.findUnique({ where: { id: data.entitlementId } })
                if (!current || current.userId !== data.userId) throw Error('Cours de l’étudiant introuvable.')
                if (data.action === 'set-sessions') {
                    const used = await tx.booking.count({
                        where: { entitlementId: current.id, status: { in: ['BOOKED', 'COMPLETED'] } },
                    })
                    if (data.sessions < used)
                        throw Error(
                            `Le total ne peut pas être inférieur aux ${used} séances déjà réservées ou effectuées.`,
                        )
                    return tx.entitlement.update({
                        where: { id: current.id },
                        data: { totalSessions: data.sessions },
                        include,
                    })
                }
                if (current.status !== 'ACTIVE' || current.expiresAt <= new Date())
                    throw Error('Ce cours est expiré ou suspendu. Attribuez un nouveau cours.')
                if (current.totalSessions + data.sessions > 100000)
                    throw Error('Le nombre maximal de séances est atteint.')
                return tx.entitlement.update({
                    where: { id: current.id },
                    data: { totalSessions: { increment: data.sessions } },
                    include,
                })
            },
            { isolationLevel: 'Serializable', timeout: 10000 },
        )
        return NextResponse.json(
            {
                id: entitlement.id,
                courseId: entitlement.courseId,
                course: entitlement.course.name,
                total: entitlement.totalSessions,
                remaining:
                    entitlement.totalSessions - entitlement.bookings.filter((b) => b.status !== 'CANCELLED').length,
                status: entitlement.status,
                purchaseDate: entitlement.purchaseDate.toISOString(),
                expiresAt: entitlement.expiresAt.toISOString(),
                bookings: entitlement.bookings.map((b) => ({
                    id: b.id,
                    course: b.course.name,
                    startsAt: b.slot.startsAt.toISOString(),
                    endsAt: b.slot.endsAt.toISOString(),
                    status: b.status,
                    attendance: b.attendance,
                })),
            },
            { status: data.action === 'add-course' ? 201 : 200 },
        )
    } catch (error) {
        return NextResponse.json(
            {
                error:
                    error instanceof ZodError
                        ? error.issues[0].message
                        : error instanceof Error
                          ? error.message
                          : 'Ajout impossible.',
            },
            { status: 400 },
        )
    }
}

export async function DELETE(req: NextRequest) {
    if (!(await requireRole(['ADMIN']))) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    try {
        const { userId, entitlementId } = z
            .object({ userId: z.string().min(1), entitlementId: z.string().min(1) })
            .parse(await req.json())
        await db.$transaction(
            async (tx) => {
                await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${entitlementId}))`
                const current = await tx.entitlement.findUnique({ where: { id: entitlementId } })
                if (!current || current.userId !== userId) throw Error('Cours de l’étudiant introuvable.')
                await tx.booking.deleteMany({ where: { entitlementId } })
                await tx.entitlement.delete({ where: { id: entitlementId } })
            },
            { isolationLevel: 'Serializable', timeout: 10000 },
        )
        return NextResponse.json({ id: entitlementId })
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Suppression impossible.' },
            { status: 400 },
        )
    }
}
