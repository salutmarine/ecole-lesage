import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
export async function POST(req: NextRequest) {
    ;(await cookies()).delete('ecole_session')
    return NextResponse.redirect(new URL('/', req.url), 303)
}
