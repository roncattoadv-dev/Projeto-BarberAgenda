// server/db.ts
// Conexão direta ao Postgres via role app_backend (BYPASSRLS), substituindo
// os clients supabase-js com service-role key. Usado só pelo Express —
// o frontend continua indo direto ao PostgREST (RLS) para as tabelas de negócio.

import { Pool } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL || '';

if (!DATABASE_URL) {
  console.error('[DB] DATABASE_URL é obrigatório');
  process.exit(1);
}

export const pool = new Pool({
  connectionString: DATABASE_URL,
  max: 10,
});

pool.on('error', (err) => {
  console.error('[DB] Erro inesperado no pool:', err.message);
});

export async function withTransaction<T>(fn: (client: import('pg').PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
