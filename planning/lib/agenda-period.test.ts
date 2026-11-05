import test from 'node:test'
import assert from 'node:assert/strict'
import { agendaPeriod, parisDate } from './agenda-period'
test('exporte une journée entière en heure de Paris', () => {
    const period = agendaPeriod('2026-11-04', 'day')
    assert.equal(period.from.toISOString(), '2026-11-03T23:00:00.000Z')
    assert.equal(period.to.toISOString(), '2026-11-04T23:00:00.000Z')
    assert.equal(parisDate(new Date('2026-11-03T23:30:00Z')), '2026-11-04')
})
test('exporte la semaine du lundi au dimanche, y compris à cheval sur deux années', () => {
    const period = agendaPeriod('2027-01-01', 'week')
    assert.equal(period.firstDay, '2026-12-28')
    assert.equal(period.lastDay, '2027-01-03')
    assert.equal(period.to.toISOString(), '2027-01-03T23:00:00.000Z')
})
test('respecte les journées de 23 et 25 heures au changement d’heure', () => {
    const spring = agendaPeriod('2026-03-29', 'day'),
        autumn = agendaPeriod('2026-10-25', 'day')
    assert.equal((spring.to.getTime() - spring.from.getTime()) / 3600000, 23)
    assert.equal((autumn.to.getTime() - autumn.from.getTime()) / 3600000, 25)
})
test('refuse les dates inexistantes et mal formées', () => {
    for (const date of ['', '2026-02-30', '2026-13-01', '04/11/2026']) assert.throws(() => agendaPeriod(date, 'day'))
})
