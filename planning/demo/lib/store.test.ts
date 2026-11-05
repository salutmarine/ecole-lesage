import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createState, mutateBooking, remaining, demoFetch } from './store'
function scenario() {
    const state = createState()
    const slot = state.slots.find((s) => new Date(s.startsAt).getTime() > Date.now() + 7 * 86400000)!
    const credit = state.entitlements.find((e) => e.courseId === slot.courseId)!
    return { state, slot, credit }
}
test('reservations, déplacement, annulation et crédits restent cohérents', () => {
    const { state, slot, credit } = scenario()
    const created = mutateBooking(state, 'POST', { slotId: slot.id, entitlementId: credit.id })
    assert.ok('id' in created)
    assert.equal(slot.reserved, 1)
    assert.equal(remaining(state).find((e) => e.id === credit.id)!.remaining, 7)
    const target = state.slots.find(
        (s) => s.courseId === slot.courseId && new Date(s.startsAt) > new Date(slot.endsAt),
    )!
    mutateBooking(state, 'PATCH', { id: created.id, slotId: target.id })
    assert.equal(slot.reserved, 0)
    assert.equal(target.reserved, 1)
    assert.equal(remaining(state).find((e) => e.id === credit.id)!.remaining, 7)
    mutateBooking(state, 'DELETE', { id: created.id })
    assert.equal(target.reserved, 0)
    assert.equal(remaining(state).find((e) => e.id === credit.id)!.remaining, 8)
    assert.throws(() => mutateBooking(state, 'DELETE', { id: created.id }))
})
test('chaque visiteur possède des données indépendantes', () => {
    const { state, slot, credit } = scenario()
    const other = createState()
    mutateBooking(state, 'POST', { slotId: slot.id, entitlementId: credit.id })
    assert.equal(other.bookings.length, 0)
    assert.equal(other.slots.find((s) => s.id === slot.id)!.reserved, 0)
})
test('refuse les doublons, cours incompatibles, créneaux complets et crédits épuisés', () => {
    const { state, slot, credit } = scenario()
    assert.throws(() =>
        mutateBooking(state, 'POST', {
            slotId: slot.id,
            entitlementId: state.entitlements.find((e) => e.id !== credit.id)!.id,
        }),
    )
    slot.reserved = slot.capacity
    assert.throws(() => mutateBooking(state, 'POST', { slotId: slot.id, entitlementId: credit.id }))
    slot.reserved = 0
    credit.total = 0
    assert.throws(() => mutateBooking(state, 'POST', { slotId: slot.id, entitlementId: credit.id }))
    credit.total = 8
    mutateBooking(state, 'POST', { slotId: slot.id, entitlementId: credit.id })
    assert.throws(() => mutateBooking(state, 'POST', { slotId: slot.id, entitlementId: credit.id }))
})
test('le transport de démonstration ne fait aucun appel réseau', async () => {
    const previous = globalThis.fetch
    globalThis.fetch = () => {
        throw Error('Appel réseau interdit')
    }
    try {
        const response = await demoFetch('/api/slots?month=' + new Date().toISOString().slice(0, 7))
        assert.equal(response.status, 200)
        assert.ok(Array.isArray(await response.json()))
        assert.equal((await demoFetch('/api/auth/demo')).status, 400)
    } finally {
        globalThis.fetch = previous
    }
})

test('les interfaces administrateur et professeur utilisent les mêmes inscriptions locales', async () => {
    const { adminRequest, adminProps, calendarSlots, teacherProps } = await import('./admin-store')
    const { state, slot, credit } = scenario()
    const request = (path: string, method: string, body: unknown) =>
        adminRequest(state, new URL(path, 'https://demo.invalid'), { method, body: JSON.stringify(body) })
    const teacher = teacherProps(state, false)
    assert.ok(teacher.slots.length > 0)
    const created = mutateBooking(state, 'POST', { slotId: slot.id, entitlementId: credit.id })
    assert.ok('id' in created)
    assert.equal(calendarSlots(state).find((s) => s.id === slot.id)!.students[0].bookingId, created.id)
    const creditView = adminProps(state).students[0].entitlements.find((e) => e.id === credit.id)!
    assert.equal(creditView.remaining, 7)
    await request('/api/teacher/attendance', 'PATCH', { bookingId: created.id, attendance: 'PRESENT' })
    assert.equal(state.bookings[0].attendance, 'PRESENT')
    await request('/api/admin/entitlements', 'POST', {
        action: 'add-sessions',
        userId: 'student-demo',
        entitlementId: credit.id,
        sessions: 2,
    })
    assert.equal(adminProps(state).students[0].entitlements.find((e) => e.id === credit.id)!.remaining, 9)
    await request('/api/admin/slots', 'DELETE', { id: slot.id })
    assert.equal(state.bookings[0].status, 'CANCELLED')
    assert.equal(remaining(state).find((e) => e.id === credit.id)!.remaining, 10)
})
