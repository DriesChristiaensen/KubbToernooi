import { beforeEach } from 'vitest'
import { mockDeep, mockReset } from 'vitest-mock-extended'
import type { PrismaClient } from '@prisma/client'

beforeEach(() => {
  mockReset(prismaMock)
})

const prismaMock = mockDeep<PrismaClient>()
export { prismaMock as prisma }
