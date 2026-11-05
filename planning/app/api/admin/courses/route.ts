import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { db } from '@/lib/db'
import { deleteCourseWithRelations } from '@/lib/admin-courses'
import { courseTemplateSchema } from '@/lib/admin-schemas'
import { z, ZodError } from 'zod'
import { Prisma } from '@prisma/client'

export async function POST(req: NextRequest) {
    if (!(await requireRole(['ADMIN']))) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    try {
        const data = courseTemplateSchema.parse(await req.json())
        if (data.defaultTeacherId) {
            const teacher = await db.user.findUnique({ where: { id: data.defaultTeacherId } })
            if (!teacher || teacher.role !== 'TEACHER')
                return NextResponse.json({ error: 'Professeur inconnu.' }, { status: 400 })
        }
        const course = await db.course.create({ data })
        return NextResponse.json(course, { status: 201 })
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof ZodError ? error.issues[0].message : 'Impossible de créer le modèle de cours.' },
            { status: 400 },
        )
    }
}

export async function PATCH(req: NextRequest) {
    if (!(await requireRole(['ADMIN']))) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    try {
        const { id, ...data } = courseTemplateSchema.extend({ id: z.string().min(1) }).parse(await req.json())
        if (data.defaultTeacherId) {
            const teacher = await db.user.findUnique({ where: { id: data.defaultTeacherId } })
            if (!teacher || teacher.role !== 'TEACHER')
                return NextResponse.json({ error: 'Professeur inconnu.' }, { status: 400 })
        }
        const course = await db.course.update({ where: { id }, data })
        return NextResponse.json(course)
    } catch (error) {
        console.error('Échec de la modification du cours', error)
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025')
            return NextResponse.json({ error: 'Modèle introuvable.' }, { status: 404 })
        return NextResponse.json(
            { error: error instanceof ZodError ? error.issues[0].message : 'Impossible de modifier le modèle.' },
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
                await deleteCourseWithRelations(tx, id)
            },
            { isolationLevel: 'Serializable', timeout: 10000 },
        )
        return NextResponse.json({ ok: true })
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Impossible de supprimer le modèle.' },
            { status: 400 },
        )
    }
}
