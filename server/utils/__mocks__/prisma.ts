import { beforeEach } from 'vitest'
import { mockDeep, mockReset } from 'vitest-mock-extended'
import type { PrismaClient } from '@prisma/client'

beforeEach(() => {
  mockReset(prismaMock)
})

const prismaMock = mockDeep<PrismaClient>()

// Mock $transaction to pass through the callback with the mock proxy
prismaMock.$transaction.mockImplementation(async (callback: (tx: typeof prismaMock) => Promise<unknown>) => {
  return callback(prismaMock)
})

export { prismaMock as prisma }
