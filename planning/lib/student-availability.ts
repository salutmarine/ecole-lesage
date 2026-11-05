type Entitlement = {
    courseId: string
    status: string
    remaining: number
    bookingDelayHours?: number
    purchaseDate: string
    expiresAt: string
}
type Slot = { courseId: string | null; startsAt: string }

export function availableEntitlement<T extends Entitlement>(entitlements: T[], slot: Slot): T | undefined {
    const start = new Date(slot.startsAt).getTime()
    return entitlements
        .filter(
            (entitlement) =>
                entitlement.courseId === slot.courseId &&
                entitlement.status === 'ACTIVE' &&
                entitlement.remaining > 0 &&
                new Date(entitlement.purchaseDate).getTime() + (entitlement.bookingDelayHours ?? 72) * 3600000 <=
                    start &&
                new Date(entitlement.expiresAt).getTime() > start,
        )
        .sort((a, b) => new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime())[0]
}
