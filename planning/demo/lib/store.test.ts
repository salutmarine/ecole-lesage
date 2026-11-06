import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createState, mutateBooking, remaining, demoFetch } from './store'
import { availableEntitlement } from '../../lib/student-availability'
function scenario() {
    const state = createState(new Date(), false)
    const slot = state.slots.find(
        (s) =>
            new Date(s.startsAt).getTime() > Date.now() + 7 * 86400000 &&
            state.entitlements.some((entitlement) => entitlement.courseId === s.courseId),
    )!
    const credit = state.entitlements.find((e) => e.courseId === slot.courseId)!
    return { state, slot, credit }
}
test('la démo étudiante démarre avec les cours et réservations attendus', () => {
    const state = createState(new Date(2026, 10, 5, 12))
    const studentEntitlementIds = state.entitlements
        .filter((entitlement) => (entitlement.userId ?? 'student-demo') === 'student-demo')
        .map((entitlement) => entitlement.id)
    const studentBookings = state.bookings.filter((booking) => studentEntitlementIds.includes(booking.entitlementId))
    assert.deepEqual(
        state.entitlements
            .filter((entitlement) => studentEntitlementIds.includes(entitlement.id))
            .map((entitlement) => entitlement.course),
        ['DECOUVERTE AIGUILLE : CŒUR BAROQUE', 'HAUTE COUTURE', 'BRODERIE AU RUBAN : NIVEAU 2'],
    )
    assert.deepEqual(
        studentBookings.map((booking) => booking.course),
        ['DECOUVERTE AIGUILLE : CŒUR BAROQUE'],
    )
    const couture = state.slots.find((slot) => {
        const date = new Date(slot.startsAt)
        return slot.course === 'HAUTE COUTURE' && date.getMonth() === 10 && date.getDate() === 10
    })!
    assert.equal(couture.reserved, couture.capacity)
    assert.equal(
        studentBookings.some((booking) => booking.slotId === couture.id),
        false,
    )
    const coutureStudents = state.bookings
        .filter((booking) => booking.slotId === couture.id)
        .map((booking) => state.entitlements.find((item) => item.id === booking.entitlementId)?.userId)
    assert.equal(coutureStudents.length, couture.capacity)
    assert.equal(new Set(coutureStudents).size, couture.capacity)
    const ribbon = state.slots.find((slot) => {
        const date = new Date(slot.startsAt)
        return slot.course === 'BRODERIE AU RUBAN : NIVEAU 2' && date.getDay() === 1 && date.getDate() === 21
    })!
    const ribbonBookings = state.bookings.filter((booking) => booking.slotId === ribbon.id)
    const ribbonEntitlement = state.entitlements.find(
        (entitlement) =>
            (entitlement.userId ?? 'student-demo') === 'student-demo' && entitlement.courseId === ribbon.courseId,
    )
    assert.equal(ribbon.reserved, ribbon.capacity)
    assert.equal(ribbonBookings.length, ribbon.capacity)
    assert.equal(new Set(ribbonBookings.map((booking) => booking.entitlementId)).size, ribbon.capacity)
    assert.equal(availableEntitlement(remaining(state), ribbon)?.id, ribbonEntitlement?.id)
    assert.equal(
        studentBookings.some((booking) => booking.slotId === ribbon.id),
        false,
    )
    assert.ok(state.slots.some((slot) => slot.reserved === 0))
    assert.ok(state.slots.some((slot) => slot.capacity - slot.reserved === 2))
    assert.ok(state.slots.some((slot) => slot.capacity - slot.reserved === 3))
})
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
    const other = createState(new Date(), false)
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
