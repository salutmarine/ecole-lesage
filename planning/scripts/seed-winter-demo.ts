import { PrismaClient } from '@prisma/client'
import { randomInt } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import { winterWorkingDays } from '../lib/demo-calendar'

const db = new PrismaClient()
const names = [
    ['Emma', 'Lefebvre'],
    ['Louis', 'Dubois'],
    ['Chloé', 'Roux'],
    ['Gabriel', 'Fontaine'],
    ['Léa', 'Chevalier'],
    ['Hugo', 'François'],
    ['Manon', 'Legrand'],
    ['Arthur', 'Garnier'],
    ['Inès', 'Faure'],
    ['Raphaël', 'Rousseau'],
    ['Alice', 'Vincent'],
    ['Jules', 'Muller'],
    ['Sarah', 'Lambert'],
    ['Nathan', 'Bonnet'],
    ['Louise', 'Girard'],
]
function shuffled<T>(values: T[]) {
    const result = [...values]
    for (let index = result.length - 1; index > 0; index--) {
        const other = randomInt(index + 1)
        ;[result[index], result[other]] = [result[other], result[index]]
    }
    return result
}
async function main() {
    const report = await db.$transaction(
        async (tx) => {
            const students = []
            let newStudents = 0
            for (const [index, [firstName, lastName]] of names.entries()) {
                const email = `etudiant.demo.${String(index + 1).padStart(2, '0')}@example.test`
                const existing = await tx.user.findUnique({ where: { email } })
                if (existing && existing.role !== 'STUDENT')
                    throw Error('Adresse de démonstration utilisée par un autre rôle.')
                const student = await tx.user.upsert({
                    where: { email },
                    update: {},
                    create: {
                        firstName,
                        lastName,
                        email,
                        phone: `06 00 00 00 ${String(index + 1).padStart(2, '0')}`,
                        role: 'STUDENT',
                    },
                })
                if (!existing) newStudents++
                students.push({
                    id: student.id,
                    firstName: student.firstName,
                    lastName: student.lastName,
                    email: student.email,
                })
            }
            const courses = await tx.course.findMany({
                where: { wooProductId: { not: null }, defaultTeacher: { role: 'TEACHER' } },
            })
            if (!courses.length) throw Error('Aucun cours importé avec professeur affecté.')
            const from = new Date('2026-11-01T00:00:00+01:00'),
                until = new Date('2027-02-01T00:00:00+01:00')
            const occupied = await tx.slot.findMany({ where: { startsAt: { lt: until }, endsAt: { gt: from } } })
            const blockouts = await tx.blockout.findMany({ where: { startsAt: { lt: until }, endsAt: { gt: from } } })
            const created: { id: string; date: string; time: string; course: string; teacherId: string | null }[] = []
            let alreadyPresent = 0,
                unavailable = 0
            const days = winterWorkingDays()
            for (const day of days) {
                // Stable IDs make repeated execution safe; the first run picks one to three sessions per day.
                if (occupied.some((slot) => slot.id.startsWith(`demo-winter-${day}-`))) {
                    alreadyPresent++
                    continue
                }
                const count = randomInt(1, 4)
                for (let index = 0; index < count; index++) {
                    let found = false
                    for (const time of shuffled(['09:30', '14:00'])) {
                        const startsAt = new Date(`${day}T${time}:00+01:00`)
                        for (const course of shuffled(courses)) {
                            const endsAt = new Date(
                                startsAt.getTime() + (course.durationMinutes ?? course.durationHours * 60) * 60000,
                            )
                            if (endsAt > new Date(`${day}T17:00:00+01:00`)) continue
                            if (blockouts.some((block) => block.startsAt < endsAt && block.endsAt > startsAt)) continue
                            if (
                                occupied.some(
                                    (slot) =>
                                        slot.teacherId === course.defaultTeacherId &&
                                        slot.startsAt < endsAt &&
                                        slot.endsAt > startsAt,
                                )
                            )
                                continue
                            const slot = await tx.slot.create({
                                data: {
                                    id: `demo-winter-${day}-${index + 1}`,
                                    courseId: course.id,
                                    teacherId: course.defaultTeacherId,
                                    startsAt,
                                    endsAt,
                                    capacity: course.capacity,
                                },
                            })
                            occupied.push(slot)
                            created.push({
                                id: slot.id,
                                date: day,
                                time,
                                course: course.name,
                                teacherId: slot.teacherId,
                            })
                            found = true
                            break
                        }
                        if (found) break
                    }
                    if (!found) unavailable++
                }
            }
            // Validate every new session before committing the transaction.
            for (const slot of created) {
                if (!days.includes(slot.date)) throw Error('Séance créée sur un jour exclu.')
                const actual = occupied.find((item) => item.id === slot.id)!
                if (
                    occupied.some(
                        (other) =>
                            other.id !== actual.id &&
                            other.teacherId === actual.teacherId &&
                            other.startsAt < actual.endsAt &&
                            other.endsAt > actual.startsAt,
                    )
                )
                    throw Error('Conflit de professeur détecté.')
            }
            return {
                period: 'Novembre 2026 – janvier 2027',
                fictional: true,
                newStudents,
                students,
                workingDays: days.length,
                createdSessions: created.length,
                existingDemoDays: alreadyPresent,
                unavailable,
                byMonth: Object.fromEntries(
                    ['2026-11', '2026-12', '2027-01'].map((month) => [
                        month,
                        created.filter((slot) => slot.date.startsWith(month)).length,
                    ]),
                ),
                sessions: created,
            }
        },
        { isolationLevel: 'Serializable', timeout: 60000 },
    )
    await writeFile(
        new URL('../data/lesage/winter-demo-report.json', import.meta.url),
        JSON.stringify(report, null, 2) + '\n',
    )
    console.log(
        JSON.stringify(
            { ...report, sessions: undefined, students: `${report.students.length} profils fictifs` },
            null,
            2,
        ),
    )
}
main()
    .catch((error) => {
        console.error(error)
        process.exitCode = 1
    })
    .finally(() => db.$disconnect())
