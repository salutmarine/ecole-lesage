import assert from 'node:assert/strict'
import test from 'node:test'
import { isReminderDue } from './reminder-schedule'

test('envoie à J-X selon la date de Paris, même au changement d’heure', () => {
    assert.equal(isReminderDue(new Date('2026-10-26T09:00:00Z'), 2, null, new Date('2026-10-24T08:00:00Z')), true)
    assert.equal(isReminderDue(new Date('2026-11-05T09:00:00Z'), 1, null, new Date('2026-11-03T23:30:00Z')), true)
})
test('ignore les rappels désactivés, hors délai, déjà envoyés et les séances passées', () => {
    const now = new Date('2026-11-04T09:00:00Z'),
        start = new Date('2026-11-06T09:00:00Z')
    assert.equal(isReminderDue(start, null, null, now), false)
    assert.equal(isReminderDue(start, 1, null, now), false)
    assert.equal(isReminderDue(start, 2, start, now), false)
    assert.equal(isReminderDue(now, 0, null, now), false)
})
test('prévoit un nouveau rappel quand la séance est déplacée', () => {
    assert.equal(
        isReminderDue(
            new Date('2026-11-06T09:00:00Z'),
            2,
            new Date('2026-11-05T09:00:00Z'),
            new Date('2026-11-04T09:00:00Z'),
        ),
        true,
    )
})
