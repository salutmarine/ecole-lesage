import './globals.scss'
import { sessionUser } from '@/lib/auth'
import SiteHeader from '@/components/site-header'

export const metadata = {
    title: 'Planning Ecole Lesage',
    description: 'Gestion des cours et des réservations',
}

export default async function Layout({ children }: { children: React.ReactNode }) {
    const user = await sessionUser()

    return (
        <html lang="fr">
            <body>
                <div className="app_shell app_shell_no_sidebar">
                    <div className="main_area">
                        <SiteHeader firstName={user?.firstName} planningHref={user?.role === 'ADMIN' ? '/admin/planning' : user?.role === 'TEACHER' ? '/teacher' : '/student'} />
                        <main className="wrap">{children}</main>
                    </div>
                </div>
            </body>
        </html>
    )
}
