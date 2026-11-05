import { PrismaClient } from '@prisma/client'
import { randomInt } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import { validateBooking } from '../lib/booking'

const db = new PrismaClient()
function shuffle<T>(items: T[]) {
    const result = [...items]
    for (let i = result.length - 1; i > 0; i--) {
        const j = randomInt(i + 1)
        ;[result[i], result[j]] = [result[j], result[i]]
    }
    return result
}
async function main() {
    const report = await db.$transaction(
        async (tx) => {
            const now = new Date()
            const students = await tx.user.findMany({ where: { role: 'STUDENT' }, orderBy: { lastName: 'asc' } })
            const courses = await tx.course.findMany({ where: { wooProductId: { not: null } } })
            const slots = await tx.slot.findMany({
                where: { startsAt: { gt: now }, blocked: false, courseId: { in: courses.map((course) => course.id) } },
            })
            const blockouts = await tx.blockout.findMany({ where: { endsAt: { gt: now } } })
            if (!students.length || !courses.length || !slots.length)
                throw Error('Étudiants, cours ou séances à venir manquants.')
            const result = []
            for (const student of students) {
                const existingBookings = await tx.booking.findMany({
                    where: { userId: student.id, status: 'BOOKED' },
                    include: { slot: true },
                })
                const existingEntitlements = await tx.entitlement.findMany({
                    where: { userId: student.id, status: 'ACTIVE', expiresAt: { gt: now } },
                })
                const assignedCourseIds = new Set(existingEntitlements.map((entitlement) => entitlement.courseId))
                const added: string[] = []
                async function grant(course: (typeof courses)[number]) {
                    const expiresAt = new Date(now)
                    expiresAt.setMonth(expiresAt.getMonth() + course.validityMonths)
                    const entitlement = await tx.entitlement.create({
                        data: {
                            userId: student.id,
                            courseId: course.id,
                            totalSessions: course.sessionsCount,
                            purchaseDate: now,
                            expiresAt,
                            source: 'MANUAL',
                        },
                    })
                    assignedCourseIds.add(course.id)
                    added.push(course.name)
                    return entitlement
                }
                let reservation: { id: string; course: string; startsAt: string } | null = null
                if (!existingBookings.some((booking) => booking.slot.startsAt > now)) {
                    for (const slot of shuffle(slots)) {
                        if (
                            existingBookings.some(
                                (booking) => booking.slot.startsAt < slot.endsAt && booking.slot.endsAt > slot.startsAt,
                            )
                        )
                            continue
                        if (blockouts.some((block) => block.startsAt < slot.endsAt && block.endsAt > slot.startsAt))
                            continue
                        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${slot.id}))`
                        if ((await tx.booking.count({ where: { slotId: slot.id, status: 'BOOKED' } })) >= slot.capacity)
                            continue
                        const course = courses.find((course) => course.id === slot.courseId)!
                        let entitlement = null
                        for (const candidate of existingEntitlements.filter(
                            (item) =>
                                item.courseId === course.id &&
                                item.purchaseDate <= slot.startsAt &&
                                item.expiresAt > slot.startsAt,
                        )) {
                            const used = await tx.booking.count({
                                where: { entitlementId: candidate.id, status: { in: ['BOOKED', 'COMPLETED'] } },
                            })
                            if (used < candidate.totalSessions) {
                                entitlement = candidate
                                break
                            }
                        }
                        entitlement ??= await grant(course)
                        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${entitlement.id}))`
                        await validateBooking(tx, student.id, entitlement.id, slot.id, undefined, true)
                        const booking = await tx.booking.create({
                            data: {
                                userId: student.id,
                                entitlementId: entitlement.id,
                                courseId: course.id,
                                slotId: slot.id,
                            },
                        })
                        reservation = { id: booking.id, course: course.name, startsAt: slot.startsAt.toISOString() }
                        break
                    }
                    if (!reservation)
                        throw Error(`Aucune séance disponible pour ${student.firstName} ${student.lastName}.`)
                }
                // Each student receives one to three additional course assignments in this run.
                const target = randomInt(1, 4)
                for (const course of shuffle(courses.filter((course) => !assignedCourseIds.has(course.id)))) {
                    if (added.length >= target) break
                    await grant(course)
                }
                const upcoming = await tx.booking.count({
                    where: { userId: student.id, status: 'BOOKED', slot: { startsAt: { gt: now } } },
                })
                if (upcoming < 1) throw Error('Vérification échouée : étudiant sans réservation.')
                result.push({
                    student: `${student.firstName} ${student.lastName}`,
                    studentId: student.id,
                    coursesAdded: added,
                    newReservation: reservation,
                    upcomingReservations: upcoming,
                })
            }
            return {
                createdAt: now.toISOString(),
                students: result.length,
                coursesAdded: result.reduce((count, item) => count + item.coursesAdded.length, 0),
                newReservations: result.filter((item) => item.newReservation).length,
                assignments: result,
            }
        },
        { isolationLevel: 'Serializable', timeout: 60000 },
    )
    await writeFile(
        new URL('../data/lesage/student-assignments-report.json', import.meta.url),
        JSON.stringify(report, null, 2) + '\n',
    )
    console.log(
        JSON.stringify({
            students: report.students,
            coursesAdded: report.coursesAdded,
            newReservations: report.newReservations,
            everyStudentHasUpcomingReservation: report.assignments.every((item) => item.upcomingReservations >= 1),
        }),
    )
}
main()
    .catch((error) => {
        console.error(error)
        process.exitCode = 1
    })
    .finally(() => db.$disconnect())
