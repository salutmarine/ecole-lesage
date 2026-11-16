import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createState, mutateBooking, remaining, demoFetch } from './store'
import { availableEntitlement, reservationUnavailableReason } from '../../lib/student-availability'
import { slotOccurrences } from '../../lib/slot-recurrence'

test('les répétitions gardent l’heure de Paris et respectent la fréquence et la fin incluse', () => {
    const weekly = slotOccurrences('2027-03-22T08:00:00Z', '2027-03-22T11:00:00Z', {
        unit: 'week',
        interval: 1,
        until: '2027-04-05',
    })
    assert.deepEqual(
        weekly.map((slot) => slot.startsAt.toISOString()),
        ['2027-03-22T08:00:00.000Z', '2027-03-29T07:00:00.000Z', '2027-04-05T07:00:00.000Z'],
    )
    assert.ok(weekly.every((slot) => +slot.endsAt - +slot.startsAt === 3 * 3600000))
    const daily = slotOccurrences('2027-01-01T13:00:00Z', '2027-01-01T16:00:00Z', {
        unit: 'day',
        interval: 2,
        until: '2027-01-06',
    })
    assert.deepEqual(
        daily.map((slot) => slot.startsAt.getUTCDate()),
        [1, 3, 5],
    )
    assert.throws(() =>
        slotOccurrences('2027-01-01T13:00:00Z', '2027-01-01T16:00:00Z', {
            unit: 'day',
            interval: 0,
            until: '2027-01-06',
        }),
    )
    assert.throws(() =>
        slotOccurrences('2027-01-01T13:00:00Z', '2027-01-01T16:00:00Z', {
            unit: 'day',
            interval: 1,
            until: '2028-12-31',
        }),
    )
    assert.throws(
        () =>
            slotOccurrences('2027-03-27T01:30:00Z', '2027-03-27T04:30:00Z', {
                unit: 'day',
                interval: 1,
                until: '2027-03-28',
            }),
        /n’existe pas/,
    )
})

test('la répétition mensuelle garde le jour initial après les mois courts et les années bissextiles', () => {
    const monthly = slotOccurrences('2028-01-31T08:00:00Z', '2028-01-31T11:00:00Z', {
        unit: 'month',
        interval: 1,
        until: '2028-04-30',
    })
    assert.deepEqual(
        monthly.map((slot) => slot.startsAt.toISOString()),
        [
            '2028-01-31T08:00:00.000Z',
            '2028-02-29T08:00:00.000Z',
            '2028-03-31T07:00:00.000Z',
            '2028-04-30T07:00:00.000Z',
        ],
    )
    const everyTwo = slotOccurrences('2027-11-30T13:00:00Z', '2027-11-30T16:00:00Z', {
        unit: 'month',
        interval: 2,
        until: '2028-03-30',
    })
    assert.deepEqual(
        everyTwo.map((slot) => slot.startsAt.toISOString().slice(0, 10)),
        ['2027-11-30', '2028-01-30', '2028-03-30'],
    )
})

