import { PDFDocument, rgb, type PDFPage, type PDFFont } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { courseLevels, type CourseLevel } from './course-levels'
import { parisDate } from './agenda-period'

export type AgendaSession = {
    id: string
    startsAt: Date
    endsAt: Date
    course: string
    level: CourseLevel | null
    teacher: string | null
    capacity: number
    blocked: boolean
    students: { firstName: string; lastName: string; email: string; phone: string | null; language: string }[]
}
const ink = rgb(0.09, 0.09, 0.09),
    muted = rgb(0.37, 0.37, 0.37),
    line = rgb(0.85, 0.85, 0.85)
const labelDate = (value: string) =>
    new Date(`${value}T12:00:00Z`).toLocaleDateString('fr-FR', { dateStyle: 'full', timeZone: 'Europe/Paris' })
const time = (date: Date) =>
    date.toLocaleTimeString('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit' })
function wrap(text: string, font: PDFFont, size: number, width: number) {
    const lines: string[] = []
    let current = ''
    for (const word of text.replace(/[\r\n\t]/g, ' ').split(/\s+/)) {
        if (!word) continue
        const candidate = current ? `${current} ${word}` : word
        if (font.widthOfTextAtSize(candidate, size) <= width) {
            current = candidate
            continue
        }
        if (current) lines.push(current)
        current = ''
        for (const character of word) {
            if (current && font.widthOfTextAtSize(current + character, size) > width) {
                lines.push(current)
                current = ''
            }
            current += character
        }
    }
    if (current) lines.push(current)
    return lines.length ? lines : ['—']
}
export async function createAgendaPdf(
    sessions: AgendaSession[],
    period: { firstDay: string; lastDay: string },
    mode: 'day' | 'week',
) {
    const document = await PDFDocument.create()
    document.registerFontkit(fontkit)
    const font = await document.embedFont(await readFile(join(process.cwd(), 'assets/fonts/NotoSansJP-Regular.otf')), {
        // Subsetting this CFF font corrupts glyph mappings in PDF readers.
        subset: false,
    })
    const title = mode === 'week' ? 'Agenda de la semaine' : 'Agenda de la journée'
    const periodLabel =
        mode === 'week'
            ? `Du ${labelDate(period.firstDay)} au ${labelDate(period.lastDay)}`
            : labelDate(period.firstDay)
    document.setTitle(`${title} — École Lesage`)
    document.setAuthor('École Lesage')
    document.setSubject(periodLabel)
    const width = 595.28,
        height = 841.89,
        margin = 36,
        contentWidth = width - 2 * margin
    let page!: PDFPage,
        y = 0
    function addPage() {
        page = document.addPage([width, height])
        page.drawRectangle({ x: 0, y: 0, width, height, color: rgb(1, 1, 1) })
        page.drawText('ÉCOLE LESAGE', { x: margin, y: height - 42, font, size: 10, color: muted })
        page.drawText(title, { x: margin, y: height - 65, font, size: 19, color: ink })
        let subtitleY = height - 85
        for (const text of wrap(periodLabel, font, 10, contentWidth)) {
            page.drawText(text, { x: margin, y: subtitleY, font, size: 10, color: muted })
            subtitleY -= 14
        }
        y = subtitleY - 16
    }
    function ensure(space: number) {
        if (y - space < 48) addPage()
    }
    function text(value: string, size = 10, color = ink) {
        for (const row of wrap(value, font, size, contentWidth)) {
            ensure(size + 7)
            page.drawText(row, { x: margin, y, size, font, color })
            y -= size + 5
        }
    }
    addPage()
    const registrations = sessions.reduce((sum, session) => sum + session.students.length, 0)
    text(
        `${sessions.length} séance${sessions.length > 1 ? 's' : ''} · ${registrations} inscription${registrations > 1 ? 's' : ''} · Horaires de Paris`,
        10,
        muted,
    )
    y -= 10
    if (!sessions.length) text('Aucune séance planifiée sur cette période.')
    let lastDay = ''
    const columns = [165, 42, 190, contentWidth - 397]
    function tableHeader() {
        ensure(30)
        let x = margin
        for (const [index, title] of ['Élève', 'Langue', 'Email', 'Téléphone'].entries()) {
            page.drawText(title, { x: x + 4, y: y - 13, font, size: 9, color: muted })
            x += columns[index]
        }
        y -= 22
        page.drawLine({
            start: { x: margin, y: y + 4 },
            end: { x: width - margin, y: y + 4 },
            color: line,
            thickness: 0.5,
        })
    }
    for (const session of sessions) {
        const day = parisDate(session.startsAt)
        ensure(125)
        if (lastDay !== day) {
            text(labelDate(day), 13)
            y -= 7
            lastDay = day
        }
        text(`${time(session.startsAt)} – ${time(session.endsAt)} · ${session.course.toLocaleUpperCase('fr-FR')}`, 12)
        text(
            `${session.level ? `${courseLevels[session.level]} · ` : ''}Professeur : ${session.teacher || 'Non attribué'}`,
            9,
            muted,
        )
        text(
            `${session.students.length} / ${session.capacity} inscrit${session.students.length > 1 ? 's' : ''}${session.blocked ? ' · Créneau bloqué' : ''}`,
            9,
            muted,
        )
        if (!session.students.length) {
            text('Aucun élève inscrit.', 9, muted)
            y -= 15
            continue
        }
        tableHeader()
        for (const student of session.students) {
            const cells = [
                `${student.lastName.toLocaleUpperCase('fr-FR')} ${student.firstName}`,
                student.language,
                student.email,
                student.phone || '—',
            ].map((value, index) => wrap(value, font, 9, columns[index] - 8))
            const rowHeight = Math.max(...cells.map((cell) => cell.length)) * 13 + 12
            if (y - rowHeight < 48) {
                addPage()
                text(`${session.course.toLocaleUpperCase('fr-FR')} (suite)`, 11)
                tableHeader()
            }
            let x = margin
            cells.forEach((rows, index) => {
                rows.forEach((row, number) =>
                    page.drawText(row, { x: x + 4, y: y - 13 - number * 13, font, size: 9, color: ink }),
                )
                x += columns[index]
            })
            y -= rowHeight
            page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, color: line, thickness: 0.4 })
        }
        y -= 22
    }
    const pages = document.getPages()
    const generated = new Date().toLocaleString('fr-FR', {
        timeZone: 'Europe/Paris',
        dateStyle: 'short',
        timeStyle: 'short',
    })
    pages.forEach((page, index) =>
        page.drawText(`Export du ${generated} · Heure de Paris · Page ${index + 1} / ${pages.length}`, {
            x: margin,
            y: 24,
            font,
            size: 8,
            color: muted,
        }),
    )
    return document.save()
}
