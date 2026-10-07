import { Modal } from '../components/Modal';
import { IconButton, Kbd, modKey } from '../components/ui';

/** Liste unique des raccourcis, également reprise dans le README. */
export const SHORTCUT_GROUPS: { title: string; items: { keys: string[]; label: string }[] }[] = [
  {
    title: 'Partout',
    items: [
      { keys: [modKey, 'K'], label: 'Palette : capturer, chercher, agir' },
      { keys: ['N'], label: 'Nouvelle tâche (champ d’ajout rapide)' },
      { keys: ['1'], label: 'Aujourd’hui' },
      { keys: ['2'], label: 'Tâches' },
      { keys: ['3'], label: 'Calendrier' },
      { keys: ['4'], label: 'Notes' },
      { keys: [','], label: 'Réglages' },
      { keys: ['?'], label: 'Afficher cette aide' },
      { keys: [modKey, 'Z'], label: 'Annuler la dernière suppression' },
    ],
  },
  {
    title: 'Listes de tâches',
    items: [
      { keys: ['J', '↓'], label: 'Tâche suivante' },
      { keys: ['K', '↑'], label: 'Tâche précédente' },
      { keys: ['X', 'Espace'], label: 'Cocher / décocher' },
      { keys: ['E', '↵'], label: 'Modifier' },
      { keys: ['Suppr'], label: 'Supprimer (annulable)' },
      { keys: ['Alt', '↑', '↓'], label: 'Monter / descendre la tâche' },
      { keys: ['F'], label: 'Changer de filtre de contexte' },
    ],
  },
  {
    title: 'Notes',
    items: [
      { keys: ['/'], label: 'Rechercher dans les notes' },
      { keys: [modKey, 'E'], label: 'Basculer édition / aperçu' },
    ],
  },
  {
    title: 'Fenêtres',
    items: [
      { keys: [modKey, '↵'], label: 'Enregistrer' },
      { keys: ['Échap'], label: 'Fermer' },
    ],
  },
];

export function ShortcutsHelp({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} label="Raccourcis clavier" className="md:max-w-2xl">
      <div className="flex items-center justify-between border-b border-line py-2 pl-5 pr-2">
        <h2 className="text-[15px] font-semibold">Raccourcis clavier</h2>
        <IconButton icon="close" label="Fermer" onClick={onClose} autoFocus />
      </div>
      <div className="grid max-h-[70vh] gap-x-8 gap-y-6 overflow-y-auto p-5 md:grid-cols-2">
        {SHORTCUT_GROUPS.map((g) => (
          <section key={g.title}>
            <h3 className="mb-2 text-2xs font-semibold uppercase tracking-wider text-faint">{g.title}</h3>
            <dl className="space-y-1.5">
              {g.items.map((s) => (
                <div key={s.label} className="flex items-center justify-between gap-4 text-sm">
                  <dt className="text-muted">{s.label}</dt>
                  <dd className="flex shrink-0 gap-1">
                    {s.keys.map((k) => (
                      <Kbd key={k}>{k}</Kbd>
                    ))}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
      <p className="border-t border-line px-5 py-3 text-xs text-muted">
        Capture : <Kbd>#ecole</Kbd> <Kbd>#entreprise</Kbd> <Kbd>#perso</Kbd> · dates en toutes lettres (« vendredi », « demain », « 12/11 ») · priorité <Kbd>!</Kbd> à{' '}
        <Kbd>!!!</Kbd> · <Kbd>@partiel</Kbd> <Kbd>@rendu</Kbd> pour une échéance.
      </p>
    </Modal>
  );
}
