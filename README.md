# Rythme

Organiseur personnel pour étudiant en alternance. Rythme connaît ton calendrier école / entreprise, sait à tout moment dans quel mode tu es, et organise ta journée en conséquence : tâches, échéances, notes et revue de fin de période.

- **Local d'abord** : tout est stocké dans le navigateur (IndexedDB). Pas de compte, pas de serveur.
- **Hors ligne** : PWA installable sur téléphone et ordinateur.
- **Clavier d'abord** : capture en moins de 3 secondes avec <kbd>⌘K</kbd> / <kbd>Ctrl+K</kbd>.

## Installation et lancement

Prérequis : Node.js 22 LTS (ou 20.19+).

```bash
npm install
npm run dev        # http://localhost:5173
```

| Commande            | Rôle                                                  |
| ------------------- | ----------------------------------------------------- |
| `npm run dev`       | Serveur de développement                              |
| `npm test`          | Tests Vitest (logique métier + base de données)       |
| `npm run typecheck` | Vérification TypeScript stricte                       |
| `npm run build`     | Build de production dans `dist/` (avec service worker) |
| `npm run preview`   | Sert le build de production sur http://localhost:4173 |

## Installer sur téléphone

Un téléphone n'installe une PWA que si elle est servie en **HTTPS**. Le dépôt contient un workflow GitHub Pages prêt à l'emploi :

1. Pousse le projet sur un dépôt GitHub (branche `main`).
2. Dans le dépôt : **Settings → Pages → Source : GitHub Actions**.
3. À chaque push, l'app est testée, construite et publiée sur `https://<utilisateur>.github.io/<dépôt>/`.
4. Sur le téléphone, ouvre cette adresse puis :
   - **iPhone (Safari)** : Partager → « Sur l'écran d'accueil ».
   - **Android (Chrome)** : menu ⋮ → « Installer l'application ».

Après la première visite, l'app fonctionne entièrement hors ligne. Les mises à jour s'installent automatiquement à la visite suivante.

Les données vivent dans le navigateur de chaque appareil : pour passer de l'ordinateur au téléphone, utilise **Réglages → Exporter / Importer**.

## Utilisation

1. **Configure ton rythme** au premier lancement : date de début et séquence (3 entreprise / 1 école par défaut). Les congés et semaines irrégulières se corrigent d'un clic dans le calendrier, ou en collant le calendrier de l'école dans **Réglages → Importer des semaines**.
2. **Capture** : <kbd>⌘K</kbd>, tape, <kbd>Entrée</kbd>. La syntaxe :

   | Saisie                                  | Effet                                   |
   | --------------------------------------- | --------------------------------------- |
   | `#ecole` `#entreprise` `#perso`         | Contexte (sinon : celui de la semaine)  |
   | `demain`, `vendredi`, `lundi prochain`  | Date                                    |
   | `12/11`, `12 mars`, `dans 3 jours`      | Date                                    |
   | `semaine prochaine`, `fin du mois`      | Date                                    |
   | `!` `!!` `!!!`                          | Priorité basse / moyenne / haute        |
   | `@partiel` `@rendu` `@memoire` `@reunion` | Crée une échéance au lieu d'une tâche |

   Exemple : `rendre dossier finance #ecole vendredi !!`

3. **Réveil des tâches École** : pendant les périodes en entreprise, les tâches École sans date proche restent discrètes ; elles réapparaissent sur « Aujourd'hui » 7 jours avant la semaine d'école (réglable).
4. **Revue de transition** : à partir du vendredi de la dernière semaine d'une période, un bandeau propose de faire le point (en suspens → à préparer → bilan).

## Raccourcis clavier

Appuie sur <kbd>?</kbd> dans l'app pour les afficher.

| Partout                      |                                         |
| ---------------------------- | --------------------------------------- |
| <kbd>⌘/Ctrl</kbd> <kbd>K</kbd> | Palette : capturer, chercher, agir     |
| <kbd>N</kbd>                 | Nouvelle tâche (nouvelle note dans Notes) |
| <kbd>1</kbd> à <kbd>4</kbd>  | Aujourd'hui, Tâches, Calendrier, Notes  |
| <kbd>,</kbd>                 | Réglages                                |
| <kbd>?</kbd>                 | Aide des raccourcis                     |
| <kbd>⌘/Ctrl</kbd> <kbd>Z</kbd> | Annuler la dernière suppression        |

| Listes de tâches             |                                         |
| ---------------------------- | --------------------------------------- |
| <kbd>J</kbd> / <kbd>K</kbd> ou flèches | Tâche suivante / précédente   |
| <kbd>X</kbd> ou <kbd>Espace</kbd> | Cocher / décocher                  |
| <kbd>E</kbd> ou <kbd>Entrée</kbd> | Modifier                           |
| <kbd>Suppr</kbd>             | Supprimer (annulable)                   |
| <kbd>Alt</kbd> <kbd>↑</kbd> / <kbd>↓</kbd> | Monter / descendre la tâche |
| <kbd>F</kbd>                 | Changer de filtre de contexte           |

| Calendrier                   |                                         |
| ---------------------------- | --------------------------------------- |
| <kbd>←</kbd> <kbd>→</kbd>    | Semaine précédente / suivante           |
| <kbd>↑</kbd> <kbd>↓</kbd>    | 4 semaines avant / après                |
| <kbd>T</kbd>                 | Revenir à la semaine en cours           |

| Notes et fenêtres            |                                         |
| ---------------------------- | --------------------------------------- |
| <kbd>/</kbd>                 | Rechercher dans les notes               |
| <kbd>⌘/Ctrl</kbd> <kbd>E</kbd> | Basculer édition / aperçu             |
| <kbd>⌘/Ctrl</kbd> <kbd>Entrée</kbd> | Enregistrer / étape suivante     |
| <kbd>Échap</kbd>             | Fermer                                  |

## Structure du projet

```
src/
├─ domain/          Logique métier pure, sans React ni base de données (testée)
│  ├─ dates.ts          Dates ISO sans fuseau horaire, formatage français
│  ├─ rhythm.ts         Calcul du mode, périodes, compte à rebours, année scolaire
│  ├─ quickCapture.ts   Parseur de la capture rapide
│  ├─ planning.ts       Réveil des tâches École, vue Aujourd'hui, revue de transition
│  ├─ search.ts         Recherche insensible aux accents
│  ├─ order.ts          Réordonnancement dans une liste filtrée
│  ├─ weekImport.ts     Import manuel d'un calendrier de semaines
│  ├─ backup.ts         Format et validation de la sauvegarde JSON
│  └─ types.ts          Modèle de données
├─ db/              Dexie (IndexedDB) : schéma, opérations, export/import
├─ features/        Un dossier par écran
│  ├─ today/  tasks/  calendar/  notes/  review/  settings/  onboarding/
│  ├─ capture/          Champ d'ajout rapide et aperçu de la saisie
│  └─ deadlines/        Échéances (ligne et éditeur)
├─ shell/           Mise en page, navigation, palette ⌘K, aide des raccourcis
├─ components/      Composants d'interface réutilisables (boutons, fenêtre, toasts…)
└─ hooks/           Données de l'app, thème, raccourcis, date du jour
scripts/generate-icons.py   Génère les icônes PNG de la PWA (sans dépendance)
```

Les choix d'architecture et de produit sont expliqués dans [DECISIONS.md](DECISIONS.md).
