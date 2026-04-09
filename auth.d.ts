declare module '#auth-utils' {
  interface User {
    id: string
    name: string
    role: 'ADMIN' | 'REFEREE'
  }
}

export {}
