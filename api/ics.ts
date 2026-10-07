import { addDays } from '../src/domain/dates.js';
import { buildIcs, type IcsInput } from '../src/domain/ics.js';
import { createRhythm, type OverrideKind } from '../src/domain/rhythm.js';
import { parsePattern } from '../src/domain/templates.js';
import type { AbsenceKind, DeadlineKind } from '../src/domain/types.js';
import { rpcAnon } from './_supabase.js';

/**
 * Flux d'abonnement .ics : /cal/<jeton>.ics (réécrit vers /api/ics?token=…).
 * Jeton personnel : rythme, absences, échéances et tâches datées.
 * Jeton tuteur : uniquement ce que la page tuteur affiche.
 */

interface Feed {
  first_name: string;
  rhythm: { start_date: string; pattern: unknown } | null;
  overrides: { date: string; kind: OverrideKind }[];
  absences: { id?: string; start_date: string; end_date: string; kind: AbsenceKind; label?: string }[];
  deadlines: { id?: string; title: string; date: string; kind: DeadlineKind }[];
  tasks?: { id: string; title: string; due_date: string; done: boolean }[];
}

const TOKEN_RE = /^[A-Za-z0-9_-]{24,100}$/;

export async function GET(request: Request): Promise<Response> {
  const token = (new URL(request.url).searchParams.get('token') ?? '').replace(/\.ics$/, '');
  if (!TOKEN_RE.test(token)) return new Response('Lien invalide.', { status: 404 });

  let personal = true;
  let feed = await rpcAnon<Feed>('get_calendar_feed', { share_token: token });
  if (!feed) {
    personal = false;
    feed = await rpcAnon<Feed>('get_tutor_view', { share_token: token });
  }
  if (!feed) return new Response('Ce lien a été révoqué ou n’existe pas.', { status: 404 });

  const pattern = feed.rhythm ? parsePattern(feed.rhythm.pattern) : null;
  const today = new Date().toISOString().slice(0, 10);
  const input: IcsInput = {
    calendarName: personal ? 'Rythme – alternance' : `Alternance de ${feed.first_name || 'mon alternant'}`,
    who: personal ? undefined : feed.first_name || undefined,
    rhythm: feed.rhythm && pattern ? createRhythm(feed.rhythm.start_date, pattern, feed.overrides) : null,
    from: addDays(today, -90),
    to: addDays(today, 400),
    absences: feed.absences.map((a) => ({ id: a.id, startDate: a.start_date, endDate: a.end_date, kind: a.kind, label: personal ? a.label : undefined })),
    deadlines: feed.deadlines,
    tasks: personal ? (feed.tasks ?? []).map((t) => ({ id: t.id, title: t.title, dueDate: t.due_date, done: t.done })) : undefined,
  };

  return new Response(buildIcs(input), {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="rythme.ics"',
      'Cache-Control': 'public, max-age=900',
      'X-Robots-Tag': 'noindex',
    },
  });
}
