import { NextRequest, NextResponse } from 'next/server'
import { createHmac, timingSafeEqual, createHash } from 'crypto'
import { db } from '@/lib/db'
export async function POST(req: NextRequest) {
    const secret = process.env.WOOCOMMERCE_WEBHOOK_SECRET
    if (!secret || secret.startsWith('replace-'))
        return NextResponse.json({ error: 'Webhook non configuré' }, { status: 503 })
    const body = Buffer.from(await req.arrayBuffer())
    const signature = req.headers.get('x-wc-webhook-signature') || ''
    const expected = createHmac('sha256', secret).update(body).digest()
    const provided = Buffer.from(signature, 'base64')
    if (provided.length !== expected.length || !timingSafeEqual(provided, expected))
        return NextResponse.json({ error: 'Signature invalide' }, { status: 401 })
    try {
        const order = JSON.parse(body.toString())
        if (!order?.id) return NextResponse.json({ error: 'Commande invalide' }, { status: 400 })
        const eventId = createHash('sha256').update(`${order.id}:${order.status}:${body.toString()}`).digest('hex')
        if (await db.webhookEvent.findUnique({ where: { id: eventId } }))
            return NextResponse.json({ ok: true, duplicate: true })
        if (!['processing', 'completed'].includes(order.status)) {
            await db.webhookEvent.create({ data: { id: eventId } })
            return NextResponse.json({ ok: true, ignored: order.status })
        }
        if (!order.customer_id) return NextResponse.json({ error: 'Compte client WooCommerce requis' }, { status: 422 })
        await db.$transaction(async (tx) => {
            const user = await tx.user.upsert({
                where: { wordpressId: Number(order.customer_id) },
                create: {
                    wordpressId: Number(order.customer_id),
                    email: order.billing?.email || `woo-${order.customer_id}@invalid.local`,
                    firstName: order.billing?.first_name || 'Client',
                    lastName: order.billing?.last_name || 'WooCommerce',
                    phone: order.billing?.phone || null,
                },
                update: {},
            })
            for (const item of order.line_items || []) {
                const course = await tx.course.findUnique({
                    where: { wooProductId: Number(item.product_id) },
                })
                if (!course) continue
                const purchaseDate = new Date(order.date_paid || order.date_created || Date.now())
                const expiresAt = new Date(purchaseDate)
                expiresAt.setMonth(expiresAt.getMonth() + course.validityMonths)
                const qty = Math.max(1, Number(item.quantity) || 1)
                await tx.entitlement.upsert({
                    where: { externalKey: `woo:${order.id}:${item.id}` },
                    create: {
                        userId: user.id,
                        courseId: course.id,
                        totalSessions: course.sessionsCount * qty,
                        purchaseDate,
                        expiresAt,
                        source: 'WOOCOMMERCE',
                        externalKey: `woo:${order.id}:${item.id}`,
                    },
                    update: {},
                })
            }
            await tx.webhookEvent.create({ data: { id: eventId } })
        })
        return NextResponse.json({ ok: true })
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur' }, { status: 500 })
    }
}
