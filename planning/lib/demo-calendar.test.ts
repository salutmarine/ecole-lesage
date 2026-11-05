import test from 'node:test'
import assert from 'node:assert/strict'
import { winterWorkingDays, winterHolidays } from './demo-calendar'

test('sélectionne 62 jours ouvrés de novembre 2026 à janvier 2027', () => {
    const days = winterWorkingDays()
    assert.equal(days.length, 62)
    assert.deepEqual(
        ['2026-11', '2026-12', '2027-01'].map((month) => days.filter((day) => day.startsWith(month)).length),
        [20, 22, 20],
    )
    for (const day of days) {
        assert.equal(winterHolidays.has(day), false)
        assert.ok(![0, 6].includes(new Date(`${day}T12:00:00Z`).getUTCDay()))
    }
})
