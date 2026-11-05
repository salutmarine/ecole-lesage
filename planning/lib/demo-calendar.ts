// Jours fériés nationaux applicables à Paris sur la période demandée.
// Source : https://www.service-public.gouv.fr/particuliers/vosdroits/F2405
export const winterHolidays = new Set(['2026-11-01', '2026-11-11', '2026-12-25', '2027-01-01'])

export function winterWorkingDays() {
    const days: string[] = []
    for (
        const date = new Date('2026-11-01T12:00:00Z');
        date < new Date('2027-02-01T00:00:00Z');
        date.setUTCDate(date.getUTCDate() + 1)
    ) {
        const key = date.toISOString().slice(0, 10)
        if (date.getUTCDay() !== 0 && date.getUTCDay() !== 6 && !winterHolidays.has(key)) days.push(key)
    }
    return days
}
