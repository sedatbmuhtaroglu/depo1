import { PrismaClient, Prisma } from '@prisma/client'
import { getTenantContext } from './context'

const TENANT_SCOPED_MODELS = ['Category', 'Product', 'Table', 'Order'] as const
type TenantScopedModel = (typeof TENANT_SCOPED_MODELS)[number]

const READ_OPERATIONS = ['findMany', 'findFirst', 'findFirstOrThrow', 'findUnique', 'findUniqueOrThrow', 'count', 'aggregate', 'groupBy'] as const

function getTenantFieldForModel(model: string): string | null {
  switch (model) {
    case 'Category':
    case 'Table':
      return 'restaurantId'
    case 'Product':
      return 'categoryId' // Product tenant is via category
    case 'Order':
      return 'tableId' // Order tenant is via table
    default:
      return null
  }
}

/** Query zaten where ile tenant filtresi içeriyorsa context gerekmez */
function hasExplicitTenantFilter(model: string, args: Record<string, unknown>): boolean {
  const where = args?.where as Record<string, unknown> | undefined
  if (!where) return false
  const field = getTenantFieldForModel(model)
  if (!field) return false
  return field in where && where[field] != null
}

export class TenantResolutionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TenantResolutionError'
  }
}

function createTenancyExtension(guardMode: 'strict' | 'permissive' = 'strict') {
  return Prisma.defineExtension((client) => {
    return client.$extends({
      name: 'tenancy',
      query: {
        $allModels: {
          async $allOperations({ model, operation, args, query }) {
            if (!model || !TENANT_SCOPED_MODELS.includes(model as TenantScopedModel)) {
              return query(args)
            }

            const context = getTenantContext()

            // Read işlemlerinde: query kendi tenant filtresini içeriyorsa izin ver
            if (READ_OPERATIONS.includes(operation as (typeof READ_OPERATIONS)[number])) {
              if (hasExplicitTenantFilter(model, args as Record<string, unknown>)) {
                return query(args)
              }
            }

            if (!context && guardMode === 'strict') {
              throw new TenantResolutionError(
                `Tenant context missing for model ${model} operation ${operation}.`
              )
            }

            return query(args)
          },
        },
      },
    })
  })
}

const prismaClientSingleton = () => {
  return new PrismaClient().$extends(createTenancyExtension('strict'))
}

declare global {
  var prismaTenant: undefined | ReturnType<typeof prismaClientSingleton>
}

export const prismaWithTenancy = globalThis.prismaTenant ?? prismaClientSingleton()
if (process.env.NODE_ENV !== 'production') globalThis.prismaTenant = prismaWithTenancy
