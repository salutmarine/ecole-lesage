'use client'
import { useEffect, useState } from 'react'
import '../../showcase/assets/platform/planning-header.css'
export default function SiteHeader({ firstName, onLogout, planningHref = "/" }: { firstName?: string; onLogout?: () => void; planningHref?: string }) {
    const base = process.env.NEXT_PUBLIC_SHOWCASE_URL || '/ecole-lesage/showcase/'
    const [count, setCount] = useState(0)
    const [open, setOpen] = useState(false)
    useEffect(() => {
        function update() {
            try {
                const data = JSON.parse(localStorage.getItem('lesage.showcase.commerce.v1') || '{}')
                setCount((data.cart || []).reduce((sum: number, item: {qty: number}) => sum + Number(item.qty || 0), 0))
            } catch { setCount(0) }
        }
        update()
        window.addEventListener('storage', update)
        window.addEventListener('pageshow', update)
        return () => { window.removeEventListener('storage', update); window.removeEventListener('pageshow', update) }
    }, [])
    return <header className="lesage-header">
        <div className="header-top">
            <button type="button" className="planning-menu-toggle" aria-label="Ouvrir le menu" aria-expanded={open} aria-controls="planning-site-navigation" onClick={() => setOpen(!open)}>☰</button>
            <a className="lesage-wordmark" href={base} aria-label="École Lesage — accueil"><img src={`${base}assets/images/brand/logo-lesage.svg`} alt=""/><span>École Lesage</span></a>
            <div className="header-actions">
                {firstName ? <div className="header-session">
                    <a className="header-greeting" href={planningHref}>Bonjour {firstName} !</a>
                    {onLogout ? <button type="button" className="btn site-session-logout" onClick={onLogout}>Déconnecter</button>
                        : <form action="/api/auth/logout" method="post"><button type="submit" className="btn site-session-logout">Déconnecter</button></form>}
                </div> : <a href={process.env.NEXT_PUBLIC_SHOWCASE_URL ? "#/" : "/"} className="account-link"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="7" r="4"/><path d="M4 22v-3a8 8 0 0116 0v3"/></svg><span>Mon compte &amp; mes réservations</span></a>}
                <a href={`${base}panier/`} className="bag-link" aria-label={`Panier (${count})`}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14l1.5 15h-17L5 7z"/><path d="M8 8V5a4 4 0 018 0v3"/><text x="12" y="17" textAnchor="middle">{count}</text></svg><span>Panier</span></a>
            </div>
        </div>
        <nav id="planning-site-navigation" className={`main-navigation${open ? ' is-open' : ''}`} aria-label="Navigation principale">
            <a href={`${base}lecole/histoire/`}>L’école</a><a href={`${base}boutique/`}>Les cours</a><a href={`${base}seminaires/`}>Les séminaires</a><a href={`${base}contact/`}>Contact</a>
        </nav>
    </header>
}
