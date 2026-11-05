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
            <h1>Planifiez vos cours à l'école Lesage</h1>
            <form className="login_form" action="/api/auth/demo" method="post">
                <h2 className="login_group_title">Identifiants de connexion</h2>
                <div className="login_field_group">
                    <div className={`login_field${error === 'login' ? ' is_invalid' : ''}`}>
                        <input
                            id="demo-login"
                            name="login"
                            type="text"
                            placeholder=" "
                            autoComplete="off"
                            autoCapitalize="none"
                            spellCheck={false}
                            required
                            aria-invalid={error === 'login' || undefined}
                            aria-describedby="login-hint"
                        />
                        <label htmlFor="demo-login">
                            Login <span aria-hidden="true">*</span>
                        </label>
                    </div>
                    <div className="login_field">
                        <input
                            id="demo-password"
                            name="password"
                            type="password"
                            placeholder=" "
                            defaultValue="lesage-demo"
                            autoComplete="off"
                            required
                            aria-describedby="login-hint"
                        />
                        <label htmlFor="demo-password">
                            Mot de passe <span aria-hidden="true">*</span>
                        </label>
                    </div>
                </div>
                <p className="login_hint" id="login-hint">
                    Login : admin, prof ou etudiant. Le mot de passe est fictif.
                </p>
                {error && errors[error] && <Toast message={errors[error]} />}
                <button className="btn btn-large" type="submit">
                    Se connecter
                </button>
            </form>
        </div>
    )
}
