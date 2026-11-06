import { redirect } from 'next/navigation'
import { sessionUser } from '@/lib/auth'
import { db } from '@/lib/db'
import StudentDashboard from './student-dashboard'
export default async function Page() {
    const user = await sessionUser()
    if (!user || user.role !== 'STUDENT') redirect('/')
    const [entitlements, bookings] = await Promise.all([
        db.entitlement.findMany({
            where: { userId: user.id },
            include: { course: true, bookings: true },
        }),
        db.booking.findMany({
            where: { userId: user.id },
            include: {
                slot: { include: { course: true, teacher: { select: { firstName: true, lastName: true } } } },
                course: true,
            },
            orderBy: { slot: { startsAt: 'asc' } },
        }),
    ])
    return (
        <StudentDashboard
            entitlements={entitlements.map((e) => ({
                id: e.id,
                courseId: e.courseId,
                course: e.course.name,
                total: e.totalSessions,
                bookingDelayHours: e.course.bookingDelayHours,
                remaining: e.totalSessions - e.bookings.filter((b) => b.status !== 'CANCELLED').length,
                expiresAt: e.expiresAt.toISOString(),
                purchaseDate: e.purchaseDate.toISOString(),
                status: e.status,
            }))}
            bookings={bookings.map((b) => ({
                id: b.id,
                slotId: b.slotId,
                entitlementId: b.entitlementId,
                endsAt: b.slot.endsAt.toISOString(),
                teacher: b.slot.teacher
                    ? `${b.slot.teacher.firstName} ${b.slot.teacher.lastName.toLocaleUpperCase('fr-FR')}`
                    : null,
                course: b.course.name,
                date: b.slot.startsAt.toISOString(),
                status: b.status,
                cancellationHours: b.slot.course?.cancellationHours ?? 48,
            }))}
        />
    )
}