test('une série est créée entièrement et un conflit annule toutes ses occurrences', async () => {
    const { adminRequest, hydrate } = await import('./admin-store')
    const state = createState(new Date(), false)
    const teacher = hydrate(state).people.find((person) => person.role === 'TEACHER')!
    const url = new URL('https://demo.invalid/api/admin/slots')
    const body = {
        startsAt: '2090-01-01T08:00:00Z',
        endsAt: '2090-01-01T11:00:00Z',
        capacity: 12,
        teacherIds: [teacher.id],
    }
    const series = (await adminRequest(state, url, {
        method: 'POST',
        body: JSON.stringify({ ...body, recurrence: { unit: 'day', interval: 2, until: '2090-01-05' } }),
    })) as { count: number }
    assert.equal(series.count, 3)
    const before = structuredClone(state)
    await assert.rejects(
        adminRequest(state, url, {
            method: 'POST',
            body: JSON.stringify({
                ...body,
                startsAt: '2089-12-31T08:00:00Z',
                endsAt: '2089-12-31T11:00:00Z',
                recurrence: { unit: 'day', interval: 1, until: '2090-01-02' },
            }),
        }),
        /déjà une séance/,
    )
    assert.deepEqual(state, before)
})
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
    assert.equal(ribbon.reserved, ribbon.capacity)
    assert.equal(ribbonBookings.length, ribbon.capacity)
    assert.equal(new Set(ribbonBookings.map((booking) => booking.entitlementId)).size, ribbon.capacity)
    assert.ok(availableEntitlement(remaining(state), ribbon))
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
test('refuse les doublons, créneaux complets et crédits épuisés', () => {
    const { state, slot, credit } = scenario()
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
    const { adminRequest, adminProps, calendarSlots, teacherProps, assignDemoStudents } = await import('./admin-store')
    const { state, slot, credit } = scenario()
    const request = (path: string, method: string, body: unknown) =>
        adminRequest(state, new URL(path, 'https://demo.invalid'), { method, body: JSON.stringify(body) })
    const teacher = teacherProps(state, false)
    assert.ok(teacher.user.id)
    const created = mutateBooking(state, 'POST', { slotId: slot.id, entitlementId: credit.id })
    assert.ok('id' in created)
    assert.equal(calendarSlots(state).find((s) => s.id === slot.id)!.students[0].bookingId, created.id)
    const creditView = adminProps(state).students[0].entitlements.find((e) => e.id === credit.id)!
    assert.equal(creditView.remaining, 7)
    assignDemoStudents(state, teacher.user.id, slot.id, [created.id])
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

test('un achat permet de réserver et déplacer une séance de tout cours', () => {
    const { state, slot, credit } = scenario()
    slot.courseId = 'autre-cours'
    assert.equal(availableEntitlement([{ ...credit, remaining: 8 }], slot)?.id, credit.id)
    const created = mutateBooking(state, 'POST', { slotId: slot.id, entitlementId: credit.id })
    assert.ok('id' in created)
    const target = state.slots.find((s) => s.id !== slot.id && new Date(s.startsAt) > new Date(slot.endsAt))!
    target.courseId = null
    mutateBooking(state, 'PATCH', { id: created.id, slotId: target.id })
    assert.equal(remaining(state).find((e) => e.id === credit.id)!.remaining, 7)
    assert.equal(target.reserved, 1)
})

test('un créneau sans cours possède sa propre capacité et accepte les inscriptions', async () => {
    const { adminRequest, calendarSlots } = await import('./admin-store')
    const { state, slot, credit } = scenario()
    const created = (await adminRequest(state, new URL('/api/admin/slots', 'https://demo.invalid'), {
        method: 'POST',
        body: JSON.stringify({ startsAt: slot.startsAt, endsAt: slot.endsAt, capacity: 3 }),
    })) as { id: string }
    const generic = state.slots.find((item) => item.id === created.id)!
    assert.equal(generic.courseId, null)
    assert.equal(generic.capacity, 3)
    mutateBooking(state, 'POST', { slotId: generic.id, entitlementId: credit.id })
    assert.equal(calendarSlots(state).find((item) => item.id === generic.id)?.reserved, 1)
})

test('le cours choisi pour un inscrit transfère le crédit sans changer les places', () => {
    const { state, slot, credit } = scenario()
    const other = { ...credit, id: 'autre-achat', courseId: 'autre-cours', course: 'Autre cours' }
    state.entitlements.push(other)
    const booking = mutateBooking(state, 'POST', { slotId: slot.id, entitlementId: credit.id })
    assert.ok('id' in booking)
    mutateBooking(state, 'PATCH', { id: booking.id, entitlementId: other.id })
    assert.equal(slot.reserved, 1)
    assert.equal(remaining(state).find((item) => item.id === credit.id)!.remaining, credit.total)
    assert.equal(remaining(state).find((item) => item.id === other.id)!.remaining, other.total - 1)
})

test('modifier ensemble le cours et la date transfère les places et les crédits', () => {
    const { state, slot, credit } = scenario()
    const other = { ...credit, id: 'achat-modification', courseId: 'autre-cours', course: 'Autre cours' }
    state.entitlements.push(other)
    const booking = mutateBooking(state, 'POST', { slotId: slot.id, entitlementId: credit.id })
    assert.ok('id' in booking)
    const target = state.slots.find((item) => item.id !== slot.id && new Date(item.startsAt) > new Date(slot.endsAt))!
    mutateBooking(state, 'PATCH', { id: booking.id, slotId: target.id, entitlementId: other.id })
    assert.equal(slot.reserved, 0)
    assert.equal(target.reserved, 1)
    assert.equal(remaining(state).find((item) => item.id === credit.id)!.remaining, credit.total)
    assert.equal(remaining(state).find((item) => item.id === other.id)!.remaining, other.total - 1)
})

test('l’admin peut réduire le total et supprimer un cours de l’étudiant', async () => {
    const { adminRequest } = await import('./admin-store')
    const { state, slot, credit } = scenario()
    const userId = credit.userId ?? 'student-demo'
    mutateBooking(state, 'POST', { slotId: slot.id, entitlementId: credit.id })
    const request = (method: string, body: unknown) =>
        adminRequest(state, new URL('/api/admin/entitlements', 'https://demo.invalid'), {
            method,
            body: JSON.stringify(body),
        })
    await assert.rejects(() =>
        request('POST', { action: 'set-sessions', userId, entitlementId: credit.id, sessions: 0 }),
    )
    assert.equal(credit.total, 8)
    const updated = (await request('POST', {
        action: 'set-sessions',
        userId,
        entitlementId: credit.id,
        sessions: 3,
    })) as { total: number; remaining: number }
    assert.equal(updated.total, 3)
    assert.equal(updated.remaining, 2)
    await assert.rejects(() => request('DELETE', { userId: 'autre-etudiant', entitlementId: credit.id }))
    await request('DELETE', { userId, entitlementId: credit.id })
    assert.equal(
        state.entitlements.some((item) => item.id === credit.id),
        false,
    )
    assert.equal(
        state.bookings.some((item) => item.entitlementId === credit.id),
        false,
    )
    assert.equal(slot.reserved, 0)
})

test('la fiche professeur liste les séances et les cours des élèves inscrits', async () => {
    const { adminProps, hydrate, assignDemoStudents } = await import('./admin-store')
    const { state, slot, credit } = scenario()
    const teacher = hydrate(state).people.find((person) => person.role === 'TEACHER')!
    slot.teacher = `${teacher.firstName} ${teacher.lastName}`
    slot.courseId = null
    mutateBooking(state, 'POST', { slotId: slot.id, entitlementId: credit.id })
    assignDemoStudents(
        state,
        teacher.id,
        slot.id,
        state.bookings.filter((booking) => booking.slotId === slot.id).map((booking) => booking.id),
    )
    const profile = adminProps(state).teachers.find((person) => person.id === teacher.id)!
    const session = profile.assignedSessions.find((item) => item.id === slot.id)!
    assert.ok(session)
    assert.equal(session.courses.length, 1)
    assert.equal(session.courses[0].id, credit.courseId)
    assert.ok(session.courses[0].level)
})

test('les créneaux indisponibles expliquent la condition de réservation refusée', () => {
    const { slot, credit } = scenario()
    const credits = [{ ...credit, remaining: 3 }]
    assert.equal(reservationUnavailableReason(credits, slot), undefined)
    assert.match(reservationUnavailableReason(credits, { ...slot, reserved: slot.capacity })!, /complet/)
    assert.match(reservationUnavailableReason(credits, { ...slot, blocked: true })!, /bloqué/)
    assert.match(reservationUnavailableReason(credits, { ...slot, startsAt: new Date(0).toISOString() })!, /passé/)
    assert.match(reservationUnavailableReason([{ ...credits[0], remaining: 0 }], slot)!, /plus de séances/)
    assert.match(
        reservationUnavailableReason([{ ...credits[0], expiresAt: new Date(0).toISOString() }], slot)!,
        /valide/,
    )
    assert.match(
        reservationUnavailableReason([{ ...credits[0], purchaseDate: slot.startsAt, bookingDelayHours: 72 }], slot)!,
        /72 h/,
    )
})

test('la prise en charge est individuelle et refuse les conflits sans sélection partielle', async () => {
    const { assignDemoStudents, adminProps, hydrate, teacherSessions } = await import('./admin-store')
    const { parisDate } = await import('../../lib/agenda-period')
    const { state, slot, credit } = scenario()
    const teacher = hydrate(state).people.find((person) => person.role === 'TEACHER')!
    assert.equal(adminProps(state).teachers.find((person) => person.id === teacher.id)!.assignedSessions.length, 0)
    const first = mutateBooking(state, 'POST', { slotId: slot.id, entitlementId: credit.id })
    assert.ok('id' in first)
    const secondCredit = { ...credit, id: 'second-credit', userId: 'second-student' }
    state.entitlements.push(secondCredit)
    state.people!.push({
        id: 'second-student',
        firstName: 'Autre',
        lastName: 'Élève',
        email: 'autre@example.test',
        phone: null,
        language: 'fr',
        role: 'STUDENT',
    })
    state.people!.push({
        id: 'other-teacher',
        firstName: 'Autre',
        lastName: 'Prof',
        email: 'autre-prof@example.test',
        phone: null,
        language: 'fr',
        role: 'TEACHER',
    })
    const second = mutateBooking(state, 'POST', { slotId: slot.id, entitlementId: secondCredit.id })
    assert.ok('id' in second)
    assignDemoStudents(state, teacher.id, slot.id, [first.id])
    assert.throws(() => assignDemoStudents(state, 'other-teacher', slot.id, [first.id, second.id]))
    assert.equal(state.bookings.find((booking) => booking.id === second.id)!.teacherId, undefined)
    assignDemoStudents(state, 'other-teacher', slot.id, [second.id])
    const session = teacherSessions(state, parisDate(new Date(slot.startsAt))).find(
        (session) => session.id === slot.id,
    )!
    assert.equal(new Set(session.students.map((student) => student.teacherId)).size, 2)
    assert.throws(() => assignDemoStudents(state, 'other-teacher', slot.id, [first.id], true))
    assignDemoStudents(state, teacher.id, slot.id, [first.id], true)
    assert.equal(state.bookings.find((booking) => booking.id === first.id)!.teacherId, null)
    state.bookings.find((booking) => booking.id === first.id)!.status = 'CANCELLED'
    assert.throws(() => assignDemoStudents(state, teacher.id, slot.id, [first.id]))
})

test('une journée sans élèves affiche le prochain créneau non bloqué avec élèves', async () => {
    const { teacherSessions } = await import('./admin-store')
    const { state, slot, credit } = scenario()
    const later = {
        ...slot,
        id: 'later',
        startsAt: new Date(Date.now() + 20 * 86400000).toISOString(),
        endsAt: new Date(Date.now() + 20 * 86400000 + 3600000).toISOString(),
    }
    state.slots = [{ ...slot, blocked: true }, later]
    mutateBooking(state, 'POST', { slotId: later.id, entitlementId: credit.id })
    assert.equal(teacherSessions(state, '2020-01-01').length, 0)
    const next = teacherSessions(state, '2020-01-01', true)
    assert.equal(next.length, 1)
    assert.equal(next[0].id, later.id)
    assert.equal(teacherSessions(state, '2099-01-01', true).length, 0)
})

test('le calendrier regroupe sans doublons les professeurs affectés et les prises en charge', async () => {
    const { adminRequest, calendarSlots, hydrate, assignDemoStudents } = await import('./admin-store')
    const { state, slot, credit } = scenario()
    const first = hydrate(state).people.find((person) => person.role === 'TEACHER')!
    const second = { ...first, id: 'second-professeur', firstName: 'Second', email: 'second-prof@example.test' }
    state.people!.push(second)
    const startsAt = Math.max(Date.now(), ...state.slots.map((item) => Date.parse(item.endsAt))) + 60 * 86400000
    const created = (await adminRequest(state, new URL('/api/admin/slots', 'https://demo.invalid'), {
        method: 'POST',
        body: JSON.stringify({
            startsAt: new Date(startsAt).toISOString(),
            endsAt: new Date(startsAt + 3 * 3600000).toISOString(),
            capacity: 8,
            teacherIds: [first.id, second.id],
        }),
    })) as { id: string }
    const planned = calendarSlots(state).find((item) => item.id === created.id)!
    assert.deepEqual(new Set(planned.teachers.map((teacher) => teacher.id)), new Set([first.id, second.id]))
    slot.teacher = ''
    slot.teacherIds = [first.id]
    const booking = mutateBooking(state, 'POST', { slotId: slot.id, entitlementId: credit.id })
    assert.ok('id' in booking)
    assignDemoStudents(state, second.id, slot.id, [booking.id])
    const combined = calendarSlots(state).find((item) => item.id === slot.id)!
    assert.deepEqual(new Set(combined.teachers.map((teacher) => teacher.id)), new Set([first.id, second.id]))
    slot.teacherIds = [first.id, second.id]
    assert.equal(calendarSlots(state).find((item) => item.id === slot.id)!.teachers.length, 2)
})

test('la démonstration contient un historique et décembre pour chaque professeur, avec des places libres et sans professeur', async () => {
    const { adminProps } = await import('./admin-store')
    const state = createState(new Date(2026, 10, 15, 12))
    const profiles = adminProps(state).teachers
    for (const teacher of profiles) {
        assert.ok(
            teacher.assignedSessions.some((session) => {
                const date = new Date(session.startsAt)
                return date.getFullYear() === 2026 && date.getMonth() === 10 && date.getDate() <= 10
            }),
            `Historique de ${teacher.name}`,
        )
        assert.ok(
            teacher.assignedSessions.some((session) => new Date(session.startsAt).getMonth() === 11),
            `Décembre de ${teacher.name}`,
        )
    }
    assert.ok(state.slots.some((slot) => slot.reserved > 0 && slot.reserved < slot.capacity))
    assert.ok(
        state.slots.some(
            (slot) =>
                slot.reserved > 0 &&
                !slot.teacher &&
                !slot.teacherIds?.length &&
                state.bookings.filter((booking) => booking.slotId === slot.id).every((booking) => !booking.teacherId),
        ),
    )
})

test('l’admin choisit ou retire le professeur d’un élève sans changer le cours ni la date', async () => {
    const { hydrate } = await import('./admin-store')
    const { state, slot, credit } = scenario()
    const teacher = hydrate(state).people.find((person) => person.role === 'TEACHER')!
    const booking = mutateBooking(state, 'POST', { slotId: slot.id, entitlementId: credit.id })
    assert.ok('id' in booking)
    mutateBooking(state, 'PATCH', { id: booking.id, slotId: slot.id, entitlementId: credit.id, teacherId: teacher.id })
    assert.equal(state.bookings[0].teacherId, teacher.id)
    assert.equal(slot.reserved, 1)
    assert.throws(() =>
        mutateBooking(state, 'PATCH', {
            id: booking.id,
            slotId: slot.id,
            entitlementId: credit.id,
            teacherId: 'inconnu',
        }),
    )
    assert.equal(state.bookings[0].teacherId, teacher.id)
    mutateBooking(state, 'PATCH', { id: booking.id, slotId: slot.id, entitlementId: credit.id, teacherId: null })
    assert.equal(state.bookings[0].teacherId, null)
})

test('la démo charge l’instantané local complet et conserve les liens entre ses données', async () => {
    const { initialState, demoStudentId } = await import('./store')
    const { adminProps, teacherProps } = await import('./admin-store')
    const snapshot = initialState()
    assert.ok(snapshot.snapshotId)
    assert.ok(snapshot.people!.length > 0 && snapshot.courses!.length > 0 && snapshot.slots.length > 0)
    assert.ok(snapshot.people!.some((person) => person.id === demoStudentId(snapshot) && person.role === 'STUDENT'))
    assert.equal(teacherProps(snapshot).user.id, snapshot.demoTeacherId)
    const ids = new Set(snapshot.people!.map((person) => person.id))
    const courses = new Set(snapshot.courses!.map((course) => course.id))
    const slots = new Set(snapshot.slots.map((slot) => slot.id))
    const entitlements = new Set(snapshot.entitlements.map((entitlement) => entitlement.id))
    for (const entitlement of snapshot.entitlements) {
        assert.ok(ids.has(entitlement.userId!))
        assert.ok(courses.has(entitlement.courseId))
    }
    for (const booking of snapshot.bookings) {
        assert.ok(slots.has(booking.slotId))
        assert.ok(entitlements.has(booking.entitlementId))
        if (booking.teacherId) assert.ok(ids.has(booking.teacherId))
    }
    assert.equal(
        adminProps(snapshot).students.length,
        snapshot.people!.filter((person) => person.role === 'STUDENT').length,
    )
    const another = initialState()
    snapshot.slots[0].capacity++
    assert.notEqual(snapshot.slots[0].capacity, another.slots[0].capacity)
})
