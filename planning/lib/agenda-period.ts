export type AgendaMode = 'day' | 'week'
const partsFormatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
})
export function parisDate(date: Date) {
    const parts = partsFormatter.formatToParts(date)
    const value = (type: string) => parts.find((part) => part.type === type)!.value
    return `${value('year')}-${value('month')}-${value('day')}`
}
function shift(day: string, count: number) {
    const date = new Date(`${day}T12:00:00Z`)
    date.setUTCDate(date.getUTCDate() + count)
    return date.toISOString().slice(0, 10)
}
function midnight(day: string) {
    const target = Date.parse(`${day}T00:00:00Z`)
    let result = target
    for (let i = 0; i < 3; i++) {
        const parts = partsFormatter.formatToParts(new Date(result))
        const value = (type: string) => Number(parts.find((part) => part.type === type)!.value)
        const local = Date.UTC(
            value('year'),
            value('month') - 1,
            value('day'),
            value('hour'),
            value('minute'),
            value('second'),
        )
        result = target - (local - result)
    }
    return new Date(result)
}
export function agendaPeriod(date: string, mode: AgendaMode) {
    if (
        !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        Number.isNaN(Date.parse(`${date}T12:00:00Z`)) ||
        new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) !== date
    )
        throw Error('Date invalide.')
    const weekday = new Date(`${date}T12:00:00Z`).getUTCDay()
    const firstDay = mode === 'week' ? shift(date, -((weekday + 6) % 7)) : date
    const lastDay = mode === 'week' ? shift(firstDay, 6) : firstDay
    return { from: midnight(firstDay), to: midnight(shift(lastDay, 1)), firstDay, lastDay }
}
