import {
  TABLES,
  absenceFromRow,
  deadlineFromRow,
  overrideFromRow,
  patchToRow,
  profileFromRow,
  profilePatchToRow,
  reviewFromRow,
  rhythmFromRow,
  rhythmToRow,
  shareLinkFromRow,
  taskFromRow,
  toRow,
} from './mappers';
import type { FlushResult, Op, UserData } from './model';
import { isNetworkError, supabase } from './supabase';

/** Charge toutes les données de l'alternant connecté (la RLS ne renvoie que les siennes). */
export async function fetchAll(userId: string): Promise<UserData> {
  const [profile, rhythm, overrides, absences, tasks, deadlines, reviews, links] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).single(),
    supabase.from('rhythms').select('*').maybeSingle(),
    supabase.from('day_overrides').select('date, kind'),
    supabase.from('absences').select('*'),
    supabase.from('tasks').select('*'),
    supabase.from('deadlines').select('*'),
    supabase.from('reviews').select('*'),
    supabase.from('share_links').select('*').is('revoked_at', null),
  ]);
  const failed = [profile, rhythm, overrides, absences, tasks, deadlines, reviews, links].find((r) => r.error);
  if (failed?.error) throw Object.assign(new Error(failed.error.message), { network: isNetworkError(failed.error) });

  return {
    profile: profileFromRow(profile.data!),
    rhythm: rhythmFromRow(rhythm.data),
    overrides: overrides.data!.map(overrideFromRow),
    absences: absences.data!.map(absenceFromRow),
    tasks: tasks.data!.map(taskFromRow),
    deadlines: deadlines.data!.map(deadlineFromRow),
    reviews: reviews.data!.map(reviewFromRow),
    shareLinks: links.data!.map(shareLinkFromRow),
  };
}

function classify(error: { code?: string; message: string } | null): FlushResult {
  if (!error) return 'ok';
  return isNetworkError(error) ? 'retry' : { error: error.message };
}

/** Envoie une opération au serveur. Les créations sont des upserts : rejouer est sans danger. */
export async function sendOp(op: Op, userId: string): Promise<FlushResult> {
  try {
    switch (op.type) {
      case 'put': {
        const { error } = await supabase.from(TABLES[op.coll]).upsert(toRow(op.coll, op.item), { onConflict: 'id' });
        return classify(error);
      }
      case 'patch': {
        const { error } = await supabase.from(TABLES[op.coll]).update(patchToRow(op)).eq('id', op.id);
        return classify(error);
      }
      case 'delete': {
        const { error } = await supabase.from(TABLES[op.coll]).delete().eq('id', op.id);
        return classify(error);
      }
      case 'override': {
        const { error } = op.kind
          ? await supabase.from('day_overrides').upsert({ date: op.date, kind: op.kind }, { onConflict: 'user_id,date' })
          : await supabase.from('day_overrides').delete().eq('date', op.date);
        return classify(error);
      }
      case 'rhythm': {
        const { error } = await supabase.from('rhythms').upsert(rhythmToRow(op.rhythm), { onConflict: 'user_id' });
        return classify(error);
      }
      case 'profile': {
        const { error } = await supabase.from('profiles').update(profilePatchToRow(op.patch)).eq('id', userId);
        return classify(error);
      }
    }
  } catch {
    return 'retry';
  }
}
