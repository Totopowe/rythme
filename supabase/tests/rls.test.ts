import { beforeAll, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb } from './testDb';

let t: TestDb;
let alice: string;
let bob: string;

const OWNED_TABLES = ['rhythms', 'day_overrides', 'absences', 'tasks', 'deadlines', 'reviews', 'share_links'];
const ALL_TABLES = ['schools', 'cohorts', 'profiles', ...OWNED_TABLES, 'feedback', 'events'];

/** Jeton de partage factice et son empreinte, calculée comme côté client. */
const TOKEN = 'jeton-de-test-suffisamment-long-0001';
const ICS_TOKEN = 'flux-ics-personnel-assez-long-0001';

beforeAll(async () => {
  t = await createTestDb();
  alice = await t.createUser('alice@example.com');
  bob = await t.createUser('bob@example.com');
  await t.as(alice, `update profiles set first_name = 'Alice', school_name = 'IAE Lyon', onboarded_at = now() where id = $1`, [alice]);
  await t.as(alice, `insert into rhythms (start_date, pattern) values ('2026-10-05', '[["entreprise","entreprise","entreprise","entreprise","entreprise"]]')`);
  await t.as(alice, `insert into tasks (title, context) values ('Tâche privée d''Alice', 'perso')`);
  await t.as(alice, `insert into deadlines (title, date, context, kind, visible_to_tutor) values ('Partiel visible', '2026-11-02', 'ecole', 'partiel', true)`);
  await t.as(alice, `insert into deadlines (title, date, context, kind) values ('Échéance secrète', '2026-11-03', 'perso', 'autre')`);
  await t.as(alice, `insert into absences (start_date, end_date, kind, label) values ('2026-12-21', '2027-01-01', 'conge', 'Ski avec la famille')`);
  await t.as(alice, `insert into absences (start_date, end_date, kind, visible_to_tutor) values ('2026-11-10', '2026-11-10', 'maladie', false)`);
  await t.as(alice, `insert into day_overrides (date, kind) values ('2026-11-11', 'ferie')`);
  await t.as(alice, `insert into reviews (period_end, from_kind, to_kind, summary) values ('2026-10-04', 'ecole', 'entreprise', 'Bilan privé')`);
  await t.as(alice, `insert into share_links (kind, token_hash) values ('ics', encode(sha256(convert_to($1, 'UTF8')), 'hex'))`, [ICS_TOKEN]);
});

