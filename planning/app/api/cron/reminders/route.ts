import { createHash, timingSafeEqual } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { sendReminders } from '@/lib/reminders'

export const runtime = 'nodejs'
export async function GET(req: NextRequest) {
    const secret = process.env.CRON_SECRET
    if (!secret) return NextResponse.json({ error: 'Rappels non configurés.' }, { status: 503 })
    const hash = (value: string) => createHash('sha256').update(value).digest()
    if (!timingSafeEqual(hash(req.headers.get('authorization') || ''), hash(`Bearer ${secret}`)))
        return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    if (!process.env.SMTP_HOST || !process.env.MAIL_FROM)
        return NextResponse.json({ error: 'Service email non configuré.' }, { status: 503 })
    try {
        const result = await sendReminders()
        return NextResponse.json(result, { status: result.failed ? 502 : 200 })
    } catch {
        return NextResponse.json({ error: 'Impossible d’envoyer les rappels.' }, { status: 500 })
    }
}
export const POST = GET
