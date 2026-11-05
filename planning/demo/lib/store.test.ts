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
