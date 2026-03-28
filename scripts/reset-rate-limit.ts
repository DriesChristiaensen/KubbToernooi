import { createInterface } from 'readline'

const rl = createInterface({ input: process.stdin, output: process.stdout })

function ask(question: string): Promise<string> {
  return new Promise(resolve => rl.question(question, resolve))
}

async function main() {
  console.log('=== Admin Login Timeout Reset ===\n')

  const host = process.argv[2] ?? 'http://localhost:3000'
  console.log(`Server: ${host}\n`)

  const password = await ask('Admin-wachtwoord: ')
  rl.close()

  const res = await fetch(`${host}/api/auth/reset-rate-limit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  })

  const data = await res.json() as Record<string, unknown>

  if (res.ok) {
    console.log('\nRate limit gereset. De admin kan opnieuw inloggen.')
  }
  else {
    const err = (data as { data?: { error?: string } })?.data?.error ?? JSON.stringify(data)
    console.error(`\nMislukt (${res.status}): ${err}`)
    process.exit(1)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
