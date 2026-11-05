import './globals.scss'
export const metadata = {
    title: 'École Lesage — Démo du planning',
    description:
        'Démonstration autonome du planning de cours. Réservations fictives conservées uniquement dans votre navigateur.',
}
export default function Layout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="fr">
            <body>{children}</body>
        </html>
    )
}
