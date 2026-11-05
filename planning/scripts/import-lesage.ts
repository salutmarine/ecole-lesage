import { readFile, writeFile } from 'node:fs/promises'
import { randomInt } from 'node:crypto'
import { CourseLevel, PrismaClient } from '@prisma/client'
import { z } from 'zod'

const recordSchema = z
    .object({
        sourceUrl: z.string().url(),
        name: z.string().min(1),
        level: z.nativeEnum(CourseLevel),
        totalDurationMinutes: z.number().int().positive(),
        durationMinutes: z.number().int().min(15).max(720),
        sessionsCount: z.number().int().positive(),
        capacity: z.number().int().positive().nullable(),
        validityMonths: z.number().int().positive().nullable(),
        wooProductIds: z.array(z.number().int().positive()),
    })
    .passthrough()
    .refine(
        (record) => record.sessionsCount * record.durationMinutes === record.totalDurationMinutes,
        'Durées incohérentes',
    )

const profiles = [
    { firstName: 'Sophie', lastName: 'Martin', email: 'sophie.martin@professeurs.example.test' },
    { firstName: 'Élise', lastName: 'Bernard', email: 'elise.bernard@professeurs.example.test' },
    { firstName: 'Camille', lastName: 'Moreau', email: 'camille.moreau@professeurs.example.test' },
    { firstName: 'Julien', lastName: 'Laurent', email: 'julien.laurent@professeurs.example.test' },
    { firstName: 'Clara', lastName: 'Petit', email: 'clara.petit@professeurs.example.test' },
]
function shuffle<T>(values: T[]) {
    const result = [...values]
    for (let i = result.length - 1; i > 0; i--) {
        const j = randomInt(i + 1)
        ;[result[i], result[j]] = [result[j], result[i]]
    }
    return result
}
const db = new PrismaClient()
async function main() {
    const raw = JSON.parse(await readFile(new URL('../data/lesage/catalogue.json', import.meta.url), 'utf8'))
    const records = z.array(recordSchema).min(1).parse(raw)
    if (new Set(records.map((record) => record.sourceUrl)).size !== records.length)
        throw Error('URLs dupliquées dans le catalogue.')
    const result = await db.$transaction(
        async (tx) => {
            const teachers = []
            for (const profile of profiles) {
                const teacher = await tx.user.upsert({
                    where: { email: profile.email },
                    create: { ...profile, role: 'TEACHER' },
                    update: {},
                })
                if (teacher.role !== 'TEACHER')
                    throw Error(`Adresse déjà utilisée par un autre rôle : ${profile.email}`)
                teachers.push(teacher)
            }
            const randomizedTeachers = shuffle(teachers)
            const assignments = []
            let created = 0,
                updated = 0
            for (const [index, record] of shuffle(records).entries()) {
                const wooProductId = record.wooProductIds[0] ?? null
                const existing = await tx.course.findFirst({
                    where: {
                        OR: [...(wooProductId ? [{ wooProductId }] : []), { name: record.name, level: record.level }],
                    },
                })
                const teacher =
                    randomizedTeachers.find((t) => t.id === existing?.defaultTeacherId) ??
                    randomizedTeachers[index % teachers.length]
                const data = {
                    name: record.name,
                    level: record.level,
                    totalDurationMinutes: record.totalDurationMinutes,
                    durationMinutes: record.durationMinutes,
                    durationHours: record.durationMinutes / 60,
                    sessionsCount: record.sessionsCount,
                    wooProductId,
                    capacity: record.capacity ?? 6,
                    validityMonths: record.validityMonths ?? 12,
                    defaultTeacherId: teacher.id,
                }
                const course = existing
                    ? await tx.course.update({ where: { id: existing.id }, data })
                    : await tx.course.create({
                          data: { ...data, minGapHours: 48, cancellationHours: 48, reminderDays: 1 },
                      })
                if (existing) updated++
                else created++
                assignments.push({
                    courseId: course.id,
                    course: course.name,
                    level: course.level,
                    sessions: course.sessionsCount,
                    totalHours: (course.totalDurationMinutes ?? 0) / 60,
                    teacher: `${teacher.firstName} ${teacher.lastName}`,
                    sourceUrl: record.sourceUrl,
                })
            }
            return {
                importedAt: new Date().toISOString(),
                created,
                updated,
                total: records.length,
                teachers: teachers.map((t) => ({
                    id: t.id,
                    name: `${t.firstName} ${t.lastName}`,
                    email: t.email,
                    fictional: true,
                })),
                assignments,
            }
        },
        { isolationLevel: 'Serializable', timeout: 60000 },
    )
    await writeFile(
        new URL('../data/lesage/import-report.json', import.meta.url),
        JSON.stringify(result, null, 2) + '\n',
    )
    console.log(JSON.stringify(result, null, 2))
}
main()
    .catch((error) => {
        console.error(error)
        process.exitCode = 1
    })
    .finally(() => db.$disconnect())
