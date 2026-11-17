import { agendaPeriod } from '../../lib/agenda-period'
import { slotOccurrences, type SlotRecurrence } from '../../lib/slot-recurrence'
import { sourceCatalogue, remaining, validateSlot, mutateBooking, type State, type Person, type Course } from './store'
const studentId = 'student-demo'
export function hydrate(state: State) {
    state.people ??= [
        {
            id: studentId,
            firstName: 'Louis',
            lastName: 'Dubois',
            email: 'louis.dubois@example.test',
            phone: null,
            language: 'fr',
            role: 'STUDENT',
        },
        {
            id: 'teacher-louise',
            firstName: 'Louise',
            lastName: 'Bernard',
            email: 'louise@example.test',
            phone: null,
            language: 'fr',
            role: 'TEACHER',
        },
        {
            id: 'teacher-camille',
            firstName: 'Camille',
            lastName: 'Martin',
            email: 'camille@example.test',
            phone: null,
            language: 'fr',
            role: 'TEACHER',
        },
    ]
    if (!state.courses) {
        const first = state.entitlements
            .slice(0, 4)
            .map((e) => sourceCatalogue.find((c) => c.name === e.course)!)
            .filter(Boolean)
        const catalogue = [...first, ...sourceCatalogue.filter((c) => !first.some((f) => f.name === c.name))]
        state.courses = catalogue.map((c, i) => ({
            id: `course-${i}`,
            name: c.name,
            level: c.level as Course['level'],
            durationMinutes: c.durationMinutes ?? 180,
            totalDurationMinutes: c.totalDurationMinutes ?? 180,
            capacity: 6,
            reminderDays: 1,
            cancellationHours: 48,
            defaultTeacherId: 'teacher-louise',
            minGapHours: 48,
            bookingDelayHours: 0,
        }))
    }
    return state as State & { people: Person[]; courses: Course[] }
}
function studentFor(state: State, entitlementId: string) {
    const userId = state.entitlements.find((e) => e.id === entitlementId)?.userId ?? studentId
    return hydrate(state).people.find((p) => p.id === userId)
}
export function calendarSlots(state: State) {
    hydrate(state)
    const now = new Date()
    const entitlements = state.entitlements.map((entitlement) => ({
        ...entitlement,
        remaining: Math.max(
            0,
            entitlement.total -
                state.bookings.filter(
                    (booking) =>
                        booking.entitlementId === entitlement.id &&
                        booking.status !== 'CANCELLED' &&
                        new Date(booking.endsAt) <= now,
                ).length,
        ),
    }))
    return state.slots.map((slot) => ({
        ...slot,
        course: 'Séance',
        blocked:
            slot.blocked ||
            !!state.blockouts?.some(
                (block) =>
                    new Date(block.startsAt) < new Date(slot.endsAt) &&
                    new Date(block.endsAt) > new Date(slot.startsAt),
            ),
        teachers: [
            ...new Map(
                [
                    ...(slot.teacherIds ?? []).map((id) => ({
                        id,
                        name: displayTeacher(state, dataTeacherName(state, id)),
                    })),
                    ...state.bookings
                        .filter(
                            (booking) =>
                                booking.slotId === slot.id && booking.status !== 'CANCELLED' && booking.teacherId,
                        )
                        .map((booking) => ({
                            id: booking.teacherId!,
                            name: displayTeacher(state, dataTeacherName(state, booking.teacherId)),
                        })),
                    ...hydrate(state)
                        .people.filter(
                            (person) =>
                                person.role === 'TEACHER' && `${person.firstName} ${person.lastName}` === slot.teacher,
                        )
                        .map((person) => ({ id: person.id, name: displayTeacher(state, slot.teacher) })),
                ].map((teacher) => [teacher.id, teacher]),
            ).values(),
        ],
        teacher:
            [
                ...new Set(
                    [
                        ...(slot.teacherIds ?? []).map((id) => displayTeacher(state, dataTeacherName(state, id))),
                        ...state.bookings
                            .filter(
                                (booking) =>
                                    booking.slotId === slot.id && booking.status !== 'CANCELLED' && booking.teacherId,
                            )
                            .map((booking) => displayTeacher(state, dataTeacherName(state, booking.teacherId))),
                        displayTeacher(state, slot.teacher),
                    ].filter(Boolean),
                ),
            ].join(', ') || null,
        teacherId:
            hydrate(state).people.find((p) => p.role === 'TEACHER' && `${p.firstName} ${p.lastName}` === slot.teacher)
                ?.id ?? null,
        students: state.bookings
            .filter((b) => b.slotId === slot.id && ['BOOKED', 'COMPLETED'].includes(b.status))
            .map((b) => {
                const person = studentFor(state, b.entitlementId)!
                return {
                    id: person.id,
                    name: `${person.firstName} ${person.lastName.toLocaleUpperCase('fr-FR')}`,
                    language: person.language,
                    email: person.email,
                    status: b.status,
                    attendance: b.attendance as 'UNMARKED' | 'PRESENT' | 'ABSENT',
                    phone: person.phone,
                    bookingId: b.id,
                    teacherId: b.teacherId ?? null,
                    teacher: displayTeacher(state, dataTeacherName(state, b.teacherId)),
                    entitlementId: b.entitlementId,
                    level: hydrate(state).courses.find(
                        (course) => course.id === state.entitlements.find((e) => e.id === b.entitlementId)?.courseId,
                    )?.level,
                    course: state.entitlements.find((e) => e.id === b.entitlementId)?.course,
                    sessions: entitlements
                        .filter(
                            (entitlement) =>
                                (entitlement.userId ?? studentId) === person.id &&
                                entitlement.status === 'ACTIVE' &&
                                new Date(entitlement.purchaseDate) <= new Date() &&
                                new Date(entitlement.expiresAt) > new Date(),
                        )
                        .reduce(
                            (summary, entitlement) => ({
                                total: summary.total + entitlement.total,
                                remaining: summary.remaining + Math.max(0, entitlement.remaining),
                            }),
                            { total: 0, remaining: 0 },
                        ),
                }
            }),
    }))
}
export function adminProps(state: State) {
    const data = hydrate(state)
    const students = data.people
        .filter((p) => p.role === 'STUDENT')
        .map((p) => ({
            ...p,
            name: `${p.firstName} ${p.lastName.toLocaleUpperCase('fr-FR')}`,
            lastBookingAt:
                state.bookings
                    .filter((b) => studentFor(state, b.entitlementId)?.id === p.id)
                    .map((b) => b.date)
                    .sort()
                    .at(-1) ?? null,
            entitlements: remaining(state)
                .filter((e) => (e.userId ?? studentId) === p.id)
                .map((e) => ({
                    ...e,
                    bookings: state.bookings
                        .filter((b) => b.entitlementId === e.id)
                        .map((b) => ({
                            id: b.id,
                            course: b.course,
                            startsAt: b.date,
                            endsAt: b.endsAt,
                            status: b.status,
                            attendance: b.attendance,
                        })),
                })),
        }))
    const teachers = data.people
        .filter((p) => p.role === 'TEACHER')
        .map((p) => {
            const slots = state.slots
                .filter(
                    (s) =>
                        !s.blocked &&
                        state.bookings.some(
                            (booking) =>
                                booking.slotId === s.id && booking.teacherId === p.id && booking.status !== 'CANCELLED',
                        ),
                )
                .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
            return {
                ...p,
                name: `${p.firstName} ${p.lastName.toLocaleUpperCase('fr-FR')}`,
                nextSession: slots.find((slot) => new Date(slot.endsAt) > new Date())
                    ? { startsAt: slots.find((slot) => new Date(slot.endsAt) > new Date())!.startsAt, course: 'Séance' }
                    : null,
                assignedSessions: slots.map((slot) => ({
                    id: slot.id,
                    startsAt: slot.startsAt,
                    endsAt: slot.endsAt,
                    studentCount: new Set(
                        state.bookings
                            .filter(
                                (booking) =>
                                    booking.slotId === slot.id &&
                                    booking.teacherId === p.id &&
                                    booking.status !== 'CANCELLED',
                            )
                            .map((booking) => studentFor(state, booking.entitlementId)?.id),
                    ).size,
                    courses: [
                        ...new Map(
                            state.bookings
                                .filter(
                                    (booking) =>
                                        booking.slotId === slot.id &&
                                        booking.teacherId === p.id &&
                                        booking.status !== 'CANCELLED',
                                )
                                .flatMap((booking) => {
                                    const entitlement = state.entitlements.find((e) => e.id === booking.entitlementId)
                                    const course = data.courses.find((course) => course.id === entitlement?.courseId)
                                    return course
                                        ? [
                                              [
                                                  course.id,
                                                  { id: course.id, name: course.name, level: course.level },
                                              ] as const,
                                          ]
                                        : []
                                }),
                        ).values(),
                    ],
                })),
            }
        })
    return { students, courses: data.courses, teachers }
}
function dataTeacherName(state: State, teacherId?: string | null) {
    const teacher = hydrate(state).people.find((person) => person.id === teacherId && person.role === 'TEACHER')
    return teacher ? `${teacher.firstName} ${teacher.lastName}` : ''
}
export function teacherProps(state: State, _past = false) {
    const user = hydrate(state).people.find(
        (person) => person.id === state.demoTeacherId && person.role === 'TEACHER',
    ) ??
        hydrate(state).people.find((person) => person.role === 'TEACHER') ?? {
            id: 'no-teacher',
            firstName: '',
            lastName: '',
        }
    return { user }
}
export function teacherSessions(state: State, date: string, next = false) {
    const { from, to } = agendaPeriod(date, 'day')
    const data = hydrate(state)
    let slots = state.slots.filter((slot) => new Date(slot.startsAt) >= from && new Date(slot.startsAt) < to)
    const hasStudents = (slot: State['slots'][number]) =>
        state.bookings.some((booking) => booking.slotId === slot.id && booking.status === 'BOOKED')
    if (next && !slots.some((slot) => !slot.blocked && new Date(slot.endsAt) > new Date() && hasStudents(slot))) {
        const upcoming = state.slots
            .filter(
                (slot) =>
                    new Date(slot.startsAt) >= to &&
                    new Date(slot.endsAt) > new Date() &&
                    !slot.blocked &&
                    hasStudents(slot),
            )
            .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
            .slice(0, 1)
        if (upcoming.length) slots = upcoming
    }
    return slots
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
        .map((slot) => ({
            id: slot.id,
            startsAt: slot.startsAt,
            endsAt: slot.endsAt,
            capacity: slot.capacity,
            blocked: slot.blocked,
            students: state.bookings
                .filter((booking) => booking.slotId === slot.id && booking.status !== 'CANCELLED')
                .map((booking) => {
                    const person = studentFor(state, booking.entitlementId)!
                    const entitlement = state.entitlements.find((item) => item.id === booking.entitlementId)!
                    const course = data.courses.find((course) => course.id === entitlement.courseId)
                    return {
                        bookingId: booking.id,
                        sessionNumber:
                            1 +
                            state.bookings.filter(
                                (other) =>
                                    other.entitlementId === booking.entitlementId &&
                                    other.status !== 'CANCELLED' &&
                                    new Date(other.date) < new Date(slot.startsAt),
                            ).length,
                        totalSessions: entitlement.total,
                        name: `${person.firstName} ${person.lastName.toLocaleUpperCase('fr-FR')}`,
                    language: person.language,
                        courseId: entitlement.courseId,
                        course: entitlement.course,
                        level: course?.level ?? 'INITIATION',
                        teacherId: booking.teacherId ?? null,
                        teacher: displayTeacher(state, dataTeacherName(state, booking.teacherId)),
                        attendance: booking.attendance,
                        status: booking.status,
                    }
                }),
        }))
}
export function assignDemoStudents(
    state: State,
    teacherId: string,
    slotId: string,
    bookingIds: string[],
    release = false,
) {
    if (!hydrate(state).people.some((person) => person.id === teacherId && person.role === 'TEACHER'))
        throw Error('Professeur inconnu.')
    if (!Array.isArray(bookingIds) || bookingIds.length === 0 || bookingIds.length > 100)
        throw Error('Sélection invalide.')
    const ids = [...new Set(bookingIds)]
    const slot = state.slots.find((slot) => slot.id === slotId)
    if (!slot || slot.blocked || new Date(slot.endsAt) <= new Date())
        throw Error('Ce créneau est indisponible ou terminé.')
    const bookings = state.bookings.filter(
        (booking) => ids.includes(booking.id) && booking.slotId === slotId && booking.status === 'BOOKED',
    )
    if (bookings.length !== ids.length) throw Error('Une inscription a été annulée ou déplacée.')
    if (bookings.some((booking) => (release ? booking.teacherId !== teacherId : !!booking.teacherId)))
        throw Error('Un élève est déjà pris en charge par un professeur.')
    if (release && bookings.some((booking) => booking.attendance !== 'UNMARKED'))
        throw Error('Un élève déjà pointé ne peut pas être libéré.')
    bookings.forEach((booking) => (booking.teacherId = release ? null : teacherId))
    return { count: bookings.length }
}
type Payload = Partial<Course & Person> & {
    recurrence?: SlotRecurrence
    id?: string
    bookingId?: string
    attendance?: string
    entitlementId?: string
    userId?: string
    slotId?: string
    courseId?: string
    startsAt?: string
    endsAt?: string
    teacherId?: string
    teacherIds?: string[]
    action?: string
    sessions?: number
    expiresAt?: string
    bookingIds?: string[]
    release?: boolean
}
export async function adminRequest(state: State, url: URL, init?: RequestInit): Promise<unknown> {
    const data = hydrate(state)
    const method = init?.method ?? 'GET'
    const body = JSON.parse(String(init?.body ?? '{}')) as Payload
    const path = url.pathname
    if (path === '/api/teacher/sessions')
        return teacherSessions(state, url.searchParams.get('date') ?? '', url.searchParams.get('next') === '1')
    if (path === '/api/teacher/assignments')
        return assignDemoStudents(
            state,
            teacherProps(state).user.id,
            body.slotId ?? '',
            body.bookingIds ?? [],
            body.release,
        )
    if (path === '/api/teacher/attendance') {
        const b = state.bookings.find((b) => b.id === body.bookingId)
        if (
            !b ||
            b.teacherId !== teacherProps(state).user.id ||
            !['BOOKED', 'COMPLETED'].includes(b.status) ||
            !['UNMARKED', 'PRESENT', 'ABSENT'].includes(body.attendance ?? '')
        )
            throw Error('Pointage invalide.')
        b.attendance = body.attendance!
        return { attendance: b.attendance }
    }
    if (path === '/api/admin/available-slots')
        return state.slots
            .filter((s) => {
                try {
                    validateSlot(state, url.searchParams.get('entitlementId') ?? '', s.id)
                    return true
                } catch {
                    return false
                }
            })
            .map((s) => ({ ...s, places: s.capacity - s.reserved }))
    if (path === '/api/admin/entitlements') {
        const owned = state.entitlements.find(
            (e) => e.id === body.entitlementId && (e.userId ?? studentId) === body.userId,
        )
        if (method === 'DELETE') {
            if (!owned) throw Error('Cours de l’étudiant introuvable.')
            state.bookings
                .filter((booking) => booking.entitlementId === owned.id && booking.status === 'BOOKED')
                .forEach((booking) => {
                    const slot = state.slots.find((slot) => slot.id === booking.slotId)
                    if (slot) slot.reserved = Math.max(0, slot.reserved - 1)
                })
            state.bookings = state.bookings.filter((booking) => booking.entitlementId !== owned.id)
            state.entitlements = state.entitlements.filter((e) => e.id !== owned.id)
            return { id: owned.id }
        }
        if (body.action === 'set-sessions') {
            if (!owned) throw Error('Cours de l’étudiant introuvable.')
            const used = state.bookings.filter(
                (booking) => booking.entitlementId === owned.id && booking.status !== 'CANCELLED',
            ).length
            if (!Number.isInteger(body.sessions) || body.sessions! < used || body.sessions! > 100000)
                throw Error(`Le total doit être au moins de ${used} séances.`)
            owned.total = body.sessions!
            return adminProps(state)
                .students.flatMap((student) => student.entitlements)
                .find((e) => e.id === owned.id)
        }
        if (!Number.isInteger(body.sessions) || body.sessions! < 1) throw Error('Nombre de séances invalide.')
        let credit = state.entitlements.find((e) => e.id === body.entitlementId)
        if (body.action === 'add-course') {
            const course = data.courses.find((c) => c.id === body.courseId)
            if (!course || !data.people.some((p) => p.id === body.userId && p.role === 'STUDENT'))
                throw Error('Cours ou étudiant introuvable.')
            credit = {
                id: crypto.randomUUID(),
                userId: body.userId,
                courseId: course.id,
                course: course.name,
                total: 0,
                remaining: 0,
                status: 'ACTIVE',
                bookingDelayHours: course.bookingDelayHours,
                purchaseDate: new Date().toISOString(),
                expiresAt: body.expiresAt!,
            }
            if (!Number.isFinite(Date.parse(credit.expiresAt))) throw Error('Date invalide.')
            state.entitlements.push(credit)
        }
        if (!credit || (credit.userId ?? studentId) !== body.userId) throw Error('Crédit introuvable.')
        credit.total += body.sessions!
        return adminProps(state)
            .students.flatMap((s) => s.entitlements)
            .find((e) => e.id === credit.id)
    }
    if (path === '/api/admin/slots') {
        if (method === 'POST' && body.recurrence) {
            const occurrences = slotOccurrences(body.startsAt ?? '', body.endsAt ?? '', body.recurrence)
            const draft = structuredClone(state)
            const created = []
            for (const occurrence of occurrences) {
                created.push(
                    await adminRequest(draft, url, {
                        method: 'POST',
                        body: JSON.stringify({
                            ...body,
                            recurrence: undefined,
                            startsAt: occurrence.startsAt.toISOString(),
                            endsAt: occurrence.endsAt.toISOString(),
                        }),
                    }),
                )
            }
            Object.assign(state, draft)
            return { ...(created[0] as object), count: created.length }
        }
        const previous = state.slots.find((s) => s.id === body.id)
        if (method === 'DELETE') {
            if (!previous) throw Error('Séance introuvable.')
            state.bookings.filter((b) => b.slotId === body.id).forEach((b) => (b.status = 'CANCELLED'))
            state.slots = state.slots.filter((s) => s.id !== body.id)
            return { ok: true }
        }
        const course = data.courses.find((c) => c.id === body.courseId)
        const teacherIds = [...new Set(body.teacherIds ?? (body.teacherId ? [body.teacherId] : []))]
        if (teacherIds.some((id) => !data.people.some((person) => person.id === id && person.role === 'TEACHER')))
            throw Error('Professeur inconnu.')
        const start = Date.parse(body.startsAt ?? ''),
            end = Date.parse(body.endsAt ?? '')
        if (
            (body.courseId && !course) ||
            !Number.isFinite(start) ||
            !Number.isFinite(end) ||
            start >= end ||
            !Number.isInteger(body.capacity) ||
            body.capacity! < 1
        )
            throw Error('Créneau invalide.')
        if (body.capacity! < (previous?.reserved ?? 0)) throw Error('La capacité est inférieure au nombre d’inscrits.')
        for (const teacherId of teacherIds) {
            const teacher = data.people.find((person) => person.id === teacherId)!
            if (
                state.slots.some(
                    (slot) =>
                        slot.id !== previous?.id &&
                        Date.parse(slot.startsAt) < end &&
                        Date.parse(slot.endsAt) > start &&
                        ((slot.teacherIds ?? []).includes(teacherId) ||
                            slot.teacher === `${teacher.firstName} ${teacher.lastName}` ||
                            state.bookings.some(
                                (booking) =>
                                    booking.slotId === slot.id &&
                                    booking.teacherId === teacherId &&
                                    booking.status !== 'CANCELLED',
                            )),
                )
            )
                throw Error('Un professeur a déjà une séance à cet horaire.')
        }
        const slot = {
            id: previous?.id ?? crypto.randomUUID(),
            courseId: course?.id ?? null,
            course: course?.name ?? 'Séance',
            level: course?.level,
            startsAt: body.startsAt!,
            endsAt: body.endsAt!,
            teacherIds,
            teacher: '',
            capacity: body.capacity!,
            reserved: previous?.reserved ?? 0,
            blocked: false,
            cancellationHours: course?.cancellationHours ?? 48,
        }
        if (method === 'PATCH') {
            if (!previous) throw Error('Séance introuvable.')
            Object.assign(previous, slot)
            state.bookings
                .filter((b) => b.slotId === slot.id)
                .forEach((b) =>
                    Object.assign(b, {
                        date: slot.startsAt,
                        endsAt: slot.endsAt,
                        teacher: slot.teacher,
                        course: slot.course,
                    }),
                )
        } else state.slots.push(slot)
        if (body.entitlementId) mutateBooking(state, 'POST', { slotId: slot.id, entitlementId: body.entitlementId })
        return slot
    }
    if (path === '/api/admin/courses') {
        const previous = data.courses.find((c) => c.id === body.id)
        if (method === 'DELETE') {
            if (!previous) throw Error('Cours introuvable.')
            const ids = state.slots.filter((s) => s.courseId === previous.id).map((s) => s.id)
            state.bookings.filter((b) => ids.includes(b.slotId)).forEach((b) => (b.status = 'CANCELLED'))
            state.slots = state.slots.filter((s) => s.courseId !== previous.id)
            state.courses = data.courses.filter((c) => c.id !== previous.id)
            return { ok: true }
        }
        if (!body.name?.trim() || !Number.isInteger(body.capacity) || body.capacity! < 1 || !body.durationMinutes)
            throw Error('Cours invalide.')
        const course: Course = {
            id: previous?.id ?? crypto.randomUUID(),
            name: body.name,
            level: body.level ?? 'INITIATION',
            durationMinutes: body.durationMinutes,
            totalDurationMinutes: body.totalDurationMinutes ?? body.durationMinutes,
            capacity: body.capacity!,
            reminderDays: body.reminderDays ?? 1,
            cancellationHours: body.cancellationHours ?? 48,
            defaultTeacherId: body.defaultTeacherId ?? null,
            minGapHours: body.minGapHours ?? 48,
            bookingDelayHours: body.bookingDelayHours ?? 72,
        }
        if (method === 'PATCH') {
            if (!previous) throw Error('Cours introuvable.')
            Object.assign(previous, course)
        } else data.courses.push(course)
        state.slots
            .filter((s) => s.courseId === course.id)
            .forEach((s) =>
                Object.assign(s, {
                    course: course.name,
                    level: course.level,
                    cancellationHours: course.cancellationHours,
                }),
            )
        state.entitlements.filter((e) => e.courseId === course.id).forEach((e) => (e.course = course.name))
        return course
    }
    if (path === '/api/admin/students' || path === '/api/admin/teachers') {
        const role = path.endsWith('/students') ? 'STUDENT' : 'TEACHER'
        const previous = data.people.find((p) => p.id === body.id && p.role === role)
        if (method === 'DELETE') {
            if (!previous) throw Error('Personne introuvable.')
            if (role === 'STUDENT') {
                const ids = state.entitlements.filter((e) => (e.userId ?? studentId) === previous.id).map((e) => e.id)
                state.bookings
                    .filter((b) => ids.includes(b.entitlementId) && b.status === 'BOOKED')
                    .forEach((b) => {
                        b.status = 'CANCELLED'
                        const s = state.slots.find((s) => s.id === b.slotId)
                        if (s) s.reserved--
                    })
                state.entitlements = state.entitlements.filter((e) => !ids.includes(e.id))
            } else {
                state.bookings
                    .filter((booking) => booking.teacherId === previous.id)
                    .forEach((booking) => (booking.teacherId = null))
                state.slots.forEach((slot) => (slot.teacherIds = slot.teacherIds?.filter((id) => id !== previous.id)))
                state.slots
                    .filter((s) => s.teacher === `${previous.firstName} ${previous.lastName}`)
                    .forEach((s) => (s.teacher = ''))
                data.courses
                    .filter((c) => c.defaultTeacherId === previous.id)
                    .forEach((c) => (c.defaultTeacherId = null))
            }
            state.people = data.people.filter((p) => p.id !== previous.id)
            return { ok: true }
        }
        if (!body.firstName?.trim() || !body.lastName?.trim() || !body.email?.includes('@'))
            throw Error('Vérifiez le prénom, le nom et l’adresse email.')
        if (data.people.some((p) => p.id !== previous?.id && p.email === body.email))
            throw Error('Cette adresse email est déjà utilisée.')
        const person: Person = {
            id: previous?.id ?? crypto.randomUUID(),
            role,
            firstName: body.firstName,
            lastName: body.lastName,
            email: body.email,
            phone: body.phone ?? null,
            language: body.language ?? 'fr',
        }
        if (method === 'PATCH') {
            if (!previous) throw Error('Personne introuvable.')
            state.slots
                .filter((s) => s.teacher === `${previous.firstName} ${previous.lastName}`)
                .forEach((s) => (s.teacher = `${person.firstName} ${person.lastName}`))
            Object.assign(previous, person)
        } else data.people.push(person)
        return person
    }
    if (path === '/api/admin/agenda/export') {
        const { agendaPeriod } = await import('@/lib/agenda-period')
        const { createAgendaPdf } = await import('@/lib/agenda-pdf')
        const mode = url.searchParams.get('mode') === 'week' ? 'week' : 'day'
        const period = agendaPeriod(url.searchParams.get('date') ?? '', mode)
        const slots = state.slots
            .filter((s) => new Date(s.startsAt) < period.to && new Date(s.endsAt) > period.from)
            .map((s) => ({
                ...s,
                level: s.level ?? null,
                startsAt: new Date(s.startsAt),
                endsAt: new Date(s.endsAt),
                students: state.bookings
                    .filter((b) => b.slotId === s.id && ['BOOKED', 'COMPLETED'].includes(b.status))
                    .map((b) => studentFor(state, b.entitlementId)!),
            }))
        const bytes = await createAgendaPdf(slots, period, mode)
        return new Response(new Blob([Uint8Array.from(bytes)], { type: 'application/pdf' }), {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="agenda-${period.firstDay}.pdf"`,
            },
        })
    }
    throw Error('Action indisponible dans la démo.')
}

export function displayTeacher(state: State, name: string | null) {
    if (!name) return name
    const teacher = hydrate(state).people.find(
        (person) => person.role === 'TEACHER' && `${person.firstName} ${person.lastName}` === name,
    )
    return teacher ? `${teacher.firstName} ${teacher.lastName.toLocaleUpperCase('fr-FR')}` : name
}
