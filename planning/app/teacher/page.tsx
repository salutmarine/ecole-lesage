import { redirect } from 'next/navigation'
import { sessionUser } from '@/lib/auth'
import TeacherDashboard from './teacher-dashboard'

export default async function Page() {
    const user = await sessionUser()
    if (!user || user.role !== 'TEACHER') redirect('/')
    return <TeacherDashboard user={{ id: user.id, firstName: user.firstName, lastName: user.lastName }} />
}
