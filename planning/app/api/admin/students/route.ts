import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { db } from '@/lib/db'
import { studentSchema } from '@/lib/admin-schemas'
import { z, ZodError } from 'zod'
import { Prisma } from '@prisma/client'
export async function POST(req: NextRequest) {
    if (!(await requireRole(['ADMIN']))) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    try {
        const data = studentSchema.parse(await req.json())
        const student = await db.user.create({ data: { ...data, role: 'STUDENT' }, select: { id: true } })
        return NextResponse.json(student, { status: 201 })
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
            return NextResponse.json({ error: 'Cette adresse email est déjà utilisée.' }, { status: 409 })
        return NextResponse.json(
            { error: error instanceof ZodError ? error.issues[0].message : 'Impossible de créer l’étudiant.' },
            { status: 400 },
        )
    }
}

export async function PATCH(req: NextRequest) {
    if (!(await requireRole(['ADMIN']))) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    try {
        const { id, ...data } = studentSchema.extend({ id: z.string().min(1) }).parse(await req.json())
        const result = await db.user.updateMany({ where: { id, role: 'STUDENT' }, data })
        if (!result.count) return NextResponse.json({ error: 'Étudiant introuvable.' }, { status: 404 })
        return NextResponse.json({ ok: true })
    } catch (error) {
        const message =
            error instanceof ZodError
                ? error.issues[0].message
                : error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
                  ? 'Cette adresse email est déjà utilisée.'
                  : 'Impossible de modifier l’étudiant.'
        return NextResponse.json({ error: message }, { status: 400 })
    }
}

export async function DELETE(req: NextRequest) {
    if (!(await requireRole(['ADMIN']))) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    try {
        const { id } = z.object({ id: z.string().min(1) }).parse(await req.json())
        await db.$transaction(
            async (tx) => {
                const student = await tx.user.findUnique({ where: { id } })
                if (!student || student.role !== 'STUDENT') throw Error('Étudiant introuvable.')
                await tx.booking.deleteMany({ where: { userId: id } })
                await tx.entitlement.deleteMany({ where: { userId: id } })
                await tx.user.delete({ where: { id } })
            },
            { isolationLevel: 'Serializable', timeout: 10000 },
        )
        return NextResponse.json({ ok: true })
    } catch {
        return NextResponse.json({ error: 'Impossible de supprimer l’étudiant.' }, { status: 400 })
    }
}
