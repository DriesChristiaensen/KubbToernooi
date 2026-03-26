import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'

const prisma = new PrismaClient()

async function main() {
  const adminPassword = await bcrypt.hash('admin123', 12)

  await prisma.user.upsert({
    where: { id: 1 },
    update: {},
    create: {
      name: 'Admin',
      password: adminPassword,
      role: 'ADMIN',
    },
  })

  console.log('Seed completed: admin account created')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
