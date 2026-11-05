import { Prisma, PrismaClient } from '@prisma/client'
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient; prismaSchema?: string }
const schema = JSON.stringify(Prisma.dmmf.datamodel)
// Hot reload must not reuse a client generated for an older database schema.
const cached = globalForPrisma.prisma
if (cached && globalForPrisma.prismaSchema !== schema) void cached.$disconnect()
export const db = cached && globalForPrisma.prismaSchema === schema ? cached : new PrismaClient()
if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = db
    globalForPrisma.prismaSchema = schema
}
