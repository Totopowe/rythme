import { Link } from 'wouter';
import { Icon } from '../../components/Icon';
import { IconButton } from '../../components/ui';
import { useAppData } from '../../hooks/useAppData';
import { usePersistentState } from '../../hooks/usePersistentState';

/** Invitation discrète à partager son calendrier, tant qu'aucun lien tuteur n'existe. */
export function ShareInvite() {
  const { data } = useAppData();
  const [dismissed, setDismissed] = usePersistentState<boolean>('share-invite-dismissed', false);
  if (dismissed || data.shareLinks.some((l) => l.kind === 'tutor' && !l.revokedAt)) return null;

  return (
    <div className="flex items-center gap-3 rounded-xl border border-dashed border-line px-4 py-3">
      <Icon name="link" size={18} className="shrink-0 text-muted" />
      <Link href="/partage" className="min-w-0 flex-1 text-sm">
        <span className="font-medium">Partage ton calendrier avec ton tuteur</span>
        <span className="block text-xs text-muted">Il saura quand tu es là, sans créer de compte. Lien privé et révocable.</span>
      </Link>
      <IconButton icon="close" label="Masquer cette suggestion" onClick={() => setDismissed(true)} />
    </div>
  );
}
