import { sourceCatalogue, remaining, validateSlot, mutateBooking, type State, type Person, type Course } from './store'
const studentId = 'student-demo'
export function hydrate(state: State) {
    state.people ??= [
        {
            id: studentId,
            firstName: 'Élève',
            lastName: 'Démo',
            email: 'eleve@example.test',
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
    return state.slots.map((slot) => ({
        ...slot,
        teacherId:
            hydrate(state).people.find((p) => p.role === 'TEACHER' && `${p.firstName} ${p.lastName}` === slot.teacher)
                ?.id ?? null,
        students: state.bookings
            .filter((b) => b.slotId === slot.id && ['BOOKED', 'COMPLETED'].includes(b.status))
            .map((b) => {
                const person = studentFor(state, b.entitlementId)!
                return {
                    id: person.id,
                    name: `${person.firstName} ${person.lastName}`,
                    email: person.email,
                    status: b.status,
                    bookingId: b.id,
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
            name: `${p.firstName} ${p.lastName}`,
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
                .filter((s) => s.teacher === `${p.firstName} ${p.lastName}` && new Date(s.endsAt) > new Date())
                .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
            return {
                ...p,
                name: `${p.firstName} ${p.lastName}`,
                nextSession: slots[0] ? { startsAt: slots[0].startsAt, course: slots[0].course } : null,
                assignedCourses: data.courses
                    .filter((c) => c.defaultTeacherId === p.id || slots.some((s) => s.courseId === c.id))
                    .map((c) => ({
                        id: c.id,
                        name: c.name,
                        level: c.level,
                        nextSessionAt: slots.find((s) => s.courseId === c.id)?.startsAt ?? null,
                    })),
            }
        })
    return { students, courses: data.courses, teachers }
}
export function teacherProps(state: State, past: boolean) {
    const data = hydrate(state)
    const user = data.people.find((p) => p.role === 'TEACHER') ?? { id: 'no-teacher', firstName: '', lastName: '' }
    const slots = state.slots
        .filter(
            (s) =>
                s.teacher === `${user.firstName} ${user.lastName}` &&
                (past ? new Date(s.endsAt) < new Date() : new Date(s.endsAt) >= new Date()),
        )
        .sort((a, b) => (past ? -1 : 1) * a.startsAt.localeCompare(b.startsAt))
        .slice(0, 100)
        .map((s) => ({
            ...s,
            startsAt: new Date(s.startsAt),
            endsAt: new Date(s.endsAt),
            teacherId: user.id,
            course: data.courses.find((c) => c.id === s.courseId) ?? null,
            bookings: state.bookings
                .filter((b) => b.slotId === s.id && ['BOOKED', 'COMPLETED'].includes(b.status))
                .map((b) => {
                    const person = studentFor(state, b.entitlementId)!
                    return {
                        ...b,
                        attendance: b.attendance as 'UNMARKED' | 'PRESENT' | 'ABSENT',
                        courseId: s.courseId,
                        user: {
                            ...person,
                            entitlements: remaining(state)
                                .filter((e) => (e.userId ?? studentId) === person.id)
                                .map((e) => ({
                                    courseId: e.courseId,
                                    totalSessions: e.total,
                                    _count: { bookings: e.total - e.remaining },
                                })),
                        },
                    }
                }),
        }))
    return { user, slots, past }
}
type Payload = Partial<Course & Person> & {
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
    action?: string
    sessions?: number
    expiresAt?: string
}
export async function adminRequest(state: State, url: URL, init?: RequestInit): Promise<unknown> {
    const data = hydrate(state)
    const method = init?.method ?? 'GET'
    const body = JSON.parse(String(init?.body ?? '{}')) as Payload
    const path = url.pathname
    if (path === '/api/teacher/attendance') {
        const b = state.bookings.find((b) => b.id === body.bookingId)
        if (!b || !['UNMARKED', 'PRESENT', 'ABSENT'].includes(body.attendance ?? '')) throw Error('Pointage invalide.')
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
        const previous = state.slots.find((s) => s.id === body.id)
        if (method === 'DELETE') {
            if (!previous) throw Error('Séance introuvable.')
            state.bookings.filter((b) => b.slotId === body.id).forEach((b) => (b.status = 'CANCELLED'))
            state.slots = state.slots.filter((s) => s.id !== body.id)
            return { ok: true }
        }
        const course = data.courses.find((c) => c.id === body.courseId)
        const teacher = data.people.find((p) => p.id === body.teacherId && p.role === 'TEACHER')
        const start = Date.parse(body.startsAt ?? ''),
            end = Date.parse(body.endsAt ?? '')
        if (
            !course ||
            !Number.isFinite(start) ||
            !Number.isFinite(end) ||
            start >= end ||
            !Number.isInteger(body.capacity) ||
            body.capacity! < 1
        )
            throw Error('Créneau invalide.')
        if (body.capacity! < (previous?.reserved ?? 0)) throw Error('La capacité est inférieure au nombre d’inscrits.')
        if (
            teacher &&
            state.slots.some(
                (s) =>
                    s.id !== previous?.id &&
                    s.teacher === `${teacher.firstName} ${teacher.lastName}` &&
                    Date.parse(s.startsAt) < end &&
                    Date.parse(s.endsAt) > start,
            )
        )
            throw Error('Le professeur a déjà un cours à cet horaire.')
        const slot = {
            id: previous?.id ?? crypto.randomUUID(),
            courseId: course.id,
            course: course.name,
            level: course.level,
            startsAt: body.startsAt!,
            endsAt: body.endsAt!,
            teacher: teacher ? `${teacher.firstName} ${teacher.lastName}` : '',
            capacity: body.capacity!,
            reserved: previous?.reserved ?? 0,
            blocked: false,
            cancellationHours: course.cancellationHours,
        }
        if (method === 'PATCH') {
            if (!previous) throw Error('Séance introuvable.')
            if (previous.reserved && previous.courseId !== slot.courseId)
                throw Error('Ce cours comporte des inscriptions.')
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
