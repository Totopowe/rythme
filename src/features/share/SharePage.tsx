import { useState, type ReactNode } from 'react';
import { Icon } from '../../components/Icon';
import { useToast } from '../../components/Toast';
import { Button, Card, cx } from '../../components/ui';
import { createShareLink, revokeShareLink } from '../../data/actions';
import { formatRelative, todayISO } from '../../domain/dates';
import { useAppData } from '../../hooks/useAppData';
import { useUi } from '../../shell/uiState';

export function tutorUrl(token: string): string {
  return `${location.origin}/t/${token}`;
}

export function icsUrl(token: string): string {
  return `${location.origin}/cal/${token}.ics`;
}

async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function SharePage() {
  const { data, profile } = useAppData();
  const toast = useToast();
  const { editDeadline } = useUi();
  const tutor = data.shareLinks.find((l) => l.kind === 'tutor' && !l.revokedAt);
  const ics = data.shareLinks.find((l) => l.kind === 'ics' && !l.revokedAt);
  const visibleDeadlines = data.deadlines.filter((d) => d.visibleToTutor && d.date >= todayISO()).length;
  const visibleAbsences = data.absences.filter((a) => a.visibleToTutor && a.endDate >= todayISO()).length;

  const copyLink = async (url: string) => toast.show((await copy(url)) ? 'Lien copié' : 'Copie impossible : sélectionne le lien à la main');

  return (
    <div className="mx-auto max-w-2xl space-y-10 pb-10">
      <header>
        <h1 className="text-[26px] font-semibold tracking-tight">Partage</h1>
        <p className="mt-1 text-sm leading-6 text-muted">Ton tuteur sait quand tu es là, sans créer de compte. Toi, tu retrouves ton alternance dans ton agenda habituel.</p>
      </header>

      <section aria-labelledby="tutor-title" className="space-y-4">
        <h2 id="tutor-title" className="text-[15px] font-semibold">
          Lien pour mon tuteur
        </h2>
        {tutor ? (
          <LinkCard
            url={tutorUrl(tutor.token)}
            meta={tutor.lastViewedAt ? `Consulté ${formatRelative(tutor.lastViewedAt.slice(0, 10), todayISO()).toLowerCase()}` : 'Pas encore consulté'}
            onCopy={() => void copyLink(tutorUrl(tutor.token))}
            shareTitle={`Calendrier d’alternance de ${profile.firstName}`}
            onRegenerate={() => {
              createShareLink('tutor');
              toast.show('Nouveau lien créé. L’ancien ne fonctionne plus.');
            }}
            onRevoke={() => {
              revokeShareLink('tutor');
              toast.show('Lien révoqué. Ton tuteur n’y a plus accès.');
            }}
            preview={tutorUrl(tutor.token)}
          />
        ) : (
          <Card className="p-5">
            <p className="text-sm leading-6 text-muted">Crée un lien privé, en lecture seule, à envoyer à ton tuteur par e-mail ou message. Tu peux le révoquer à tout moment.</p>
            <Button
              variant="primary"
              icon="link"
              className="mt-4"
              onClick={() => {
                const token = createShareLink('tutor');
                void copyLink(tutorUrl(token));
              }}
            >
              Créer et copier mon lien
            </Button>
          </Card>
        )}

        <Card className="p-5">
          <p className="text-[13px] font-semibold">Ce que voit ton tuteur</p>
          <ul className="mt-3 space-y-2 text-sm">
            <Visible yes>Ton prénom, ton école et tes périodes école / entreprise</Visible>
            <Visible yes>
              Tes absences prévues ({visibleAbsences}), sans leur motif ni ta précision
            </Visible>
            <Visible yes>
              Les échéances que tu choisis de partager ({visibleDeadlines}){' '}
              <button type="button" className="text-accent underline-offset-2 hover:underline" onClick={() => editDeadline({ date: todayISO() })}>
                en ajouter une
              </button>
            </Visible>
            <Visible>Tes tâches, tes bilans, tes autres échéances</Visible>
          </ul>
        </Card>
      </section>

      <section aria-labelledby="ics-title" className="space-y-4">
        <h2 id="ics-title" className="text-[15px] font-semibold">
          Dans mon agenda
        </h2>
        {ics ? (
          <>
            <LinkCard
              url={icsUrl(ics.token)}
              meta="Se met à jour automatiquement (toutes les quelques heures selon l’agenda)."
              onCopy={() => void copyLink(icsUrl(ics.token))}
              onRegenerate={() => {
                createShareLink('ics');
                toast.show('Nouveau lien d’agenda créé. Réabonne-toi avec celui-ci.');
              }}
              onRevoke={() => {
                revokeShareLink('ics');
                toast.show('Abonnement révoqué.');
              }}
            />
            <div className="flex flex-wrap gap-2">
              <a className={pill} href={`https://calendar.google.com/calendar/render?cid=${encodeURIComponent(icsUrl(ics.token).replace(/^https?:/, 'webcal:'))}`} target="_blank" rel="noreferrer">
                Google Agenda
              </a>
              <a className={pill} href={icsUrl(ics.token).replace(/^https?:/, 'webcal:')}>
                Apple Calendrier
              </a>
              <a
                className={pill}
                href={`https://outlook.live.com/calendar/0/addfromweb?url=${encodeURIComponent(icsUrl(ics.token))}&name=${encodeURIComponent('Rythme')}`}
                target="_blank"
                rel="noreferrer"
              >
                Outlook
              </a>
            </div>
            <p className="text-xs leading-5 text-muted">Ce lien est personnel : il contient aussi tes tâches datées. Ne le partage pas.</p>
          </>
        ) : (
          <Card className="p-5">
            <p className="text-sm leading-6 text-muted">
              Abonne Google Agenda, Outlook ou Apple Calendrier à ton rythme, tes absences, échéances et tâches datées. Lecture seule, mis à jour automatiquement.
            </p>
            <Button icon="calendar" className="mt-4" onClick={() => createShareLink('ics')}>
              Créer mon lien d’agenda
            </Button>
          </Card>
        )}
      </section>
    </div>
  );
}

