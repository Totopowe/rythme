import { todayISO } from '../domain/dates';
import { getStoreState } from './store';

/** Export RGPD : toutes les données de l'alternant, telles qu'elles sont stockées. */
export function exportMyData() {
  const data = getStoreState().data;
  if (!data) throw new Error('Données non chargées.');
  return {
    format: 'rythme-export',
    version: 1,
    exportedAt: new Date().toISOString(),
    data,
  };
}

export function downloadMyData(): void {
  const blob = new Blob([JSON.stringify(exportMyData(), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `rythme-mes-donnees-${todayISO()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
