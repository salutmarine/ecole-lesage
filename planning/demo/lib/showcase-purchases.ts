import { z } from 'zod'
import { sourceCatalogue, type State } from './store'

export const SHOWCASE_COMMERCE_KEY = 'lesage.showcase.commerce.v1'
const person = z.object({
    id: z.string().min(1).max(100),
    firstName: z.string().min(1).max(100),
    lastName: z.string().min(1).max(100),
    email: z.string().email().max(254),
    phone: z.string().max(40).optional(),
})
const orderSchema = z.object({
    id: z.string().min(1).max(100),
    status: z.literal('PAID_DEMO'),
    createdAt: z.string().datetime(),
    studentId: z.string(),
    buyer: person,
    beneficiary: person.nullable().optional(),
    items: z
        .array(z.object({ productKey: z.string(), productId: z.string(), qty: z.number().int().min(1).max(99) }))
        .min(1)
        .max(25),
    preferredSlotId: z.string().nullable().optional(),
    preferredProductKey: z.string().nullable().optional(),
})

/** Local-only demo purchases. Stable entitlement IDs make reloads idempotent. */
export function importShowcasePurchases(state: State, value: unknown, orderId?: string | null) {
    const envelope = z
        .object({
            version: z.literal(1),
            orders: z.array(z.unknown()).max(1000),
            activeStudentId: z.string().nullable().optional(),
        })
        .safeParse(value)
    const target: { studentId?: string; slotId?: string; entitlementId?: string } = {}
    if (!envelope.success) return target
    state.people ??= []
    state.courses ??= []
    for (const raw of envelope.data.orders) {
        const parsed = orderSchema.safeParse(raw)
        if (!parsed.success) continue
        const order = parsed.data
        if (order.buyer.id !== order.studentId) continue
        const recipient = order.beneficiary || order.buyer
        if (!recipient.id.startsWith('showcase-student-')) continue
        const definitions = order.items.map((item) =>
            sourceCatalogue.find((course) => course.wooProductIds.map(String).includes(item.productId)),
        )
        if (definitions.some((item) => !item)) continue
        const purchaseDate = new Date(order.createdAt)
        if (+purchaseDate > Date.now() + 60000) continue
        const existingPerson = state.people.find((item) => item.id === recipient.id)
        if (existingPerson && existingPerson.role !== 'STUDENT') continue
        if (!existingPerson)
            state.people.push({ ...recipient, phone: recipient.phone || null, role: 'STUDENT', language: 'fr' })
        for (const [index, item] of order.items.entries()) {
            const definition = definitions[index]!
            let course = state.courses.find(
                (course) => definition.wooProductIds.includes(course.wooProductId!) || course.name === definition.name,
            )
            if (!course) {
                course = {
                    id: `showcase-course-${item.productId}`,
                    name: definition.name,
                    level: definition.level as 'INITIATION' | 'PERFECTIONNEMENT' | 'SPECIALISATION',
                    wooProductId: Number(item.productId),
                    sessionsCount: definition.sessionsCount,
                    validityMonths: definition.validityMonths,
                    durationMinutes: definition.durationMinutes,
                    totalDurationMinutes: definition.totalDurationMinutes,
                    capacity: definition.capacity,
                    reminderDays: 1,
                    cancellationHours: 48,
                    defaultTeacherId: null,
                    minGapHours: 0,
                    bookingDelayHours: 72,
                }
                state.courses.push(course)
            }
            const id = `showcase:${order.id}:${item.productId}`
            if (!state.entitlements.some((credit) => credit.id === id)) {
                const expiresAt = new Date(purchaseDate)
                expiresAt.setMonth(expiresAt.getMonth() + definition.validityMonths)
                state.entitlements.push({
                    id,
                    userId: recipient.id,
                    courseId: course.id,
                    course: course.name,
                    total: definition.sessionsCount * item.qty,
                    remaining: definition.sessionsCount * item.qty,
                    purchaseDate: purchaseDate.toISOString(),
                    expiresAt: expiresAt.toISOString(),
                    bookingDelayHours: course.bookingDelayHours ?? 72,
                    status: 'ACTIVE',
                })
            }
            if (order.id === orderId && (!order.preferredProductKey || item.productKey === order.preferredProductKey))
                target.entitlementId = id
        }
        if (order.id === orderId) {
            target.studentId = recipient.id
            target.slotId = order.preferredSlotId || undefined
        }
    }
    if (target.studentId) state.demoStudentId = target.studentId
    return target
}
