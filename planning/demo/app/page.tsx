'use client'
import { useEffect, useState } from 'react'
import StudentDashboard from '@/components/student-dashboard'
import AdminDashboard from '@/components/admin-dashboard'
import TeacherDashboard from '@/components/teacher-dashboard'
import Brand from '@/components/brand'
import DemoLogin from '@/components/demo-login'
import { adminSections } from '@/lib/admin-navigation'
import { adminProps, teacherProps, hydrate } from '@/lib/admin-store'
import { loadState, resetState, remaining, type State } from '@/lib/store'
import { router } from '@/lib/navigation'
export default function Demo() {
    const [state, setState] = useState<State | null>(null)
    const [route, setRoute] = useState('/')
    const [revision, setRevision] = useState(0)
    useEffect(() => {
        function update() {
            setRoute(window.location.hash.slice(1) || '/')
            setState(structuredClone(hydrate(loadState())))
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
    const breadcrumb =
        view === 'admin'
            ? 'Je suis un administrateur'
            : view === 'teacher'
              ? 'Je suis le professeur Louise Bernard'
              : 'Je suis l’étudiant Élève Démo'
    return (
        <div className="app_shell app_shell_no_sidebar">
            <div className="main_area">
                <header className="topbar">
                    <div className="topbar_left">
                        <Brand />
                    </div>
                    {!isLogin && (
                        <div className="topbar_right">
                            <span className="breadcrumbs">{breadcrumb}</span>
                            <button className="btn topbar_logout" type="button" onClick={() => router.push('/')}>
                                Se déconnecter
                            </button>
                        </div>
                    )}
                </header>
                <main className="wrap">
                    {isLogin ? (
                        <DemoLogin />
                    ) : !state ? (
                        <p role="status">Chargement…</p>
                    ) : view === 'student' ? (
                        <StudentDashboard
                            key={`student-${revision}`}
                            entitlements={remaining(state).filter(
                                (e) => (e.userId ?? 'student-demo') === 'student-demo',
                            )}
                            bookings={state.bookings.filter(
                                (b) =>
                                    (state.entitlements.find((e) => e.id === b.entitlementId)?.userId ??
                                        'student-demo') === 'student-demo',
                            )}
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
                {!isLogin && (
                    <footer className="wrap">
                        <details>
                            <summary className="muted">Démo autonome · Données propres à ce navigateur</summary>
                            <p className="muted">
                                Les réservations sont fictives et ne sont pas partagées entre visiteurs.
                            </p>
                            <button
                                className="btn secondary"
                                onClick={() => {
                                    if (confirm('Effacer vos réservations et réinitialiser cette démo ?')) {
                                        setState(hydrate(resetState()))
                                        setRevision((n) => n + 1)
                                    }
                                }}
                            >
                                Réinitialiser ma démo
                            </button>
                        </details>
                    </footer>
                )}
            </div>
        </div>
    )
}
