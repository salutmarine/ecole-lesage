import test from 'node:test'
import assert from 'node:assert/strict'
import { isActiveStudent, compareRecentBookings } from './student-summary'
const entitlement = {
    status: 'ACTIVE',
    remaining: 1,
    purchaseDate: '2026-10-01T00:00:00Z',
    expiresAt: '2027-10-01T00:00:00Z',
}
const now = new Date('2026-11-04T00:00:00Z')
test('un étudiant actif dispose de séances sur un achat valide', () => {
    assert.equal(isActiveStudent([entitlement], now), true)
    assert.equal(isActiveStudent([], now), false)
    for (const patch of [
        { remaining: 0 },
        { status: 'SUSPENDED' },
        { expiresAt: now.toISOString() },
        { purchaseDate: '2027-01-01T00:00:00Z' },
    ])
        assert.equal(isActiveStudent([{ ...entitlement, ...patch }], now), false)
})
test('classe par création de réservation récente, sans réservation en dernier', () => {
    const sorted = [
        { lastName: 'Sans', lastBookingAt: null },
        { lastName: 'Ancien', lastBookingAt: '2026-11-01T00:00:00Z' },
        { lastName: 'Récent', lastBookingAt: '2026-11-04T10:00:00Z' },
    ].sort(compareRecentBookings)
    assert.deepEqual(
        sorted.map((student) => student.lastName),
        ['Récent', 'Ancien', 'Sans'],
    )
})
