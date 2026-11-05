import test from 'node:test'
import assert from 'node:assert/strict'
import { PDFDocument } from 'pdf-lib'
import { createAgendaPdf, type AgendaSession } from './agenda-pdf'
const period = { firstDay: '2026-11-02', lastDay: '2026-11-08' }
const session: AgendaSession = {
    id: 'test',
    startsAt: new Date('2026-11-04T08:30:00Z'),
    endsAt: new Date('2026-11-04T11:30:00Z'),
    course: 'Broderie : Cœur baroque — initiation',
    level: 'INITIATION',
    teacher: 'Élise Bernard',
    capacity: 12,
    blocked: false,
    students: [
        {
            firstName: 'Éléonore',
            lastName: 'Dupont',
            email: 'eleonore@example.test',
            phone: '06 00 00 00 00',
            language: 'fr',
        },
        { firstName: '花子', lastName: '山田', email: 'hanako@example.test', phone: null, language: 'ja' },
    ],
}
test('génère un PDF lisible avec accents et noms japonais', async () => {
    const bytes = await createAgendaPdf([session], period, 'week')
    assert.equal(Buffer.from(bytes).subarray(0, 5).toString(), '%PDF-')
    const document = await PDFDocument.load(bytes)
    assert.equal(document.getPageCount(), 1)
    assert.match(document.getTitle() || '', /Agenda de la semaine/)
})
test('répartit les listes longues sur plusieurs pages et gère une période vide', async () => {
    const long = {
        ...session,
        students: Array.from({ length: 100 }, (_, index) => ({
            ...session.students[0],
            lastName: `Étudiant ${index}`,
        })),
    }
    const document = await PDFDocument.load(await createAgendaPdf([long], period, 'week'))
    assert.ok(document.getPageCount() > 1)
    const empty = await PDFDocument.load(await createAgendaPdf([], period, 'week'))
    assert.equal(empty.getPageCount(), 1)
})
