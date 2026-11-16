import { PrismaClient } from '@prisma/client'
import { writeFile } from 'node:fs/promises'
import { agendaPeriod, parisDate } from '../lib/agenda-period'
import { winterWorkingDays } from '../lib/demo-calendar'

const db = new PrismaClient()
async function main() {
    const report = await db.$transaction(
        async (tx) => {
            const slots = await tx.slot.findMany({ include: { teachers: true }, orderBy: { id: 'asc' } })
            const bookings = await tx.booking.findMany()
            const backup = `/private/tmp/lesage-slots-${Date.now()}.json`
            await writeFile(backup, JSON.stringify({ slots, bookings }, null, 2), { mode: 0o600 })
            const days = [...new Set([...winterWorkingDays(), ...slots.map((slot) => parisDate(slot.startsAt))])].sort()
            const hour = (date: Date) =>
                Number(
                    new Intl.DateTimeFormat('fr-FR', {
                        timeZone: 'Europe/Paris',
                        hour: '2-digit',
                        hourCycle: 'h23',
                    })
                        .formatToParts(date)
                        .find((part) => part.type === 'hour')!.value,
                )
            let merged = 0,
                created = 0
            for (const day of days) {
                for (const startHour of [9, 14]) {
                    const group = slots.filter(
                        (slot) => parisDate(slot.startsAt) === day && (hour(slot.startsAt) < 12 ? 9 : 14) === startHour,
                    )
                    const startsAt = new Date(+agendaPeriod(day, 'day').from + startHour * 3600000)
                    const endsAt = new Date(+startsAt + 3 * 3600000)
                    if (!group.length) {
                        await tx.slot.create({ data: { startsAt, endsAt, capacity: 12 } })
                        created++
                        continue
                    }
                    const [target, ...duplicates] = group
                    const ids = group.map((slot) => slot.id)
                    const teachers = [
                        ...new Set(
                            group.flatMap((slot) => [
                                ...slot.teachers.map((teacher) => teacher.id),
                                ...(slot.teacherId ? [slot.teacherId] : []),
                            ]),
                        ),
                    ]
                    await tx.slot.update({
                        where: { id: target.id },
                        data: {
                            startsAt,
                            endsAt,
                            capacity: group.reduce((sum, slot) => sum + slot.capacity, 0),
                            blocked: group.every((slot) => slot.blocked),
                            courseId: group.every((slot) => slot.courseId === target.courseId) ? target.courseId : null,
                            teacherId: group.every((slot) => slot.teacherId === target.teacherId)
                                ? target.teacherId
                                : null,
                            teachers: { set: teachers.map((id) => ({ id })) },
                        },
                    })
                    await tx.booking.updateMany({ where: { slotId: { in: ids } }, data: { slotId: target.id } })
                    await tx.slot.deleteMany({ where: { id: { in: duplicates.map((slot) => slot.id) } } })
                    merged += duplicates.length
                }
            }
            const result = await tx.slot.findMany()
            for (const day of days) {
                const daily = result.filter((slot) => parisDate(slot.startsAt) === day)
                if (daily.length !== 2 || ![9, 14].every((h) => daily.some((slot) => hour(slot.startsAt) === h)))
                    throw Error(`Créneaux incorrects pour ${day}`)
            }
            const after = await tx.booking.findMany()
            if (
                after.length !== bookings.length ||
                bookings.some((before) => {
                    const booking = after.find((item) => item.id === before.id)
                    return (
                        !booking ||
                        ['userId', 'courseId', 'entitlementId', 'teacherId', 'status', 'attendance'].some(
                            (key) => booking[key as keyof typeof booking] !== before[key as keyof typeof before],
                        )
                    )
                })
            )
                throw Error('Une réservation a été altérée.')
            return { days: days.length, slots: result.length, merged, created, preservedBookings: after.length, backup }
        },
        { isolationLevel: 'Serializable', timeout: 60000 },
    )
    console.log(JSON.stringify(report, null, 2))
}
main()
    .catch((error) => {
        console.error(error)
        process.exitCode = 1
    })
    .finally(() => db.$disconnect())
