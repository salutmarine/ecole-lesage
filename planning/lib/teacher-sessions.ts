import type { CourseLevel } from './course-levels'

export type TeacherStudent = {
    bookingId: string
    name: string
    sessionNumber: number
    totalSessions: number
    courseId: string
    course: string
    level: CourseLevel
    teacherId: string | null
    teacher: string | null
    attendance: 'UNMARKED' | 'PRESENT' | 'ABSENT'
    status: string
}
export type TeacherSession = {
    id: string
    startsAt: string
    endsAt: string
    capacity: number
    blocked: boolean
    students: TeacherStudent[]
}
