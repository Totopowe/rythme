# Décisions — Rythme V1

La V1 doit prouver une seule chose : **les alternants l'utilisent encore après 4 semaines.** Chaque choix ci-dessous est pesé à cette aune, avec un budget nul.

## Périmètre

- **La V1 repart de la version locale (tag `v0`)** : logique de rythme, parseur de capture, réveil des tâches, revue, interface et raccourcis sont réutilisés.
- **Notes Markdown retirées.** Absentes du cahier des charges ; chaque écran en plus dilue le test de rétention. Le bilan de revue reste conservé et relisible.
- **Onglet « Partage »** dans la navigation principale à la place des notes : le lien tuteur est ce qui rend Rythme utile au-delà de l'alternant, et ce que les écoles paieront demain.

## Architecture

- **Supabase en direct depuis le navigateur**, protégé par la RLS. Pas de serveur applicatif. Deux fonctions Vercel seulement : le flux `.ics` (les agendas ne savent pas appeler Supabase) et `/admin` (clé `service_role`, jamais exposée au navigateur).
- **Une seule logique métier en TypeScript**, partagée par l'app, la page tuteur, le flux `.ics` et le calcul de rétention. Postgres stocke le rythme brut (motif + corrections) et ne recalcule rien : aucune logique dupliquée en SQL.
- **Toutes les données de l'alternant en mémoire** (quelques centaines de lignes) : chargées au démarrage, écritures optimistes. L'app est aussi rapide que la version locale.
- **Hors ligne** : instantané des données dans `localStorage` (lecture immédiate), file d'écritures persistée, compactée (modifications successives fusionnées, création + suppression hors ligne annulées) et rejouée au retour du réseau. Les créations sont des *upserts* par identifiant généré côté client : rejouer est sans danger. Une écriture refusée par le serveur est abandonnée, signalée par un toast, et l'app se recale sur l'état du serveur.
- **Routage par chemins** (`/calendrier`, `/t/<jeton>`) avec réécriture Vercel vers `index.html`.
- **Imports `.js` dans les modules métier partagés avec les fonctions Vercel** : en ESM, Vercel transpile fichier par fichier ; les imports sans extension échoueraient à l'exécution. Vérifié par une simulation de cette transpilation.

## Données et sécurité

