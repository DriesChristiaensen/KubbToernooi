declare module '#auth-utils' {
  interface User {
    id: number
    name: string
    role: 'ADMIN' | 'REFEREE'
  }
}

export {}
