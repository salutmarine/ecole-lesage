'use client'
import { useEffect, useState } from 'react'
import StudentDashboard from '@/components/student-dashboard'
import AdminDashboard from '@/components/admin-dashboard'
import TeacherDashboard from '@/components/teacher-dashboard'
import Brand from '@/components/brand'
import DemoLogin from '@/components/demo-login'
import { adminSections } from '@/lib/admin-navigation'
import { adminProps, teacherProps, hydrate, displayTeacher } from '@/lib/admin-store'
import { loadState, saveState, remaining, demoStudentId, type State } from '@/lib/store'
import { importShowcasePurchases, SHOWCASE_COMMERCE_KEY } from '@/lib/showcase-purchases'
import { router } from '@/lib/navigation'
export default function Demo() {
    const [state, setState] = useState<State | null>(null)
    const [route, setRoute] = useState('/')
    const [revision] = useState(0)
    const [purchaseTarget, setPurchaseTarget] = useState<{ slotId?: string; entitlementId?: string }>({})
    useEffect(() => {
        function update() {
            setRoute(window.location.hash.slice(1) || '/')
            const next = structuredClone(hydrate(loadState()))
            try {
                const query = new URLSearchParams(window.location.search)
                const target = importShowcasePurchases(
                    next,
                    JSON.parse(localStorage.getItem(SHOWCASE_COMMERCE_KEY) || 'null'),
                    query.get('showcaseOrder'),
                )
                if (target.studentId)
                    setPurchaseTarget({ ...target, slotId: query.get('showcaseSlot') || target.slotId })
                saveState(next)
            } catch {
                /* Keep the existing demo usable when browser storage is unavailable. */
            }
            setState(next)
        }
        update()
        window.addEventListener('hashchange', update)
        window.addEventListener('lesage:refresh', update)
        return () => {
            window.removeEventListener('hashchange', update)
            window.removeEventListener('lesage:refresh', update)
        }
    }, [])
    const isLogin = route === '/' || route === '/login'
    const view = route.startsWith('/student') ? 'student' : route.startsWith('/teacher') ? 'teacher' : 'admin'
    const section = adminSections.find((s) => s.href === route)?.id ?? 'planning'
    const studentId = state ? demoStudentId(state) : ''
    const student = state?.people?.find((person) => person.id === studentId)
    const teacher = state ? teacherProps(state).user : null
    const breadcrumb =
        view === 'admin'
            ? 'Je suis un administrateur'
            : view === 'teacher'
              ? `Je suis le professeur ${teacher?.firstName ?? ''} ${teacher?.lastName.toLocaleUpperCase('fr-FR') ?? ''}`
              : `Je suis l’étudiant ${student?.firstName ?? ''} ${student?.lastName.toLocaleUpperCase('fr-FR') ?? ''}`
    return (
        <div className="app_shell app_shell_no_sidebar">
            <div className="main_area">
                <header className="topbar">
                    <div className="topbar_left">
                        <Brand />
                    </div>
                    <div className="topbar_right">
                        {process.env.NEXT_PUBLIC_SHOWCASE_URL && (
                            <a className="btn secondary" href={process.env.NEXT_PUBLIC_SHOWCASE_URL}>
                                Retour au site
                            </a>
                        )}
                        {!isLogin && (
                            <div className="topbar_right">
                                <span className="breadcrumbs">{breadcrumb}</span>
                                <button className="btn topbar_logout" type="button" onClick={() => router.push('/')}>
                                    Se déconnecter
                                </button>
                            </div>
                        )}
                    </div>
                </header>
                <main className="wrap">
                    {isLogin ? (
                        <DemoLogin />
                    ) : !state ? (
                        <p role="status">Chargement…</p>
                    ) : view === 'student' ? (
                        <StudentDashboard
                            key={`student-${revision}`}
                            initialSlot={state.slots.find((slot) => slot.id === purchaseTarget.slotId)}
                            initialEntitlementId={purchaseTarget.entitlementId}
                            entitlements={remaining(state)
                                .filter((e) => (e.userId ?? studentId) === studentId)
                                .map((e) => ({
                                    ...e,
                                    level: hydrate(state).courses.find((course) => course.id === e.courseId)?.level,
                                }))}
                            bookings={state.bookings
                                .filter(
                                    (b) =>
                                        (state.entitlements.find((e) => e.id === b.entitlementId)?.userId ??
                                            studentId) === studentId,
                                )
                                .map((booking) => ({ ...booking, teacher: displayTeacher(state, booking.teacher) }))}
                        />
                    ) : view === 'teacher' ? (
                        <TeacherDashboard
                            key={`teacher-${route}-${revision}`}
                            {...teacherProps(state, route.includes('view=past'))}
                        />
                    ) : (
                        <AdminDashboard key={`admin-${section}-${revision}`} section={section} {...adminProps(state)} />
                    )}
                </main>
            </div>
        </div>
    )
}
