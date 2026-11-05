import { cookies } from 'next/headers'
import { SignJWT, jwtVerify } from 'jose'
import { db } from './db'
const key = () => new TextEncoder().encode(process.env.SESSION_SECRET || 'development-only-secret-not-for-production')
export async function sessionUser() {
    const token = (await cookies()).get('ecole_session')?.value
    if (!token) return null
    try {
        const { payload } = await jwtVerify(token, key())
        return await db.user.findUnique({ where: { id: String(payload.sub) } })
    } catch {
        return null
    }
}
export async function createSession(userId: string) {
    const token = await new SignJWT({})
        .setProtectedHeader({ alg: 'HS256' })
        .setSubject(userId)
        .setIssuedAt()
        .setExpirationTime('7d')
        .sign(key())
    ;(await cookies()).set('ecole_session', token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 604800,
    })
}
export async function requireRole(roles: string[]) {
    const user = await sessionUser()
    if (!user || !roles.includes(user.role)) return null
    return user
}
