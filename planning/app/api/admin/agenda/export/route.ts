import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { db } from '@/lib/db'
import { agendaPeriod } from '@/lib/agenda-period'
import { createAgendaPdf } from '@/lib/agenda-pdf'
export const runtime = 'nodejs'
export async function GET(req: NextRequest) {
    if (!(await requireRole(['ADMIN']))) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    const mode = req.nextUrl.searchParams.get('mode')
    const date = req.nextUrl.searchParams.get('date') || ''
    if (mode !== 'day' && mode !== 'week')
        return NextResponse.json({ error: 'Choisissez une journée ou une semaine.' }, { status: 400 })
    let period: ReturnType<typeof agendaPeriod>
    try {
        period = agendaPeriod(date, mode)
    } catch {
        return NextResponse.json({ error: 'Date invalide.' }, { status: 400 })
    }
    try {
        const slots = await db.slot.findMany({
            where: { startsAt: { lt: period.to }, endsAt: { gt: period.from } },
            include: {
                course: true,
                teacher: { select: { firstName: true, lastName: true } },
                bookings: {
                    where: { status: { in: ['BOOKED', 'COMPLETED'] } },
                    select: {
                        user: { select: { firstName: true, lastName: true, email: true, phone: true, language: true } },
                    },
                    orderBy: [{ user: { lastName: 'asc' } }, { user: { firstName: 'asc' } }],
                },
            },
            orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
        })
        const bytes = await createAgendaPdf(
            slots.map((slot) => ({
                id: slot.id,
                startsAt: slot.startsAt,
                endsAt: slot.endsAt,
                course: slot.course?.name || 'Cours non attribué',
                level: slot.course?.level ?? null,
                teacher: slot.teacher
                    ? `${slot.teacher.firstName} ${slot.teacher.lastName.toLocaleUpperCase('fr-FR')}`
                    : null,
                capacity: slot.capacity,
                blocked: slot.blocked,
                students: slot.bookings.map((booking) => booking.user),
            })),
            period,
            mode,
        )
        return new NextResponse(Buffer.from(bytes), {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="agenda-${mode === 'day' ? 'journee' : 'semaine'}-${period.firstDay}.pdf"`,
                'Cache-Control': 'private, no-store',
            },
        })
    } catch (error) {
        console.error('Échec de l’export PDF de l’agenda', error)
        return NextResponse.json({ error: 'Impossible de générer le PDF.' }, { status: 500 })
    }
}
