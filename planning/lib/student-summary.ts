export function isActiveStudent(
    entitlements: { status: string; remaining: number; expiresAt: string; purchaseDate: string }[],
    now = new Date(),
) {
    return entitlements.some(
        (entitlement) =>
            entitlement.status === 'ACTIVE' &&
            entitlement.remaining > 0 &&
            new Date(entitlement.purchaseDate) <= now &&
            new Date(entitlement.expiresAt) > now,
    )
}
export function compareRecentBookings(
    a: { lastBookingAt: string | null; lastName: string },
    b: { lastBookingAt: string | null; lastName: string },
) {
    return (
        (b.lastBookingAt ? Date.parse(b.lastBookingAt) : 0) - (a.lastBookingAt ? Date.parse(a.lastBookingAt) : 0) ||
        a.lastName.localeCompare(b.lastName, 'fr')
    )
}