const pill = 'inline-flex min-h-10 items-center rounded-full border border-line px-3.5 text-[13px] text-ink transition-colors hover:border-faint md:min-h-8';

function Visible({ yes, children }: { yes?: boolean; children: ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <span className={cx('mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full', yes ? 'bg-entreprise/15 text-entreprise' : 'bg-line text-muted')}>
        <Icon name={yes ? 'check' : 'close'} size={10} strokeWidth={3} />
      </span>
      <span className={yes ? undefined : 'text-muted'}>{yes ? children : <>Jamais : {children}</>}</span>
    </li>
  );
}

interface LinkCardProps {
  url: string;
  meta: string;
  onCopy: () => void;
  onRegenerate: () => void;
  onRevoke: () => void;
  shareTitle?: string;
  preview?: string;
}

function LinkCard({ url, meta, onCopy, onRegenerate, onRevoke, shareTitle, preview }: LinkCardProps) {
  const [confirm, setConfirm] = useState<'regenerate' | 'revoke' | null>(null);
  const canShare = typeof navigator !== 'undefined' && 'share' in navigator && shareTitle;

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2">
        <input readOnly value={url} onFocus={(e) => e.target.select()} aria-label="Lien" className="min-h-11 min-w-0 flex-1 rounded-lg bg-line/40 px-3 font-mono text-[13px] text-ink outline-none md:min-h-9" />
        <Button variant="primary" icon="copy" onClick={onCopy}>
          Copier
        </Button>
      </div>
      <p className="mt-2 text-xs text-muted">{meta}</p>
      <div className="mt-3 flex flex-wrap items-center gap-1">
        {canShare && (
          <Button size="sm" variant="ghost" onClick={() => void navigator.share({ title: shareTitle, url }).catch(() => undefined)}>
            Envoyer…
          </Button>
        )}
        {preview && (
          <a href={preview} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center rounded-lg px-3 text-[13px] font-medium text-muted hover:bg-line/50 hover:text-ink md:min-h-8">
            Voir comme mon tuteur
          </a>
        )}
        {confirm ? (
          <span className="flex flex-wrap items-center gap-1 text-[13px]">
            <span className="px-1 text-danger">{confirm === 'revoke' ? 'Couper l’accès ?' : 'L’ancien lien cessera de fonctionner.'}</span>
            <Button
              size="sm"
              variant="danger"
              onClick={() => {
                if (confirm === 'revoke') onRevoke();
                else onRegenerate();
                setConfirm(null);
              }}
            >
              Confirmer
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirm(null)}>
              Annuler
            </Button>
          </span>
        ) : (
          <>
            <Button size="sm" variant="ghost" onClick={() => setConfirm('regenerate')}>
              Régénérer
            </Button>
            <Button size="sm" variant="danger" onClick={() => setConfirm('revoke')}>
              Révoquer
            </Button>
          </>
        )}
      </div>
    </Card>
  );
}
