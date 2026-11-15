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
                entitlement.status === 'ACTIVE' &&
                entitlement.remaining > 0 &&
                new Date(entitlement.purchaseDate).getTime() + (entitlement.bookingDelayHours ?? 72) * 3600000 <=
                    start &&
                new Date(entitlement.expiresAt).getTime() > start,
        )
        .sort((a, b) => new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime())[0]
}

export function reservationUnavailableReason(
    entitlements: Entitlement[],
    slot: Slot & { blocked: boolean; capacity: number; reserved: number },
): string | undefined {
    const start = new Date(slot.startsAt).getTime()
    if (slot.blocked) return 'Ce créneau est bloqué et ne peut pas être réservé.'
    if (start <= Date.now()) return 'Ce créneau est passé ou a déjà commencé.'
    if (slot.reserved >= slot.capacity) return 'Ce créneau est complet.'
    if (entitlements.length === 0) return 'Vous devez disposer d’un cours acheté pour réserver une séance.'
    const active = entitlements.filter((entitlement) => entitlement.status === 'ACTIVE')
    if (active.length === 0) return 'Vos droits de réservation sont suspendus.'
    const valid = active.filter((entitlement) => new Date(entitlement.expiresAt).getTime() > start)
    if (valid.length === 0) return 'Aucun de vos cours n’est encore valide à la date de cette séance.'
    const credited = valid.filter((entitlement) => entitlement.remaining > 0)
    if (credited.length === 0) return 'Vous n’avez plus de séances disponibles sur vos cours valides.'
    if (availableEntitlement(credited, slot)) return undefined
    const purchased = credited.filter((entitlement) => new Date(entitlement.purchaseDate).getTime() <= start)
    if (purchased.length === 0) return 'Ce créneau est antérieur à l’achat de vos cours.'
    const hours = Math.min(...purchased.map((entitlement) => entitlement.bookingDelayHours ?? 72))
    return `Réservation impossible : le délai de ${hours} h après l’achat n’est pas encore respecté pour cette séance.`
}
