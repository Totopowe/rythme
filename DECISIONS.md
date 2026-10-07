# Décisions

Choix faits pendant la construction de Rythme, avec leur raison.

## Architecture

- **Logique métier pure dans `src/domain/`**. Aucune dépendance à React ni à Dexie : le calcul du rythme, le parseur de capture, le réveil des tâches et la revue sont testés directement par Vitest, sans navigateur.
- **Dates en chaînes `YYYY-MM-DD`** et calculs en UTC. Les changements d'heure et les fuseaux ne peuvent pas décaler une semaine. Pas de bibliothèque de dates : une quinzaine de fonctions testées suffisent.
- **Pas de store global** : les composants lisent IndexedDB avec `useLiveQuery` (dexie-react-hooks). Toute écriture se reflète immédiatement partout.
- **Routage par hash** (`#/notes`) avec wouter (≈ 2 Ko). Fonctionne sur GitHub Pages sans configuration serveur et hors ligne.
- **Vues secondaires chargées à la demande** (Tâches, Calendrier, Notes, Revue, Réglages). La vue Aujourd'hui s'affiche plus vite ; tout reste précaché pour le hors ligne.
- **Dépendances limitées** : dexie, wouter, @dnd-kit (glisser-déposer accessible, souris, tactile et clavier), marked + DOMPurify (Markdown assaini), vite-plugin-pwa. Icônes SVG dessinées à la main, police système.

## Rythme d'alternance

- **Semaines du lundi au dimanche.** Le week-end appartient à la semaine qui se termine.
- **Motif répété + exceptions.** Le rythme est un motif (ex. E, E, E, É) répété depuis une date de début ; chaque semaine peut être corrigée individuellement (exception). Une exception identique au motif est automatiquement supprimée.
- **Troisième type de semaine : Congé.** Les congés et jours fériés groupés cassent le 3/1. En congé, l'accent est ambre et le contexte par défaut est Perso.
- **Le motif se prolonge avant la date de début**, pour que la frise de l'année reste cohérente.
- **Compte à rebours** : en entreprise, on annonce la prochaine semaine d'école même si un congé s'intercale ; sinon, le prochain changement de mode. En jours jusqu'à 21 jours, en semaines au-delà.
- **Année scolaire de septembre à août** dans le calendrier ; une semaine appartient au mois de son jeudi (convention ISO). À partir d'août, le calendrier affiche l'année suivante.
- **Import manuel des semaines** : texte libre, une ligne par semaine ou par plage (`21/12/2026 au 03/01/2027 congé`), formats français ou ISO, séparateurs espace/virgule/point-virgule. Les lignes illisibles sont signalées, pas importées.

## Tâches

- **Contexte par défaut = mode de la semaine** quand la saisie n'en précise pas.
- **Nouvelles tâches en haut** de la liste (ordre manuel). L'ordre d'une nouvelle tâche est `-Date.now()` : pas de conflit même en saisie très rapide.
- **Réveil des tâches École** : pendant l'entreprise, une tâche École non faite sans date dans les 7 jours est « en sommeil » (affichée en retrait dans Tâches, absente d'Aujourd'hui). Elle réapparaît dans « À préparer pour l'école » N jours avant la semaine d'école (7 par défaut, réglable). Calcul dynamique, rien n'est stocké.
- **Vue Aujourd'hui** : en retard, aujourd'hui (les tâches cochées du jour restent visibles, barrées), à préparer pour l'école, reste de la semaine, échéances des 30 prochains jours.
- **Glisser-déposer dans une liste filtrée** : seuls les éléments visibles changent de place ; les autres gardent leur position.
- **Raccourci Alt+↑/↓** en plus du glisser-déposer clavier de dnd-kit : plus direct pour réordonner.

## Capture rapide

- **Jours de semaine** : « vendredi » = la prochaine occurrence, aujourd'hui inclus. « vendredi prochain » = le vendredi de la semaine calendaire suivante.
- **Dates sans année** : prochaine occurrence (aujourd'hui inclus), donc l'année suivante si la date est passée. Le 29/02 attend la prochaine année bissextile.
- **Pas d'abréviations ambiguës** (« mer », « jeu », « sam »…) qui sont aussi des mots courants : « aller à la mer » ne doit pas créer une date.
- **Préposition absorbée** : « pour vendredi », « avant lundi », « le 5/11 » retirent aussi le petit mot du titre.
- **Première date seulement** : les suivantes restent dans le titre.
- **`@partiel`, `@rendu`… créent une échéance** (et non une tâche). Une échéance exige une date.
- La palette se ferme et le champ se vide **avant** l'écriture en base, pour pouvoir enchaîner les saisies sans attendre.

## Notes

- Markdown GFM (listes, cases à cocher, tableaux), rendu assaini par DOMPurify ; les liens s'ouvrent dans un nouvel onglet.
- **Enregistrement automatique** 400 ms après la dernière frappe, et immédiatement en quittant la note.
- Une note sans titre prend sa première ligne comme titre affiché.
- Supprimer un cours **détache** ses notes et tâches au lieu de les supprimer (et l'annulation les rattache).
- Recherche instantanée, insensible à la casse et aux accents, tous les mots requis, titre prioritaire sur le contenu.

## Revue de transition

- Proposée à partir du **vendredi de la dernière semaine** d'une période, et en rattrapage pendant les **2 premiers jours** de la suivante.
- Aucune revue n'est proposée pour une période terminée **avant la configuration** de l'app.
- « Reporter » une tâche la date au début de la prochaine période du même type.
- Le bilan est enregistré (une revue par période) et, par défaut, copié dans les notes.
- Accessible à tout moment via la palette (« Revue de transition ») : hors fenêtre, elle prépare la fin de la période en cours.

## Suppression et annulation

- La suppression est **immédiate** ; le toast « Annuler » (6 s, ou ⌘Z / Ctrl+Z) restaure l'élément tel quel. Plus simple et plus sûr qu'une suppression différée : rien n'est perdu si l'app est fermée pendant le délai, sauf si l'on a voulu supprimer.
- « Tout effacer » (Réglages) est la seule action irréversible ; elle demande une confirmation explicite.

## Interface

- **Accent selon le mode** : indigo (École), vert (Entreprise), ambre (Congé / Perso). Appliqué via des variables CSS sur `<html data-mode>`, dans les deux thèmes.
- **Thème** clair / sombre / système (par défaut), appliqué avant le premier rendu pour éviter un flash.
- **Mobile** : barre inférieure avec bouton de capture central, zones tactiles de 44 px minimum, fenêtres en feuille depuis le bas. **Ordinateur** : barre latérale.
- **Animations** de 150 à 200 ms (apparition des fenêtres et toasts), désactivées si l'utilisateur préfère réduire les animations. Pas de flou d'arrière-plan sous les fenêtres (problèmes de rendu observés avec les listes animées).
- Fenêtres basées sur `<dialog>` natif : piège du focus, Échap et inertie du fond gérés par le navigateur.

## PWA et données

- **Service worker Workbox** (vite-plugin-pwa) en mise à jour automatique ; tous les fichiers sont précachés, y compris les vues chargées à la demande.
- **Déploiement GitHub Pages** via GitHub Actions (tests puis build), avec `BASE_PATH` pour servir l'app dans un sous-dossier. HTTPS est obligatoire pour installer une PWA sur téléphone.
- **Sauvegarde JSON versionnée** (`format: "rythme-backup"`, `version: 1`), validée champ par champ à l'import. L'import remplace les données après confirmation, avec un résumé du contenu.
