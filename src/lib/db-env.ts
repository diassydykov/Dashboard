/** Map Vercel/Supabase marketplace names onto Prisma's DATABASE_URL / DIRECT_URL. */
export function applyDbAliases() {
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL;
  }
  if (!process.env.DIRECT_URL) {
    process.env.DIRECT_URL =
      process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL;
  }
}
