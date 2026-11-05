import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { db } from '@/lib/db'
import { z } from 'zod'
import { validateBooking } from '@/lib/booking'
const schema = z.object({
    courseId: z.string().min(1),
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime(),
    capacity: z.number().int().min(1).max(100),
    teacherId: z.string().min(1).optional(),
    entitlementId: z.string().min(1).optional(),
})
export async function POST(req: NextRequest) {
    if (!(await requireRole(['ADMIN']))) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    try {
        const d = schema.parse(await req.json())
        const start = new Date(d.startsAt),
            end = new Date(d.endsAt)
        if (start >= end || start < new Date()) throw Error('Dates invalides')
        const minutes = (end.getTime() - start.getTime()) / 60000
        if (minutes < 15 || minutes > 720 || minutes % 15 !== 0)
            throw Error('La durée doit être comprise entre 15 minutes et 12 heures, par pas de 15 minutes.')
        const course = await db.course.findUnique({ where: { id: d.courseId } })
        if (!course) throw Error('Cours inconnu')
        const slot = await db.$transaction(
            async (tx) => {
                if (d.teacherId) {
                    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${d.teacherId}))`
                    const teacher = await tx.user.findUnique({ where: { id: d.teacherId } })
                    if (!teacher || teacher.role !== 'TEACHER') throw Error('Professeur inconnu.')
                    const overlap = await tx.slot.findFirst({
                        where: { teacherId: d.teacherId, startsAt: { lt: end }, endsAt: { gt: start } },
                    })
                    if (overlap) throw Error('Ce professeur a déjà un cours à cet horaire.')
                }
                const created = await tx.slot.create({
                    data: {
                        courseId: d.courseId,
                        teacherId: d.teacherId,
                        startsAt: start,
                        endsAt: end,
                        capacity: d.capacity,
                    },
                })
                if (d.entitlementId) {
                    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${d.entitlementId}))`
                    const entitlement = await tx.entitlement.findUnique({
                        where: { id: d.entitlementId },
                        include: { user: true },
                    })
                    if (!entitlement || entitlement.user.role !== 'STUDENT') throw Error('Élève inconnu.')
                    await validateBooking(tx, entitlement.userId, entitlement.id, created.id, undefined, true)
                    await tx.booking.create({
                        data: {
                            userId: entitlement.userId,
                            entitlementId: entitlement.id,
                            courseId: d.courseId,
                            slotId: created.id,
                        },
                    })
                }
                return created
            },
            { isolationLevel: 'Serializable', timeout: 10000 },
        )
        return NextResponse.json(slot, { status: 201 })
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur' }, { status: 400 })
    }
}
export async function PATCH(req: NextRequest) {
    if (!(await requireRole(['ADMIN']))) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    try {
        const d = schema
            .omit({ entitlementId: true })
            .extend({ id: z.string().min(1) })
            .parse(await req.json())
        const start = new Date(d.startsAt),
            end = new Date(d.endsAt)
        const minutes = (end.getTime() - start.getTime()) / 60000
        if (minutes < 15 || minutes > 720 || minutes % 15 !== 0)
            throw Error('La durée doit être comprise entre 15 minutes et 12 heures, par pas de 15 minutes.')
        const slot = await db.$transaction(
            async (tx) => {
                await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${d.id}))`
                const current = await tx.slot.findUnique({ where: { id: d.id }, include: { bookings: true } })
                if (!current) throw Error('Séance introuvable.')
                const moved =
                    current.startsAt.getTime() !== start.getTime() || current.endsAt.getTime() !== end.getTime()
                if (moved && start < new Date()) throw Error('Choisissez une date future.')
                const reserved = current.bookings.filter((b) => b.status === 'BOOKED')
                if (d.capacity < reserved.length)
                    throw Error('La capacité ne peut pas être inférieure au nombre de réservations.')
                if (!(await tx.course.findUnique({ where: { id: d.courseId } }))) throw Error('Cours inconnu.')
                if (d.teacherId) {
                    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${d.teacherId}))`
                    const teacher = await tx.user.findUnique({ where: { id: d.teacherId } })
                    if (!teacher || teacher.role !== 'TEACHER') throw Error('Professeur inconnu.')
                    const overlap = await tx.slot.findFirst({
                        where: {
                            id: { not: d.id },
                            teacherId: d.teacherId,
                            startsAt: { lt: end },
                            endsAt: { gt: start },
                        },
                    })
                    if (overlap) throw Error('Ce professeur a déjà un cours à cet horaire.')
                }
                const updated = await tx.slot.update({
                    where: { id: d.id },
                    data: {
                        courseId: d.courseId,
                        startsAt: start,
                        endsAt: end,
                        capacity: d.capacity,
                        teacherId: d.teacherId ?? null,
                    },
                })
                if (d.courseId !== current.courseId) {
                    // Keep the purchased entitlement while reflecting the session's new course.
                    await tx.booking.updateMany({ where: { slotId: d.id }, data: { courseId: d.courseId } })
                }
                if (moved) {
                    for (const booking of reserved) {
                        await validateBooking(tx, booking.userId, booking.entitlementId, d.id, booking.id, true, true)
                    }
                }
                return updated
            },
            { isolationLevel: 'Serializable', timeout: 10000 },
        )
        return NextResponse.json(slot)
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur' }, { status: 400 })
    }
}
export async function DELETE(req: NextRequest) {
    if (!(await requireRole(['ADMIN']))) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    try {
        const { id } = z.object({ id: z.string().min(1) }).parse(await req.json())
        await db.$transaction(
            async (tx) => {
                await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${id}))`
                await tx.booking.deleteMany({ where: { slotId: id } })
                await tx.slot.delete({ where: { id } })
            },
            { isolationLevel: 'Serializable', timeout: 10000 },
        )
        return NextResponse.json({ ok: true })
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur' }, { status: 400 })
    }
}
