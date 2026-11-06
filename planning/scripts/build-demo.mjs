import { mkdir, cp, writeFile, readFile, rm, symlink } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
const root = fileURLToPath(new URL('../', import.meta.url))
const target = path.join(root, '.pages-build')
await rm(target, { recursive: true, force: true })
await mkdir(target, { recursive: true })
await cp(path.join(root, 'demo'), target, { recursive: true })
await cp(path.join(root, 'app/icon.svg'), path.join(target, 'app/icon.svg'))
await writeFile(
    path.join(target, 'lib/store.ts'),
    (await readFile(path.join(target, 'lib/store.ts'), 'utf8')).replace(
        '../../data/lesage/catalogue.json',
        '@/data/catalogue.json',
    ),
)
await rm(path.join(target, 'lib/store.test.ts'), { force: true })
await symlink(path.join(root, 'node_modules'), path.join(target, 'node_modules'))
await mkdir(path.join(target, 'components'), { recursive: true })
await mkdir(path.join(target, 'data'), { recursive: true })
await cp(path.join(root, 'data/lesage/catalogue.json'), path.join(target, 'data/catalogue.json'))
for (const name of ['month-calendar', 'booking-actions', 'side-panel', 'toast']) {
    let source = await readFile(path.join(root, `components/${name}.tsx`), 'utf8')
    if (source.includes('fetch('))
        source = source.replace("'use client'", "'use client'\nimport { demoFetch as fetch } from '@/lib/store'")
    await writeFile(path.join(target, `components/${name}.tsx`), source)
}
let dashboard = await readFile(path.join(root, 'app/student/student-dashboard.tsx'), 'utf8')
dashboard = dashboard.replace("'use client'", "'use client'\nimport { demoFetch as fetch } from '@/lib/store'")
await writeFile(path.join(target, 'components/student-dashboard.tsx'), dashboard)
for (const name of ['course-levels', 'student-availability'])
    await cp(path.join(root, `lib/${name}.ts`), path.join(target, `lib/${name}.ts`))
const basePath = process.env.PAGES_BASE_PATH ?? '/ecole-lesage'
await mkdir(path.join(target, 'public/fonts'), { recursive: true })
await cp(
    path.join(root, 'assets/fonts/NotoSansJP-Regular.otf'),
    path.join(target, 'public/fonts/NotoSansJP-Regular.otf'),
)
const stylesheet = await readFile(path.join(root, 'app/globals.scss'), 'utf8')
await writeFile(path.join(target, 'app/globals.scss'), stylesheet)
for (const name of ['admin-dashboard', 'admin-forms', 'student-credits', 'student-booking', 'agenda-export']) {
    let source = await readFile(path.join(root, `app/admin/${name}.tsx`), 'utf8')
    source = source
        .replace("'use client'", "'use client'\nimport { demoFetch as fetch } from '@/lib/store'")
        .replaceAll("'next/navigation'", "'@/lib/navigation'")
        .replaceAll("'next/link'", "'@/lib/navigation'")
    await writeFile(path.join(target, `components/${name}.tsx`), source)
}
let attendance = await readFile(path.join(root, 'app/teacher/attendance-control.tsx'), 'utf8')
await writeFile(
    path.join(target, 'components/attendance-control.tsx'),
    attendance.replace("'use client'", "'use client'\nimport { demoFetch as fetch } from '@/lib/store'"),
)
await cp(path.join(root, 'app/teacher/teacher-dashboard.tsx'), path.join(target, 'components/teacher-dashboard.tsx'))
let login = await readFile(path.join(root, 'app/page.tsx'), 'utf8')
login =
    "'use client'\nimport { useState, type FormEvent } from 'react'\nimport { router } from '@/lib/navigation'\n" +
    login
        .replace(
            /export default async function Login[\s\S]*?    const errors/,
            `export default function Login() {
    const [error, setError] = useState('')
    function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        const form = new FormData(event.currentTarget)
        const name = String(form.get('login') ?? '').trim().toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '')
        const destinations: Record<string, string> = { admin: '/admin/planning', prof: '/teacher', etudiant: '/student' }
        if (!destinations[name]) { setError('login'); return }
        setError('')
        router.push(destinations[name])
    }
    const errors`,
        )
        .replace('action="/api/auth/demo" method="post"', 'onSubmit={submit}')
await writeFile(path.join(target, 'components/demo-login.tsx'), login)
const layout = await readFile(path.join(root, 'app/layout.tsx'), 'utf8')
const brand = layout.slice(layout.indexOf('<Link href="/"'), layout.indexOf('</Link>') + '</Link>'.length)
await writeFile(
    path.join(target, 'components/brand.tsx'),
    "import Link from '@/lib/navigation'\nexport default function Brand(){ return (" + brand + ')}\n',
)
for (const name of ['admin-navigation', 'student-summary', 'agenda-period'])
    await cp(path.join(root, `lib/${name}.ts`), path.join(target, `lib/${name}.ts`))
let pdf = await readFile(path.join(root, 'lib/agenda-pdf.ts'), 'utf8')
pdf = pdf
    .replace("import { readFile } from 'node:fs/promises'", '')
    .replace("import { join } from 'node:path'", '')
    .replace(
        "await readFile(join(process.cwd(), 'assets/fonts/NotoSansJP-Regular.otf'))",
        `await (await fetch('${basePath}/fonts/NotoSansJP-Regular.otf')).arrayBuffer()`,
    )
await writeFile(path.join(target, 'lib/agenda-pdf.ts'), pdf)
await writeFile(
    path.join(target, 'package.json'),
    JSON.stringify({
        private: true,
        dependencies: JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8')).dependencies,
    }),
)
await writeFile(
    path.join(target, 'tsconfig.json'),
    JSON.stringify({
        compilerOptions: {
            target: 'ES2017',
            lib: ['dom', 'dom.iterable', 'esnext'],
            strict: true,
            skipLibCheck: true,
            esModuleInterop: true,
            module: 'esnext',
            moduleResolution: 'bundler',
            resolveJsonModule: true,
            isolatedModules: true,
            jsx: 'preserve',
            plugins: [{ name: 'next' }],
            paths: { '@/*': ['./*'] },
        },
        include: ['**/*.ts', '**/*.tsx', '.next/types/**/*.ts'],
        exclude: ['node_modules'],
    }),
)
await writeFile(
    path.join(target, 'next.config.mjs'),
    `export default { output: 'export', basePath: ${JSON.stringify(process.env.PAGES_BASE_PATH ?? '/ecole-lesage')}, trailingSlash: true, images: { unoptimized: true } }`,
)
const result = spawnSync(process.execPath, [path.join(root, 'node_modules/next/dist/bin/next'), 'build'], {
    cwd: target,
    stdio: 'inherit',
})
if (result.status !== 0) process.exit(result.status ?? 1)
await writeFile(path.join(target, 'out/.nojekyll'), '')
console.log(`Démo statique : ${target}/out`)