describe('création de compte', () => {
  it('crée automatiquement un profil avec un identifiant d’analyse', async () => {
    const rows = await t.as<{ id: string; analytics_id: string }>(alice, 'select id, analytics_id from profiles');
    expect(rows).toHaveLength(1);
    expect(rows[0]!.id).toBe(alice);
    expect(rows[0]!.analytics_id).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe('isolation entre alternants', () => {
  it.each(OWNED_TABLES)('Bob ne voit aucune ligne d’Alice dans %s', async (table) => {
    expect((await t.as(alice, `select * from ${table}`)).length).toBeGreaterThan(0);
    expect(await t.as(bob, `select * from ${table}`)).toEqual([]);
  });

  it('Bob ne voit pas le profil d’Alice', async () => {
    const rows = await t.as<{ id: string }>(bob, 'select id from profiles');
    expect(rows.map((r) => r.id)).toEqual([bob]);
  });

  it('Bob ne peut ni modifier ni supprimer les tâches d’Alice', async () => {
    const [task] = await t.as<{ id: string }>(alice, 'select id from tasks');
    expect(await t.as(bob, `update tasks set title = 'piraté' where id = $1 returning id`, [task!.id])).toEqual([]);
    expect(await t.as(bob, `delete from tasks where id = $1 returning id`, [task!.id])).toEqual([]);
    const [after] = await t.as<{ title: string }>(alice, 'select title from tasks where id = $1', [task!.id]);
    expect(after!.title).toBe("Tâche privée d'Alice");
  });

  it('Bob ne peut pas écrire au nom d’Alice', async () => {
    await expect(t.as(bob, `insert into tasks (user_id, title, context) values ($1, 'intrus', 'perso')`, [alice])).rejects.toThrow(/row-level security/);
    await expect(t.as(bob, `insert into feedback (user_id, message) values ($1, 'faux avis')`, [alice])).rejects.toThrow(/row-level security/);
  });

  it('Bob ne peut pas transférer sa tâche à Alice', async () => {
    const [own] = await t.as<{ id: string }>(bob, `insert into tasks (title, context) values ('à moi', 'perso') returning id`);
    await expect(t.as(bob, `update tasks set user_id = $1 where id = $2`, [alice, own!.id])).rejects.toThrow(/row-level security/);
  });

  it('le propriétaire est renseigné automatiquement', async () => {
    const [row] = await t.as<{ user_id: string }>(bob, `insert into deadlines (title, date, context) values ('x', '2026-12-01', 'ecole') returning user_id`);
    expect(row!.user_id).toBe(bob);
  });
});

describe('rôle anonyme', () => {
  it.each(ALL_TABLES)('n’a aucun accès direct à %s', async (table) => {
    await expect(t.as('anon', `select * from ${table}`)).rejects.toThrow(/permission denied/);
  });

  it('ne peut pas appeler les fonctions réservées', async () => {
    await expect(t.as('anon', 'select delete_my_account()')).rejects.toThrow(/permission denied/);
    await expect(t.as('anon', 'select log_login()')).rejects.toThrow(/permission denied/);
    await expect(t.as('anon', `select record_event('login')`)).rejects.toThrow(/permission denied/);
  });
});

describe('champs protégés', () => {
  it('l’identifiant d’analyse et l’école rattachée ne sont pas modifiables', async () => {
    await expect(t.as(alice, `update profiles set analytics_id = gen_random_uuid()`)).rejects.toThrow(/permission denied/);
    await expect(t.as(alice, `update profiles set school_id = null`)).rejects.toThrow(/permission denied/);
  });

  it('écoles, promos et événements sont fermés en lecture comme en écriture', async () => {
    await expect(t.as(alice, 'select * from schools')).rejects.toThrow(/permission denied/);
    await expect(t.as(alice, 'select * from events')).rejects.toThrow(/permission denied/);
    await expect(t.as(alice, `insert into events (subject_id, type) values (gen_random_uuid(), 'login')`)).rejects.toThrow(/permission denied/);
  });

  it('les avis sont en dépôt seul', async () => {
    await t.as(alice, `insert into feedback (message, page) values ('Super app', '/')`);
    await expect(t.as(alice, 'select * from feedback')).rejects.toThrow(/permission denied/);
  });
});

describe('page tuteur', () => {
  beforeAll(async () => {
    await t.as(alice, `insert into share_links (kind, token_hash) values ('tutor', encode(sha256(convert_to($1, 'UTF8')), 'hex'))`, [TOKEN]);
  });

  it('n’expose que le rythme, les absences visibles (sans libellé) et les échéances choisies', async () => {
    const [{ view }] = (await t.as<{ view: Record<string, unknown> }>('anon', 'select get_tutor_view($1) as view', [TOKEN])) as [{ view: Record<string, unknown> }];
    expect(view.first_name).toBe('Alice');
    expect(view.rhythm).toMatchObject({ start_date: '2026-10-05' });
    expect(view.deadlines).toEqual([{ title: 'Partiel visible', date: '2026-11-02', kind: 'partiel' }]);
    expect(view.absences).toEqual([{ start_date: '2026-12-21', end_date: '2027-01-01', kind: 'conge' }]);
    const json = JSON.stringify(view);
    expect(json).not.toContain('Tâche privée');
    expect(json).not.toContain('secrète');
    expect(json).not.toContain('Ski');
    expect(json).not.toContain('Bilan privé');
    expect(json).not.toContain(alice);
  });

  it('renvoie null pour un jeton inconnu, trop court ou révoqué', async () => {
    expect((await t.as<{ v: unknown }>('anon', 'select get_tutor_view($1) as v', ['inconnu-mais-assez-long-pour-passer']))[0]!.v).toBeNull();
    expect((await t.as<{ v: unknown }>('anon', 'select get_tutor_view($1) as v', ['court']))[0]!.v).toBeNull();
    await t.as(alice, `update share_links set revoked_at = now() where kind = 'tutor'`);
    expect((await t.as<{ v: unknown }>('anon', 'select get_tutor_view($1) as v', [TOKEN]))[0]!.v).toBeNull();
  });

  it('un jeton tuteur ne donne pas accès au flux .ics complet', async () => {
    await t.as(alice, `insert into share_links (kind, token_hash) values ('tutor', encode(sha256(convert_to($1, 'UTF8')), 'hex'))`, [TOKEN + 'b']);
    expect((await t.as<{ v: unknown }>('anon', 'select get_calendar_feed($1) as v', [TOKEN + 'b']))[0]!.v).toBeNull();
  });

  it('un seul lien actif par type', async () => {
    await expect(
      t.as(alice, `insert into share_links (kind, token_hash) values ('tutor', encode(sha256(convert_to('autre-jeton-assez-long-xyz', 'UTF8')), 'hex'))`),
    ).rejects.toThrow(/duplicate key/);
  });

  it('un lien ne peut être modifié que pour être révoqué', async () => {
    await expect(t.as(alice, `update share_links set token_hash = repeat('a', 64)`)).rejects.toThrow(/permission denied/);
  });
});

describe('flux .ics personnel', () => {
  it('contient tâches datées et échéances de l’alternant', async () => {
    await t.as(alice, `update tasks set due_date = '2026-10-09'`);
    const [{ feed }] = (await t.as<{ feed: { tasks: unknown[]; deadlines: unknown[] } }>('anon', 'select get_calendar_feed($1) as feed', [ICS_TOKEN])) as [
      { feed: { tasks: unknown[]; deadlines: unknown[] } },
    ];
    expect(feed.tasks).toHaveLength(1);
    expect(feed.deadlines).toHaveLength(2);
  });
});

describe('mesure d’usage', () => {
  async function eventsOf(user: string) {
    const [{ analytics_id }] = (await t.as<{ analytics_id: string }>(user, 'select analytics_id from profiles')) as [{ analytics_id: string }];
    return t.as<{ type: string }>('admin', 'select type from events where subject_id = $1 order by id', [analytics_id]);
  }

  it('produit les événements métier côté base', async () => {
    const types = (await eventsOf(alice)).map((e) => e.type);
    expect(types).toContain('signup');
    expect(types).toContain('task_created');
    expect(types).toContain('tutor_link_created');
  });

  it('compte une tâche terminée une seule fois', async () => {
    const [task] = await t.as<{ id: string }>(bob, `insert into tasks (title, context) values ('finir', 'ecole') returning id`);
    await t.as(bob, `update tasks set done_at = now() where id = $1`, [task!.id]);
    await t.as(bob, `update tasks set title = 'finir vraiment' where id = $1`, [task!.id]);
    const types = (await eventsOf(bob)).map((e) => e.type);
    expect(types.filter((x) => x === 'task_completed')).toHaveLength(1);
  });

  it('n’enregistre qu’une connexion par jour', async () => {
    await t.as(bob, 'select log_login()');
    await t.as(bob, 'select log_login()');
    expect((await eventsOf(bob)).filter((e) => e.type === 'login')).toHaveLength(1);
  });

  it('enregistre la revue de transition', async () => {
    await t.as(bob, `insert into reviews (period_end, from_kind, to_kind) values ('2026-10-25', 'entreprise', 'ecole')`);
    expect((await eventsOf(bob)).map((e) => e.type)).toContain('review_completed');
  });
});

describe('suppression du compte', () => {
  it('efface toutes les données et ne garde que des événements anonymes', async () => {
    const carol = await t.createUser('carol@example.com');
    await t.as(carol, `update profiles set onboarded_at = now()`);
    await t.as(carol, `insert into tasks (title, context) values ('à effacer', 'perso')`);
    await t.as(carol, `insert into feedback (message) values ('mon avis')`);
    const [{ analytics_id }] = (await t.as<{ analytics_id: string }>(carol, 'select analytics_id from profiles')) as [{ analytics_id: string }];

    await t.as(carol, 'select delete_my_account()');

    expect(await t.as('admin', 'select * from auth.users where id = $1', [carol])).toEqual([]);
    expect(await t.as('admin', 'select * from profiles where id = $1', [carol])).toEqual([]);
    expect(await t.as('admin', 'select * from tasks where user_id = $1', [carol])).toEqual([]);
    const [feedback] = await t.as<{ user_id: string | null }>('admin', `select user_id from feedback where message = 'mon avis'`);
    expect(feedback!.user_id).toBeNull();
    const events = await t.as('admin', 'select * from events where subject_id = $1', [analytics_id]);
    expect(events.length).toBeGreaterThan(0);
  });
});
