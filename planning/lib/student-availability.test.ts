import assert from 'node:assert/strict'
import test from 'node:test'
import { availableEntitlement } from './student-availability'
const first = {
    id: 'a',
    courseId: 'broderie',
    status: 'ACTIVE',
    remaining: 2,
    purchaseDate: '2026-01-01T00:00:00Z',
    expiresAt: '2027-01-01T00:00:00Z',
}
const second = { ...first, id: 'b', courseId: 'couture' }
const slot = { courseId: 'broderie', startsAt: '2026-11-20T10:00:00Z' }
test('active tous les cours achetés sans sélectionner un cours', () => {
    assert.equal(availableEntitlement([first, second], slot)?.id, 'a')
    assert.equal(availableEntitlement([first, second], { ...slot, courseId: 'couture' })?.id, 'b')
})
test('un achat épuisé ne désactive pas un autre cours ou un autre achat valide', () => {
    const exhausted = { ...first, remaining: 0 }
    assert.equal(availableEntitlement([exhausted, second], { ...slot, courseId: 'couture' })?.id, 'b')
    assert.equal(availableEntitlement([exhausted, { ...first, id: 'c' }], slot)?.id, 'c')
})
test('refuse les cours non achetés, suspendus ou expirés', () => {
    assert.equal(availableEntitlement([first], { ...slot, courseId: 'inconnu' }), undefined)
    assert.equal(availableEntitlement([{ ...first, status: 'SUSPENDED' }], slot), undefined)
    assert.equal(availableEntitlement([{ ...first, expiresAt: slot.startsAt }], slot), undefined)
})
test('utilise un achat éligible au délai de 72 heures même si un autre est récent', () => {
    const recent = { ...first, id: 'recent', purchaseDate: '2026-11-19T10:00:00Z', expiresAt: '2026-12-01T00:00:00Z' }
    assert.equal(availableEntitlement([recent, first], slot)?.id, 'a')
})

test('applique le délai du cours et accepte zéro heure après l’achat', () => {
    const recent = { ...first, purchaseDate: '2026-11-19T10:00:00Z' }
    assert.equal(availableEntitlement([{ ...recent, bookingDelayHours: 24 }], slot)?.id, 'a')
    assert.equal(availableEntitlement([{ ...recent, bookingDelayHours: 25 }], slot), undefined)
    assert.equal(
        availableEntitlement([{ ...recent, bookingDelayHours: 0 }], { ...slot, startsAt: recent.purchaseDate })?.id,
        'a',
    )
})
