import { Prisma, PrismaClient } from '@prisma/client'

const prismaClientSingleton = () => {
  return new PrismaClient()
}

declare global {
  var prisma: undefined | ReturnType<typeof prismaClientSingleton>
}

export const prisma = globalThis.prisma ?? prismaClientSingleton()

if (process.env.NODE_ENV !== 'production') globalThis.prisma = prisma

let devConnectionCheckPromise: Promise<void> | null = null

function createDevPrismaConnectionError(error: unknown): Error {
  const hint =
    "Prisma development connection failed. Start Postgres (for example: `docker compose up -d postgres`) or update DATABASE_URL."

  if (error instanceof Prisma.PrismaClientInitializationError) {
    return new Error(`${hint} ${error.message}`, { cause: error })
  }

  if (error instanceof Error) {
    return new Error(`${hint} ${error.message}`, { cause: error })
  }

  return new Error(hint)
}

export async function ensurePrismaConnectionInDev(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    return
  }

  if (!devConnectionCheckPromise) {
    devConnectionCheckPromise = prisma.$connect().catch((error: unknown) => {
      devConnectionCheckPromise = null
      throw createDevPrismaConnectionError(error)
    })
  }

  await devConnectionCheckPromise
}

type PrismaRuntimeModelField = { name: string }
type PrismaRuntimeModel = { fields?: PrismaRuntimeModelField[] }
type PrismaRuntimeDataModel = { models?: Record<string, PrismaRuntimeModel> }

const runtimeFieldSupportCache = new Map<string, boolean>()

export function prismaModelHasField(modelName: string, fieldName: string): boolean {
  const cacheKey = `${modelName}.${fieldName}`
  if (runtimeFieldSupportCache.has(cacheKey)) {
    return runtimeFieldSupportCache.get(cacheKey) ?? false
  }

  const runtimeDataModel = (prisma as PrismaClient & { _runtimeDataModel?: PrismaRuntimeDataModel })
    ._runtimeDataModel
  const supportsField =
    runtimeDataModel?.models?.[modelName]?.fields?.some((field) => field.name === fieldName) ??
    false

  runtimeFieldSupportCache.set(cacheKey, supportsField)
  return supportsField
}
