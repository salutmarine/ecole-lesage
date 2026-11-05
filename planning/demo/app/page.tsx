'use client'
import { useEffect, useState } from 'react'
import StudentDashboard from '@/components/student-dashboard'
import { MonthCalendar, dateLabel } from '@/components/month-calendar'
import { loadState, resetState, remaining, saveState, type State } from '@/lib/store'
export default function Demo() {
    const [state, setState] = useState<State | null>(null)
    const [view, setView] = useState('student')
    const [revision, setRevision] = useState(0)
    const [detail, setDetail] = useState('')
    useEffect(() => {
        setState(structuredClone(loadState()))
    }, [])
    function changeView(value: string) {
        setState(structuredClone(loadState()))
        setView(value)
        setDetail('')
        setRevision((n) => n + 1)
    }
    return (
        <div className="app_shell app_shell_no_sidebar">
            <div className="main_area">
                <header className="topbar demo_header">
                    <strong>LESAGE</strong>
                    <span className="breadcrumbs">École de broderie d’art · Démonstration du planning</span>
                </header>
                <div className="demo_banner">
                    <p>
                        <b>Démo autonome et sans connexion.</b> Les réservations sont fictives et enregistrées
                        uniquement dans ce navigateur. Chaque visiteur dispose de ses propres données.
                    </p>
                    <button
                        className="btn secondary"
                        onClick={() => {
                            if (confirm('Effacer vos réservations et réinitialiser cette démo ?')) {
                                setState(resetState())
                                setRevision((n) => n + 1)
                            }
                        }}
                    >
                        Réinitialiser ma démo
                    </button>
                </div>
                <main className="wrap">
                    <nav className="demo_nav" aria-label="Espaces de démonstration">
                        {[
                            ['student', 'Espace étudiant'],
                            ['admin', 'Vue du planning'],
                            ['teacher', 'Espace professeur'],
                        ].map(([id, label]) => (
                            <button
                                key={id}
                                className={`btn btn-medium ${view === id ? '' : 'secondary'}`}
                                aria-pressed={view === id}
                                onClick={() => changeView(id)}
                            >
                                {label}
                            </button>
                        ))}
                    </nav>
                    {!state ? (
                        <p role="status">Chargement de votre démo…</p>
                    ) : view === 'student' ? (
                        <StudentDashboard key={revision} entitlements={remaining(state)} bookings={state.bookings} />
                    ) : view === 'admin' ? (
                        <>
                            <div className="hero_panel">
                                <div>
                                    <div className="section_kicker">Planning de démonstration</div>
                                    <h1>Calendrier des cours</h1>
                                    <p>Les inscriptions affichées sont celles de votre navigateur.</p>
                                </div>
                            </div>
                            {detail && (
                                <p className="card" role="status">
                                    {detail}
                                </p>
                            )}
                            <div className="card">
                                <MonthCalendar
                                    mode="admin"
                                    refresh={revision}
                                    onSelect={(slot) =>
                                        setDetail(
                                            `${slot.course} · ${dateLabel(slot.startsAt)} · ${slot.teacher} · ${slot.reserved} / ${slot.capacity} inscrits`,
                                        )
                                    }
                                />
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="hero_panel">
                                <div>
                                    <div className="section_kicker">Professeur · Démonstration</div>
                                    <h1>Mon agenda</h1>
                                    <p>Consultez les séances et pointez les inscriptions de votre démo.</p>
                                </div>
                            </div>
                            <div className="card demo_list">
                                {state.bookings.filter((b) => b.status === 'BOOKED').length === 0 && (
                                    <p>
                                        Aucune inscription pour le moment. Réservez une séance dans l’espace étudiant
                                        pour tester le pointage.
                                    </p>
                                )}
                                {state.bookings
                                    .filter((b) => b.status === 'BOOKED')
                                    .map((b) => (
                                        <article key={b.id}>
                                            <h2>{b.course}</h2>
                                            <p>
                                                {dateLabel(b.date)} · {b.teacher}
                                            </p>
                                            <label>
                                                Élève de démonstration · Présence{' '}
                                                <select
                                                    value={b.attendance}
                                                    onChange={(e) => {
                                                        const next = structuredClone(state)
                                                        next.bookings.find((item) => item.id === b.id)!.attendance =
                                                            e.target.value
                                                        saveState(next)
                                                        setState(next)
                                                    }}
                                                >
                                                    <option value="UNMARKED">Non renseignée</option>
                                                    <option value="PRESENT">Présent</option>
                                                    <option value="ABSENT">Absent</option>
                                                </select>
                                            </label>
                                        </article>
                                    ))}
                            </div>
                        </>
                    )}
                </main>
            </div>
        </div>
    )
}