- **RLS sur toutes les tables**, politique unique « le propriétaire est `auth.uid()` ». `user_id` a `auth.uid()` pour valeur par défaut : le client ne l'envoie jamais.
- **Le rôle anonyme n'a accès à aucune table.** La page tuteur et le flux `.ics` passent par deux fonctions `SECURITY DEFINER` qui ne renvoient que les champs autorisés.
- **Colonnes protégées** : seul un sous-ensemble du profil est modifiable (pas l'identifiant d'analyse ni l'école/promo rattachée) ; un lien de partage ne peut être modifié que pour être révoqué.
- **Jetons de partage** : 192 bits aléatoires (32 caractères), un seul actif par type, révocables et régénérables. Ils sont stockés en clair, lisibles par leur seul propriétaire, pour que l'alternant puisse recopier son lien depuis n'importe quel appareil. Un stockage par empreinte n'aurait protégé que d'une fuite de la base, qui exposerait de toute façon bien plus.
- **Page tuteur** : prénom, école, rythme, *dates et type* des absences visibles (jamais leur précision), échéances explicitement partagées (titre, type, date). Jamais de tâches ni de bilans. En-têtes `noindex` et `Referrer-Policy: no-referrer` pour que le lien ne fuite pas.
- **Absences visibles par défaut, échéances masquées par défaut** : un tuteur a besoin de savoir quand l'alternant est absent ; une échéance peut être personnelle.
- **Écoles et promos** : tables `schools` et `cohorts` créées dès maintenant, `profiles.school_id` / `cohort_id` nuls en V1. Rattacher un alternant plus tard ne demandera aucune refonte ; aucun accès n'est ouvert pour l'instant.
- **Tests RLS sans Docker** : les migrations sont appliquées dans PGlite (Postgres compilé en WebAssembly) avec une reproduction minimale de Supabase (rôles `anon`/`authenticated`, `auth.uid()`, droits par défaut). 41 tests vérifient l'isolation entre comptes, les refus du rôle anonyme, le contenu exact de la page tuteur, les événements et la suppression du compte. Ils tournent dans `npm test`.

## Authentification

- **Lien magique + code à 6 chiffres dans le même e-mail.** Sur une PWA installée sur iPhone, un lien s'ouvre dans Safari et non dans l'app : le code évite ce piège et reste rapide (saisie automatique `one-time-code`).
- **Brevo comme SMTP** (pas de domaine pour l'instant). Limite connue : les e-mails envoyés depuis une adresse Gmail via un service tiers peuvent tomber en spam ; l'écran de connexion le signale. Passer à un domaine + Resend le jour venu ne demande qu'un changement de réglage Supabase.
- **Profil créé par déclencheur** à l'inscription ; l'onboarding ne fait que le compléter.

## Rythme

- **Motif au jour près** : une liste de semaines de 5 jours ouvrés. Couvre 3/1, 2/2, 4 j/1 j, 3 j/2 j et le sur-mesure avec un seul modèle. Le week-end prend le mode du vendredi.
- **Jour d'école par défaut** : vendredi pour 4 j/1 j, jeudi + vendredi pour 3 j/2 j, modifiables à l'onboarding.
- **Corrections par jour** (`day_overrides`) : un férié, une semaine décalée (5 jours) ou un jour isolé. Une correction identique au motif est supprimée au lieu d'être stockée.
- **Périodes = suites de semaines de même mode dominant.** Pour un rythme par jours, il n'y a donc pas de « fin de période » chaque semaine : la revue de transition ne se déclenche qu'aux vrais changements (congés, blocs école), et reste accessible à tout moment depuis la palette.
- **Compte à rebours au jour près** ; en entreprise, on annonce la prochaine école même si un congé s'intercale.

## Onboarding (objectif : moins de 60 secondes)

- E-mail → code → **2 écrans** : prénom + école, puis modèle de rythme + date de début avec un aperçu jour par jour en direct. Arrivée directe sur le **calendrier rempli**, avec un bandeau d'explication.
- L'école est un texte libre en V1 (pas d'annuaire) : zéro friction ; le rattachement formel viendra avec les écoles clientes.

## Mesure d'usage

- **Événements produits par la base** (déclencheurs) : inscription (fin d'onboarding), tâche créée, tâche terminée, revue complétée, lien tuteur créé. Fiables même quand l'app rejoue des écritures faites hors ligne, et impossibles à falsifier depuis le client (la table `events` est fermée en écriture directe).
- **Connexion** : au plus un événement par jour et par personne (`log_login()` au lancement de l'app).
- **Anonymisable** : chaque événement porte un identifiant aléatoire (`analytics_id`), pas l'identifiant du compte. À la suppression du compte, le lien disparaît et les événements deviennent anonymes : les statistiques de rétention restent justes.
- **Rétention à la semaine N** : part d'une cohorte (semaine d'inscription) active entre J+7N et J+7N+6 après sa propre inscription. Une cellule n'est affichée que lorsque la fenêtre est terminée pour toute la cohorte. La rétention globale est pondérée par la taille des cohortes mesurables.
- **Aucun outil tiers** de mesure.

## RGPD

- Page Confidentialité courte, publique, en langage clair.
- **Export** : toutes les données de l'alternant en JSON (Réglages).
- **Suppression** en un clic (+ une confirmation) : une fonction SQL supprime l'utilisateur d'`auth.users`, la cascade efface tout ; les avis restent mais détachés du compte ; les événements, déjà anonymes, perdent leur dernier lien.
- Copie locale effacée à la déconnexion et à la suppression.

## Interface

- Reprise du système de la v0 : accent selon le mode (indigo École, vert Entreprise, ambre Congé), thème système par défaut, palette ⌘K, aide « ? », toasts « Annuler », animations de 150 à 200 ms, zones tactiles de 44 px.
- **« Donner mon avis »** dans la barre latérale, la barre du haut sur mobile et la palette. Envoyé directement en base (pas de file hors ligne : un message d'erreur clair et le texte conservé si le réseau manque).
- **Invitation au partage** sur Aujourd'hui tant qu'aucun lien tuteur n'existe, masquable.
- **/admin** : tuiles de chiffres clés, histogramme des actifs par semaine (une couleur, info-bulle au survol), tableau de rétention en nuances d'une seule teinte, retours reçus.
