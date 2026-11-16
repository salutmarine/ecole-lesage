import { agendaPeriod, parisDate } from './agenda-period'

export type SlotRecurrence = { unit: 'day' | 'week'; interval: number; until: string }

export function slotOccurrences(startsAt: string, endsAt: string, recurrence?: SlotRecurrence) {
    const start = new Date(startsAt),
        end = new Date(endsAt)
    const duration = +end - +start
    if (
        !Number.isFinite(+start) ||
        !Number.isFinite(+end) ||
        duration < 900000 ||
        duration > 43200000 ||
        duration % 900000
    )
        throw Error('La durée doit être comprise entre 15 minutes et 12 heures, par pas de 15 minutes.')
    const result = [{ startsAt: start, endsAt: end }]
    if (!recurrence) return result
    if (
        !['day', 'week'].includes(recurrence.unit) ||
        !Number.isInteger(recurrence.interval) ||
        recurrence.interval < 1 ||
        recurrence.interval > 365
    )
        throw Error('Fréquence de répétition invalide.')
    const firstDay = parisDate(start)
    agendaPeriod(recurrence.until, 'day')
    if (recurrence.until < firstDay) throw Error('La fin de répétition doit suivre le premier créneau.')
    const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Europe/Paris',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
    }).formatToParts(start)
    const hours = Number(parts.find((part) => part.type === 'hour')!.value)
    const minutes = Number(parts.find((part) => part.type === 'minute')!.value)
    const step = recurrence.interval * (recurrence.unit === 'week' ? 7 : 1)
    const cursor = new Date(`${firstDay}T12:00:00Z`)
    for (;;) {
        cursor.setUTCDate(cursor.getUTCDate() + step)
        const day = cursor.toISOString().slice(0, 10)
        if (day > recurrence.until) break
        if (result.length >= 366) throw Error('Limitez la série à 366 créneaux.')
        // Resolve the wall-clock time in Paris, including daylight-saving changes.
        let next = new Date(`${day}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00Z`)
        const target = +next
        for (let i = 0; i < 3; i++) {
            const local = new Intl.DateTimeFormat('sv-SE', {
                timeZone: 'Europe/Paris',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hourCycle: 'h23',
            })
                .format(next)
                .replace(' ', 'T')
            next = new Date(+next + target - Date.parse(`${local}Z`))
        }
        if (
            parisDate(next) !== day ||
            new Intl.DateTimeFormat('en-GB', {
                timeZone: 'Europe/Paris',
                hour: '2-digit',
                minute: '2-digit',
                hourCycle: 'h23',
            }).format(next) !== `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
        )
            throw Error(`L’horaire choisi n’existe pas le ${day} (changement d’heure).`)
        result.push({ startsAt: next, endsAt: new Date(+next + duration) })
    }
    return result
}
