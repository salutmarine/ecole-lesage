import { mkdir, cp, writeFile, readFile, rm, symlink } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
const root = fileURLToPath(new URL('../', import.meta.url))
const target = path.join(root, '.pages-build')
await rm(target, { recursive: true, force: true })
await mkdir(target, { recursive: true })
await cp(path.join(root, 'demo'), target, { recursive: true })
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
await writeFile(
    path.join(target, 'app/globals.scss'),
    (await readFile(path.join(root, 'app/globals.scss'), 'utf8'))
        .replace(/@font-face\s*\{[^}]*\}/g, '')
        .replaceAll("'abchanel-2022', sans-serif", 'Arial, sans-serif'),
)
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
