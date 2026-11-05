import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { requireRole } from '@/lib/auth'
import { db } from '@/lib/db'
import { teacherSchema } from '@/lib/admin-schemas'
import { z, ZodError } from 'zod'

export async function POST(req: NextRequest) {
    if (!(await requireRole(['ADMIN']))) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    try {
        const data = teacherSchema.parse(await req.json())
        const teacher = await db.user.create({
            data: { ...data, role: 'TEACHER' },
            select: { id: true, firstName: true, lastName: true, email: true },
        })
        return NextResponse.json(teacher, { status: 201 })
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
            return NextResponse.json({ error: 'Cette adresse email est déjà utilisée.' }, { status: 409 })
        return NextResponse.json(
            { error: error instanceof ZodError ? error.issues[0].message : 'Impossible de créer le professeur.' },
            { status: 400 },
        )
    }
}

export async function PATCH(req: NextRequest) {
    if (!(await requireRole(['ADMIN']))) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    try {
        const { id, ...data } = teacherSchema.extend({ id: z.string().min(1) }).parse(await req.json())
        const teacher = await db.user.update({
            where: { id, role: 'TEACHER' },
            data,
            select: { id: true, firstName: true, lastName: true, email: true },
        })
        return NextResponse.json(teacher)
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
            if (error.code === 'P2002')
                return NextResponse.json({ error: 'Cette adresse email est déjà utilisée.' }, { status: 409 })
            if (error.code === 'P2025') return NextResponse.json({ error: 'Professeur introuvable.' }, { status: 404 })
        }
        return NextResponse.json(
            { error: error instanceof ZodError ? error.issues[0].message : 'Impossible de modifier le professeur.' },
            { status: 400 },
        )
    }
}

export async function DELETE(req: NextRequest) {
    if (!(await requireRole(['ADMIN']))) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    try {
        const { id } = z.object({ id: z.string().min(1) }).parse(await req.json())
        await db.$transaction(
            async (tx) => {
                const teacher = await tx.user.findUnique({ where: { id } })
                if (!teacher || teacher.role !== 'TEACHER') throw Error('Professeur introuvable.')
                await tx.slot.updateMany({ where: { teacherId: id }, data: { teacherId: null } })
                await tx.course.updateMany({ where: { defaultTeacherId: id }, data: { defaultTeacherId: null } })
                await tx.user.delete({ where: { id, role: 'TEACHER' } })
            },
            { isolationLevel: 'Serializable', timeout: 10000 },
        )
        return NextResponse.json({ ok: true })
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof ZodError ? error.issues[0].message : 'Impossible de supprimer le professeur.' },
            { status: 400 },
        )
    }
}
