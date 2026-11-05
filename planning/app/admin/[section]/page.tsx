import { notFound } from 'next/navigation'
import { adminSections } from '@/lib/admin-navigation'
import AdminPage from '../admin-page'

export default async function Page({ params }: { params: Promise<{ section: string }> }) {
    const { section: slug } = await params
    const section = adminSections.find((item) => item.slug === slug)
    if (!section) notFound()
    return <AdminPage section={section.id} />
}
