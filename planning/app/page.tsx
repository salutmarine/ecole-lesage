import Toast from '@/components/toast'

export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
    const { error } = await searchParams
    const errors: Record<string, string> = {
        login: 'Login inconnu. Utilisez admin, prof ou etudiant.',
        account: 'Aucun compte de démonstration disponible pour cet espace.',
        disabled: 'La connexion de démonstration est désactivée.',
    }
    return (
        <div className="login_wrap">
            <header className="login_heading"><p className="section_kicker">Connexion</p><h1>Planifiez vos cours</h1></header>
            <form className="login_form local-contact-form" action="/api/auth/demo" method="post">
                <div className="local-field">
                    <label htmlFor="demo-login">Login : admin, prof ou etudiant. <span aria-hidden="true">*</span></label>
                    <input
                        className="form-control"
                        id="demo-login"
                        name="login"
                        type="text"
                        autoComplete="off"
                        autoCapitalize="none"
                        spellCheck={false}
                        required
                        aria-invalid={error === 'login' || undefined}
                    />
                </div>
                <div className="local-field">
                    <label htmlFor="demo-password">Mot de passe <span aria-hidden="true">*</span></label>
                    <input
                        className="form-control"
                        id="demo-password"
                        name="password"
                        type="password"
                        defaultValue="lesage-demo"
                        autoComplete="off"
                        required
                    />
                </div>
                {error && errors[error] && <Toast message={errors[error]} />}
                <div className="local-form-actions">
                    <button className="btn btn-medium" type="submit">Se connecter</button>
                </div>
            </form>
        </div>
    )
}
