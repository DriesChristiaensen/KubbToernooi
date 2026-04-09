# Nuxt Minimal Starter

Look at the [Nuxt documentation](https://nuxt.com/docs/getting-started/introduction) to learn more.

## Setup

Make sure to install dependencies:

```bash
# npm
npm install

# pnpm
pnpm install

# yarn
yarn install

# bun
bun install
```

## Database Seeding

Seed the database with test data:

```bash
# Empty tournament (no teams, no fields)
npm run seed:empty

# Pool tournament only
npm run seed:pool

# Knockout tournament only
npm run seed:ko

# Combination tournament (pools only, no KO bracket)
npm run seed:combined

# Combination tournament with pool matches played (ready for KO generation)
npm run seed:combined-pools-played

# Combination tournament fully finished (pools + KO bracket with all matches played)
npm run seed:combined-finished

# Clear all tournament data
npm run seed:clear
```

All seeders create an admin account with credentials:
- Username: `Admin`
- Password: `admin!`

## Development Server

Start the development server on `http://localhost:3000`:

```bash
# npm
npm run dev

# pnpm
pnpm dev

# yarn
yarn dev

# bun
bun run dev
```

## Production

Build the application for production:

```bash
# npm
npm run build

# pnpm
pnpm build

# yarn
yarn build

# bun
bun run build
```

Locally preview production build:

```bash
# npm
npm run preview

# pnpm
pnpm preview

# yarn
yarn preview

# bun
bun run preview
```

Check out the [deployment documentation](https://nuxt.com/docs/getting-started/deployment) for more information.
