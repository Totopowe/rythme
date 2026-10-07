import type { IconName } from '../components/Icon';

export interface NavItem {
  path: string;
  label: string;
  icon: IconName;
  /** Raccourci clavier global. */
  key: string;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { path: '/', label: "Aujourd'hui", icon: 'sun', key: '1' },
  { path: '/taches', label: 'Tâches', icon: 'list', key: '2' },
  { path: '/calendrier', label: 'Calendrier', icon: 'calendar', key: '3' },
  { path: '/partage', label: 'Partage', icon: 'link', key: '4' },
];

export const SETTINGS_PATH = '/reglages';
export const REVIEW_PATH = '/revue';
export const SHARE_PATH = '/partage';
export const PRIVACY_PATH = '/confidentialite';
