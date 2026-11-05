import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createSession } from '@/lib/auth'
export async function POST(req: NextRequest) {
    if (process.env.DEMO_AUTH !== 'true') return NextResponse.redirect(new URL('/?error=disabled', req.url), 303)
    const form = await req.formData()
    const roles = { admin: 'ADMIN', prof: 'TEACHER', etudiant: 'STUDENT' } as const
    const login = String(form.get('login') || '')
        .trim()
        .toLowerCase()
    const role = Object.hasOwn(roles, login) ? roles[login as keyof typeof roles] : undefined
    if (!role) return NextResponse.redirect(new URL('/?error=login', req.url), 303)
    const user = await db.user.findFirst({
        where: role === 'TEACHER' ? { role, email: 'camille.moreau@professeurs.example.test' } : { role },
    })
    if (!user) return NextResponse.redirect(new URL('/?error=account', req.url), 303)
    await createSession(user.id)
    return NextResponse.redirect(
        new URL(role === 'ADMIN' ? '/admin' : role === 'TEACHER' ? '/teacher' : '/student', req.url),
        303,
    )
}
