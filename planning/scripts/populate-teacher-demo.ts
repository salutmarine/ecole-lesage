import { PrismaClient, type User } from '@prisma/client'
import { parisDate } from '../lib/agenda-period'

const db = new PrismaClient()
const prefix = 'demo-teacher-2026'
async function main() {
    const report = await db.$transaction(
        async (tx) => {
            const teachers = await tx.user.findMany({ where: { role: 'TEACHER' }, orderBy: { id: 'asc' } })
            const courses = await tx.course.findMany({ orderBy: [{ level: 'asc' }, { name: 'asc' }] })
            if (!teachers.length || !courses.length)
                throw Error('Il faut des professeurs et des cours avant de remplir la démonstration.')
            const students: User[] = []
            for (let index = 0; index < 15; index++) {
                const email = `etudiant.demo.${String(index + 1).padStart(2, '0')}@example.test`
                const existing = await tx.user.findUnique({ where: { email } })
                if (existing && existing.role !== 'STUDENT')
                    throw Error('Un compte de démonstration a un rôle incompatible.')
                students.push(
                    await tx.user.upsert({
                        where: { email },
                        update: {},
                        create: {
                            email,
                            firstName: [
                                'Emma',
                                'Louis',
                                'Chloé',
                                'Gabriel',
                                'Léa',
                                'Hugo',
                                'Manon',
                                'Arthur',
                                'Inès',
                                'Raphaël',
                                'Alice',
                                'Jules',
                                'Sarah',
                                'Nathan',
                                'Louise',
                            ][index],
                            lastName: [
                                'Lefebvre',
                                'Dubois',
                                'Roux',
                                'Fontaine',
                                'Chevalier',
                                'François',
                                'Legrand',
                                'Garnier',
                                'Faure',
                                'Rousseau',
                                'Vincent',
                                'Muller',
                                'Lambert',
                                'Bonnet',
                                'Girard',
                            ][index],
                            role: 'STUDENT',
                        },
                    }),
                )
            }
            const from = new Date('2026-11-01T00:00:00+01:00'),
                until = new Date('2027-01-01T00:00:00+01:00')
            const slots = await tx.slot.findMany({
                where: { startsAt: { gte: from, lt: until } },
                include: { teachers: true },
                orderBy: { startsAt: 'asc' },
            })
            const bookings = await tx.booking.findMany({
                where: { status: { in: ['BOOKED', 'COMPLETED'] } },
                include: { slot: true },
            })
            const blocks = await tx.blockout.findMany({ where: { startsAt: { lt: until }, endsAt: { gt: from } } })
            const seededSlots = new Set(
                (
                    await tx.booking.findMany({
                        where: { entitlement: { source: 'DEMO_TEACHER_2026' } },
                        select: { slotId: true },
                    })
                ).map((booking) => booking.slotId),
            )
            let createdSlots = 0,
                createdBookings = 0
            const overlaps = (a: { startsAt: Date; endsAt: Date }, b: { startsAt: Date; endsAt: Date }) =>
                a.startsAt < b.endsAt && a.endsAt > b.startsAt
            function teacherAvailable(teacherId: string, slot: { id: string; startsAt: Date; endsAt: Date }) {
                return (
                    !slots.some(
                        (other) =>
                            other.id !== slot.id &&
                            overlaps(slot, other) &&
                            (other.teacherId === teacherId ||
                                other.teachers.some((teacher) => teacher.id === teacherId)),
                    ) &&
                    !bookings.some(
                        (booking) =>
                            booking.slotId !== slot.id &&
                            booking.teacherId === teacherId &&
                            overlaps(slot, booking.slot),
                    )
                )
            }
            async function addStudent(slot: (typeof slots)[number], teacherId: string | null, offset: number) {
                if (bookings.filter((booking) => booking.slotId === slot.id).length >= slot.capacity) return false
                for (let attempt = 0; attempt < students.length; attempt++) {
                    const student = students[(offset + attempt) % students.length]
                    if (bookings.some((booking) => booking.userId === student.id && overlaps(slot, booking.slot)))
                        continue
                    const course = courses[(offset + attempt) % courses.length]
                    if (
                        bookings.some(
                            (booking) =>
                                booking.userId === student.id &&
                                booking.courseId === course.id &&
                                Math.abs(+booking.slot.startsAt - +slot.startsAt) <
                                    Math.max(course.minGapHours, 24) * 3600000,
                        )
                    )
                        continue
                    const key = `${prefix}-${student.id}-${course.id}`
                    const entitlement = await tx.entitlement.upsert({
                        where: { externalKey: key },
                        update: {},
                        create: {
                            userId: student.id,
                            courseId: course.id,
                            totalSessions: 12,
                            purchaseDate: new Date('2026-10-01T00:00:00+02:00'),
                            expiresAt: new Date('2027-11-01T00:00:00+01:00'),
                            externalKey: key,
                            source: 'DEMO_TEACHER_2026',
                        },
                    })
                    const used = bookings.filter((booking) => booking.entitlementId === entitlement.id).length
                    if (used >= entitlement.totalSessions) continue
                    const past = slot.endsAt < new Date()
                    const booking = await tx.booking.create({
                        data: {
                            userId: student.id,
                            courseId: course.id,
                            entitlementId: entitlement.id,
                            slotId: slot.id,
                            teacherId,
                            status: past ? 'COMPLETED' : 'BOOKED',
                            attendance: past && teacherId ? 'PRESENT' : 'UNMARKED',
                        },
                        include: { slot: true },
                    })
                    bookings.push(booking)
                    createdBookings++
                    return true
                }
                return false
            }
            // Dedicated, stable sessions guarantee each teacher has both history and December bookings.
            for (const [index, teacher] of teachers.entries()) {
                for (const month of ['11', '12']) {
                    const id = `${prefix}-${teacher.id}-${month}`
                    let slot = slots.find((slot) => slot.id === id)
                    if (!slot) {
                        for (let day = 2; day <= (month === '11' ? 10 : 18) && !slot; day++) {
                            for (const hour of ['09:30', '14:00']) {
                                const startsAt = new Date(
                                    `2026-${month}-${String(day).padStart(2, '0')}T${hour}:00+01:00`,
                                )
                                if ([0, 6].includes(new Date(`${parisDate(startsAt)}T12:00:00Z`).getUTCDay())) continue
                                const candidate = { id, startsAt, endsAt: new Date(+startsAt + 3 * 3600000) }
                                if (
                                    !teacherAvailable(teacher.id, candidate) ||
                                    blocks.some((block) => overlaps(candidate, block))
                                )
                                    continue
                                if (
                                    students.filter(
                                        (student) =>
                                            !bookings.some(
                                                (booking) =>
                                                    booking.userId === student.id && overlaps(candidate, booking.slot),
                                            ),
                                    ).length < 4
                                )
                                    continue
                                slot = await tx.slot.create({
                                    data: { ...candidate, capacity: 6 },
                                    include: { teachers: true },
                                })
                                slots.push(slot)
                                createdSlots++
                                break
                            }
                        }
                    }
                    if (!slot) throw Error(`Aucun horaire disponible pour ${teacher.firstName} en ${month}/2026.`)
                    for (
                        let seat = bookings.filter((booking) => booking.slotId === slot!.id).length;
                        seat < 3;
                        seat++
                    ) {
                        if (!(await addStudent(slot, teacher.id, index * 3 + seat)))
                            throw Error(`Impossible de compléter la séance de ${teacher.firstName} en ${month}.`)
                    }
                }
            }
            // Some occupied sessions deliberately have no teacher, including no legacy/default assignment.
            for (let index = 0; index < 3; index++) {
                const id = `${prefix}-sans-prof-${index}`
                let slot = slots.find((slot) => slot.id === id)
                if (!slot) {
                    const startsAt = new Date(`2026-12-${String(7 + index).padStart(2, '0')}T14:00:00+01:00`)
                    const candidate = { startsAt, endsAt: new Date(+startsAt + 3 * 3600000) }
                    if (blocks.some((block) => overlaps(candidate, block))) continue
                    slot = await tx.slot.create({
                        data: { id, ...candidate, capacity: 6 },
                        include: { teachers: true },
                    })
                    slots.push(slot)
                    createdSlots++
                }
                for (let seat = bookings.filter((booking) => booking.slotId === id).length; seat < 2; seat++)
                    await addStudent(slot, null, index * 4 + seat)
            }
            // Fill existing sessions without changing or deleting any existing reservation.
            for (const [index, slot] of slots.entries()) {
                if (
                    slot.blocked ||
                    seededSlots.has(slot.id) ||
                    slot.id.startsWith(prefix) ||
                    blocks.some((block) => overlaps(slot, block))
                )
                    continue
                const target = Math.min(slot.capacity - 1, 2 + (index % 3))
                const teacher =
                    index % 4 === 0 ? undefined : teachers.find((teacher) => teacherAvailable(teacher.id, slot))
                for (let seat = bookings.filter((booking) => booking.slotId === slot.id).length; seat < target; seat++)
                    await addStudent(slot, teacher?.id ?? null, index + seat)
            }
            const assigned = teachers.map((teacher) => ({
                name: `${teacher.firstName} ${teacher.lastName}`,
                november: new Set(
                    bookings
                        .filter(
                            (booking) =>
                                booking.teacherId === teacher.id &&
                                parisDate(booking.slot.startsAt) >= '2026-11-01' &&
                                parisDate(booking.slot.startsAt) <= '2026-11-10',
                        )
                        .map((booking) => booking.slotId),
                ).size,
                december: new Set(
                    bookings
                        .filter(
                            (booking) =>
                                booking.teacherId === teacher.id &&
                                parisDate(booking.slot.startsAt).startsWith('2026-12'),
                        )
                        .map((booking) => booking.slotId),
                ).size,
            }))
            if (assigned.some((teacher) => !teacher.november || !teacher.december))
                throw Error('Un professeur ne dispose pas des deux périodes demandées.')
            return {
                createdSlots,
                createdBookings,
                teachers: assigned,
                incompleteSessions: slots.filter((slot) => {
                    const count = bookings.filter((booking) => booking.slotId === slot.id).length
                    return count > 0 && count < slot.capacity
                }).length,
                occupiedWithoutTeacher: slots.filter(
                    (slot) =>
                        !slot.teacherId &&
                        !slot.teachers.length &&
                        bookings.some((booking) => booking.slotId === slot.id) &&
                        !bookings.some((booking) => booking.slotId === slot.id && booking.teacherId),
                ).length,
            }
        },
        { isolationLevel: 'Serializable', timeout: 120000 },
    )
    console.log(JSON.stringify(report, null, 2))
}
main()
    .catch((error) => {
        console.error(error)
        process.exitCode = 1
    })
    .finally(() => db.$disconnect())
