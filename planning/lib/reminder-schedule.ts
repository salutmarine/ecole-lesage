function parisDay(date: Date) {
    const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Europe/Paris',
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
    }).formatToParts(date)
    const value = (type: string) => Number(parts.find((part) => part.type === type)?.value)
    return Date.UTC(value('year'), value('month') - 1, value('day')) / 86400000
}

export function isReminderDue(startsAt: Date, reminderDays: number | null, sentFor: Date | null, now = new Date()) {
    return (
        reminderDays !== null &&
        startsAt > now &&
        sentFor?.getTime() !== startsAt.getTime() &&
        parisDay(startsAt) - parisDay(now) === reminderDays
    )
}
