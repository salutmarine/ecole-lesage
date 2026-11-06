import { redirect } from 'next/navigation'
import { sessionUser } from '@/lib/auth'
import { db } from '@/lib/db'
import TeacherDashboard from './teacher-dashboard'

export default async function Page() {
    const user = await sessionUser()
    if (!user || user.role !== 'TEACHER') redirect('/')
    const courses = await db.course.findMany({
        where: { OR: [{ defaultTeacherId: user.id }, { slots: { some: { teacherId: user.id } } }] },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
    })
    return (
        <TeacherDashboard
            user={{ id: user.id, firstName: user.firstName, lastName: user.lastName }}
            courses={courses}
        />
    )
}
