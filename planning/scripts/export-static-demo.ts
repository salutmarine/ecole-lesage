import { PrismaClient } from '@prisma/client'
import { createHash } from 'node:crypto'
import { writeFile } from 'node:fs/promises'

const db = new PrismaClient()
async function main() {
    const snapshot = await db.$transaction(
        async (tx) => {
            const [users, courses, slots, entitlements, bookings, blockouts, webhookEvents] = await Promise.all([
                tx.user.findMany({ orderBy: { createdAt: 'asc' } }),
                tx.course.findMany({ orderBy: { name: 'asc' } }),
                tx.slot.findMany({ include: { teachers: { select: { id: true } } }, orderBy: { startsAt: 'asc' } }),
                tx.entitlement.findMany({ orderBy: { purchaseDate: 'asc' } }),
                tx.booking.findMany({ orderBy: { createdAt: 'asc' } }),
                tx.blockout.findMany({ orderBy: { startsAt: 'asc' } }),
                tx.webhookEvent.findMany({ orderBy: { receivedAt: 'asc' } }),
            ])
            const people = new Map(users.map((user) => [user.id, user]))
            const catalogue = new Map(courses.map((course) => [course.id, course]))
            const calendar = new Map(slots.map((slot) => [slot.id, slot]))
            const name = (id: string | null) => {
                const person = id ? people.get(id) : undefined
                return person ? `${person.firstName} ${person.lastName}` : null
            }
            return {
                version: 6 as const,
                demoStudentId: users.find((user) => user.role === 'STUDENT')?.id,
                demoTeacherId:
                    users.find(
                        (user) => user.role === 'TEACHER' && user.email === 'camille.moreau@professeurs.example.test',
                    )?.id ?? users.find((user) => user.role === 'TEACHER')?.id,
                people: users,
                courses: courses.map((course) => ({
                    ...course,
                    durationMinutes: course.durationMinutes ?? course.durationHours * 60,
                    totalDurationMinutes:
                        course.totalDurationMinutes ??
                        (course.durationMinutes ?? course.durationHours * 60) * course.sessionsCount,
                })),
                slots: slots.map(({ teachers, ...slot }) => ({
                    ...slot,
                    teacherIds: teachers.map((teacher) => teacher.id),
                    teacher: name(slot.teacherId) ?? '',
                    course: 'Séance',
                    level: slot.courseId ? catalogue.get(slot.courseId)?.level : undefined,
                    cancellationHours:
                        (slot.courseId ? catalogue.get(slot.courseId)?.cancellationHours : undefined) ?? 48,
                    reserved: bookings.filter((booking) => booking.slotId === slot.id && booking.status !== 'CANCELLED')
                        .length,
                })),
                entitlements: entitlements.map((entitlement) => ({
                    ...entitlement,
                    course: catalogue.get(entitlement.courseId)!.name,
                    total: entitlement.totalSessions,
                    remaining:
                        entitlement.totalSessions -
                        bookings.filter(
                            (booking) => booking.entitlementId === entitlement.id && booking.status !== 'CANCELLED',
                        ).length,
                    bookingDelayHours: catalogue.get(entitlement.courseId)!.bookingDelayHours,
                })),
                bookings: bookings.map((booking) => {
                    const slot = calendar.get(booking.slotId)!
                    return {
                        ...booking,
                        course: catalogue.get(booking.courseId)!.name,
                        date: slot.startsAt,
                        endsAt: slot.endsAt,
                        teacher: name(booking.teacherId),
                        cancellationHours:
                            (slot.courseId ? catalogue.get(slot.courseId)?.cancellationHours : undefined) ?? 48,
                    }
                }),
                blockouts,
                webhookEvents,
            }
        },
        { isolationLevel: 'RepeatableRead', timeout: 30000 },
    )
    const snapshotId = createHash('sha256').update(JSON.stringify(snapshot)).digest('hex').slice(0, 16)
    await writeFile(
        new URL('../data/lesage/local-demo.json', import.meta.url),
        JSON.stringify({ ...snapshot, snapshotId }, null, 2) + '\n',
    )
    console.log(
        JSON.stringify({
            snapshotId,
            users: snapshot.people.length,
            courses: snapshot.courses.length,
            slots: snapshot.slots.length,
            entitlements: snapshot.entitlements.length,
            bookings: snapshot.bookings.length,
            blockouts: snapshot.blockouts.length,
            webhookEvents: snapshot.webhookEvents.length,
        }),
    )
}
main()
    .catch((error) => {
        console.error(error)
        process.exitCode = 1
    })
    .finally(() => db.$disconnect())
