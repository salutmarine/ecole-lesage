import assert from 'node:assert/strict'
import test from 'node:test'
import { courseTemplateSchema, teacherSchema, studentSchema, entitlementAdjustmentSchema } from './admin-schemas'

test('normalise les coordonnées du professeur et refuse les champs vides', () => {
    assert.deepEqual(
        teacherSchema.parse({ firstName: ' Marie ', lastName: ' Dupont ', email: ' Marie@Example.COM ' }),
        { firstName: 'Marie', lastName: 'Dupont', email: 'marie@example.com' },
    )
    assert.equal(teacherSchema.safeParse({ firstName: ' ', lastName: 'Dupont', email: 'invalide' }).success, false)
})
const template = {
    name: 'Couture',
    totalDurationMinutes: 1800,
    level: 'INITIATION',
    durationMinutes: 90,
    capacity: 12,
    reminderDays: 2,
    cancellationHours: 24,
    defaultTeacherId: null,
    minGapHours: 48,
    bookingDelayHours: 72,
}
test('accepte les paramètres de réservation sans professeur ni prix', () => {
    assert.deepEqual(courseTemplateSchema.parse(template), template)
})
test('refuse les durées incompatibles avec les créneaux', () => {
    for (const durationMinutes of [0, 20, 721]) {
        assert.equal(courseTemplateSchema.safeParse({ ...template, durationMinutes }).success, false)
    }
})
test('refuse les capacités et délais invalides', () => {
    for (const override of [
        { capacity: 0 },
        { capacity: 101 },
        { capacity: 1.5 },
        { reminderDays: -1 },
        { reminderDays: 1.5 },
        { cancellationHours: -1 },
        { minGapHours: -1 },
    ]) {
        assert.equal(courseTemplateSchema.safeParse({ ...template, ...override }).success, false)
    }
})

test('permet de désactiver les rappels et d’annuler jusqu’au début du cours', () => {
    assert.equal(
        courseTemplateSchema.safeParse({ ...template, reminderDays: null, cancellationHours: 0 }).success,
        true,
    )
})

test('valide les coordonnées étudiant avec ou sans téléphone', () => {
    const student = {
        firstName: ' Marie ',
        lastName: ' Dupont ',
        email: ' MARIE@example.com ',
        phone: ' +33 6 12 34 56 78 ',
    }
    assert.equal(studentSchema.parse(student).phone, '+33 6 12 34 56 78')
    assert.equal(studentSchema.parse({ ...student, phone: null }).phone, null)
    for (const override of [{ email: 'invalide' }, { firstName: ' ' }, { lastName: '' }, { phone: '0'.repeat(41) }]) {
        assert.equal(studentSchema.safeParse({ ...student, ...override }).success, false)
    }
})

test('valide l’attribution de cours et le crédit de séances', () => {
    const credit = { action: 'add-sessions', userId: 'student', entitlementId: 'purchase', sessions: 3 }
    const course = {
        action: 'add-course',
        userId: 'student',
        courseId: 'course',
        sessions: 10,
        expiresAt: '2027-11-04T22:59:59.000Z',
    }
    assert.equal(entitlementAdjustmentSchema.safeParse(credit).success, true)
    assert.equal(entitlementAdjustmentSchema.safeParse(course).success, true)
    for (const sessions of [0, -1, 1.5, 1001]) {
        assert.equal(entitlementAdjustmentSchema.safeParse({ ...credit, sessions }).success, false)
        assert.equal(entitlementAdjustmentSchema.safeParse({ ...course, sessions }).success, false)
    }
    assert.equal(entitlementAdjustmentSchema.safeParse({ ...course, expiresAt: 'invalide' }).success, false)
    assert.equal(entitlementAdjustmentSchema.safeParse({ ...credit, entitlementId: '' }).success, false)
})

test('applique les valeurs par défaut aux nouveaux cours sans écraser les réglages explicites', () => {
    const { reminderDays, minGapHours, cancellationHours, ...base } = template
    const defaults = courseTemplateSchema.parse(base)
    assert.equal(defaults.minGapHours, 48)
    assert.equal(defaults.reminderDays, 1)
    assert.equal(defaults.cancellationHours, 48)
    const custom = courseTemplateSchema.parse({ ...base, minGapHours: 0, reminderDays: null, cancellationHours: 0 })
    assert.equal(custom.minGapHours, 0)
    assert.equal(custom.reminderDays, null)
    assert.equal(custom.cancellationHours, 0)
})

test('accepte les trois niveaux et refuse un niveau inconnu', () => {
    for (const level of ['INITIATION', 'PERFECTIONNEMENT', 'SPECIALISATION']) {
        assert.equal(courseTemplateSchema.safeParse({ ...template, level }).success, true)
    }
    assert.equal(courseTemplateSchema.safeParse({ ...template, level: 'AUTRE' }).success, false)
})

test('valide une durée totale de plusieurs séances en quarts d’heure', () => {
    assert.equal(courseTemplateSchema.safeParse({ ...template, totalDurationMinutes: 1800 }).success, true)
    for (const totalDurationMinutes of [0, -15, 20, 600001]) {
        assert.equal(courseTemplateSchema.safeParse({ ...template, totalDurationMinutes }).success, false)
    }
})

test('valide un délai après achat configurable, y compris zéro', () => {
    assert.equal(courseTemplateSchema.parse({ ...template, bookingDelayHours: undefined }).bookingDelayHours, 72)
    assert.equal(courseTemplateSchema.parse({ ...template, bookingDelayHours: 0 }).bookingDelayHours, 0)
    for (const bookingDelayHours of [-1, 1.5, 8761])
        assert.equal(courseTemplateSchema.safeParse({ ...template, bookingDelayHours }).success, false)
})

test('accepte les trois langues étudiant et refuse les autres valeurs', () => {
    const student = { firstName: 'Marie', lastName: 'Dupont', email: 'marie@example.test', phone: null }
    assert.equal(studentSchema.parse(student).language, 'fr')
    for (const language of ['fr', 'en', 'ja'])
        assert.equal(studentSchema.safeParse({ ...student, language }).success, true)
    assert.equal(studentSchema.safeParse({ ...student, language: 'xx' }).success, false)
})
