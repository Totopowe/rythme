import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');

/** Base Postgres en mémoire avec l'environnement Supabase simulé et toutes les migrations appliquées. */
export async function createTestDb() {
  const db = new PGlite();
  await db.exec(readFileSync(join(root, 'tests', 'supabase-shim.sql'), 'utf8'));
  const migrations = readdirSync(join(root, 'migrations')).filter((f) => f.endsWith('.sql')).sort();
  for (const file of migrations) await db.exec(readFileSync(join(root, 'migrations', file), 'utf8'));

  /** Crée un compte (comme le ferait Supabase Auth) et renvoie son identifiant. */
  async function createUser(email: string): Promise<string> {
    await db.exec('reset role');
    const { rows } = await db.query<{ id: string }>('insert into auth.users (email) values ($1) returning id', [email]);
    return rows[0]!.id;
  }

  /**
   * Exécute une requête avec les droits d'un utilisateur connecté (`userId`),
   * du rôle anonyme (`'anon'`) ou du super-utilisateur (`'admin'`).
   */
  async function as<T = Record<string, unknown>>(who: string, sql: string, params: unknown[] = []): Promise<T[]> {
    await db.exec('reset role');
    if (who === 'anon') {
      await db.exec(`select set_config('request.jwt.claim.sub', '', false); set role anon;`);
    } else if (who !== 'admin') {
      await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [who]);
      await db.exec('set role authenticated');
    }
    try {
      const { rows } = await db.query<T>(sql, params);
      return rows;
    } finally {
      await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`);
    }
  }

  return { db, createUser, as };
}

export type TestDb = Awaited<ReturnType<typeof createTestDb>>;
