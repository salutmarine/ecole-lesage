import nodemailer from 'nodemailer'
import { db } from './db'
import { isReminderDue } from './reminder-schedule'

export async function sendReminders() {
    const { SMTP_HOST, SMTP_USER, SMTP_PASSWORD, MAIL_FROM } = process.env
    if (!SMTP_HOST || !MAIL_FROM) throw Error('Configurez SMTP_HOST et MAIL_FROM pour envoyer les rappels.')
    const port = Number(process.env.SMTP_PORT || 587)
    const transport = nodemailer.createTransport({
        host: SMTP_HOST,
        port,
        secure: port === 465,
        auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASSWORD } : undefined,
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 10000,
        disableFileAccess: true,
        disableUrlAccess: true,
    })
    const now = new Date()
    const candidates = await db.booking.findMany({
        where: {
            status: 'BOOKED',
            slot: { startsAt: { gt: now }, blocked: false, course: { reminderDays: { not: null } } },
        },
        include: { slot: { include: { course: true } } },
    })
    let sent = 0,
        failed = 0
    for (const candidate of candidates) {
        if (
            !isReminderDue(
                candidate.slot.startsAt,
                candidate.slot.course?.reminderDays ?? null,
                candidate.reminderSentFor,
                now,
            )
        )
            continue
        try {
            const delivered = await db.$transaction(
                async (tx) => {
                    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`reminder:${candidate.id}`}))`
                    const booking = await tx.booking.findUnique({
                        where: { id: candidate.id },
                        include: { user: true, slot: { include: { course: true, teacher: true } } },
                    })
                    if (
                        !booking ||
                        booking.status !== 'BOOKED' ||
                        booking.slot.blocked ||
                        !isReminderDue(
                            booking.slot.startsAt,
                            booking.slot.course?.reminderDays ?? null,
                            booking.reminderSentFor,
                        )
                    )
                        return false
                    const date = booking.slot.startsAt.toLocaleString('fr-FR', {
                        timeZone: 'Europe/Paris',
                        dateStyle: 'full',
                        timeStyle: 'short',
                    })
                    const title = (booking.slot.course?.name || 'Votre cours').toLocaleUpperCase('fr-FR')
                    const info = await transport.sendMail({
                        from: MAIL_FROM,
                        to: {
                            name: `${booking.user.firstName} ${booking.user.lastName.toLocaleUpperCase('fr-FR')}`,
                            address: booking.user.email,
                        },
                        subject: `Rappel de votre séance : ${title}`,
                        text: `Bonjour ${booking.user.firstName},\n\nVotre séance « ${title} » aura lieu le ${date} (heure de Paris).\n${booking.slot.teacher ? `Professeur : ${booking.slot.teacher.firstName} ${booking.slot.teacher.lastName.toLocaleUpperCase('fr-FR')}.\n` : ''}\nÀ bientôt,\nL’École Lesage`,
                    })
                    if (!info.accepted?.length) throw Error('Email refusé par le serveur SMTP.')
                    await tx.booking.update({
                        where: { id: booking.id },
                        data: { reminderSentFor: booking.slot.startsAt },
                    })
                    return true
                },
                { timeout: 30000 },
            )
            if (delivered) sent++
        } catch {
            // A failed delivery remains eligible for the next scheduled execution.
            failed++
        }
    }
    return { sent, failed }
}
