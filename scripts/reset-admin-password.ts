import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'
import { createInterface } from 'readline'

const prisma = new PrismaClient()

const rl = createInterface({ input: process.stdin, output: process.stdout })

function ask(question: string): Promise<string> {
  return new Promise(resolve => rl.question(question, resolve))
}

async function main() {
  console.log('=== Admin Password Reset ===\n')

  const newPassword = await ask('Nieuw admin-wachtwoord: ')

  if (newPassword.length < 6) {
    console.error('Wachtwoord moet minstens 6 tekens bevatten.')
    process.exit(1)
  }

  const hashed = await bcrypt.hash(newPassword, 12)

  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } })

  if (admin) {
    await prisma.user.update({
      where: { id: admin.id },
      data: { password: hashed },
    })
    console.log(`\nWachtwoord bijgewerkt voor admin "${admin.name}".`)
  }
  else {
    await prisma.user.create({
      data: { name: 'Admin', password: hashed, role: 'ADMIN' },
    })
    console.log('\nAdmin-account aangemaakt.')
  }

  rl.close()
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
