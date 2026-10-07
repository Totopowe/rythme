# Rythme

Rythme aide les alternants à organiser leur vie entre école et entreprise, et leur permet de partager leur calendrier avec leur tuteur.

- **Aujourd'hui** : mode du jour (École / Entreprise) avec sa couleur, tâches, échéances, compte à rebours avant le prochain changement.
- **Calendrier annuel** : frise des périodes au jour près, corrections ponctuelles (férié, semaine décalée), absences, échéances.
- **Tâches** et **capture rapide** (<kbd>⌘K</kbd> / <kbd>Ctrl+K</kbd>, bouton central sur mobile) en langage naturel : `rendre dossier finance #ecole vendredi`.
- **Revue de transition** guidée à la fin de chaque période.
- **Partage tuteur** : lien privé, lecture seule, révocable. **Abonnement agenda** `.ics`.
- **Mesure d'usage** anonyme et page **/admin** (inscrits, actifs, rétention par cohorte, retours).
- **RGPD** : page Confidentialité, export JSON, suppression du compte en un clic.
- **PWA** installable, lecture et saisie hors ligne (synchronisées au retour du réseau).

Stack : Vite, React, TypeScript strict, Tailwind, Supabase (Auth + Postgres + RLS), fonctions Vercel, Vitest. Tout tient dans les offres gratuites.

---

## 1. Créer le projet Supabase

1. Sur [supabase.com](https://supabase.com), crée un projet (région **West EU (Paris)**). Note le mot de passe de la base.
2. **Appliquer le schéma** (tables, RLS, fonctions) depuis ce dépôt :
   ```bash
   npx supabase login
   ```
   ```bash
   npx supabase link --project-ref <ref-du-projet>
   ```
   ```bash
   npx supabase db push
   ```
   Le *ref* est l'identifiant dans l'URL du projet (`https://<ref>.supabase.co`). `link` demande le mot de passe de la base.
3. **Authentication → Sign In / Providers → Email** : laisse *Email* et *Confirm email* activés.
4. **Authentication → URL Configuration** :
   - *Site URL* : l'adresse de production (ex. `https://rythme.vercel.app`)
   - *Redirect URLs* : ajoute aussi `http://localhost:5173/**` pour le développement.
5. **Authentication → Emails → Templates** : pour *Magic Link* et *Confirm signup*, colle le contenu de `supabase/templates/magic-link.html` et l'objet `Ton code Rythme : {{ .Token }}`. L'e-mail contient ainsi un **code à 6 chiffres** (indispensable sur iPhone, où le lien s'ouvrirait hors de l'app installée) et un lien.
6. **Envoi des e-mails (SMTP)** : le service intégré de Supabase n'envoie qu'aux membres de l'équipe. Avec [Brevo](https://brevo.com) (gratuit, 300 e-mails/jour) :
   - Brevo → *Expéditeurs* → ajoute et vérifie ton adresse d'envoi ;
   - Brevo → *SMTP et API* → note le login SMTP et génère une clé SMTP ;
   - Supabase → *Authentication → Emails → SMTP Settings* : hôte `smtp-relay.brevo.com`, port `587`, identifiant = login SMTP, mot de passe = clé SMTP, expéditeur = adresse vérifiée.
   - Supabase → *Authentication → Rate Limits* : monte la limite d'e-mails à 30/heure.

## 2. Variables d'environnement

Copie `.env.example` en `.env.local` et remplis :

| Variable | Où la trouver | Utilisée par |
|---|---|---|
| `VITE_SUPABASE_URL` | Supabase → Project Settings → API | navigateur + fonctions |
| `VITE_SUPABASE_ANON_KEY` | idem, clé *anon / publishable* (publique) | navigateur + fonctions |
| `SUPABASE_SERVICE_ROLE_KEY` | idem, clé *service_role / secret* — **secrète** | `/api/admin` uniquement |
| `ADMIN_EMAIL` | ton adresse (plusieurs : séparées par des virgules) | `/api/admin` |
| `VITE_CONTACT_EMAIL` | facultatif, affichée sur la page Confidentialité | navigateur |

Aucune clé n'est écrite dans le code. Seules les variables préfixées `VITE_` (publiques) sont incluses dans le build.

## 3. Lancer en local

Prérequis : Node.js 22 LTS (ou 20.19+).

```bash
npm install
```
```bash
npm run dev
```

L'app tourne sur http://localhost:5173. Les fonctions `/api` (admin, flux `.ics`) ne tournent qu'avec `npx vercel dev` ou une fois déployées.

| Commande | Rôle |
|---|---|
| `npm test` | Tests Vitest : logique métier, synchronisation, **politiques RLS** (Postgres en mémoire via PGlite) |
| `npm run typecheck` | TypeScript strict |
| `npm run build` | Build de production + service worker |

## 4. Déployer sur Vercel

1. Sur [vercel.com](https://vercel.com), *Add New → Project* → importe ce dépôt GitHub (Vite est détecté).
2. *Settings → Environment Variables* : ajoute les 4 (ou 5) variables ci-dessus.
3. Déploie. Chaque push sur `main` redéploie ; chaque branche a son aperçu.
4. Reporte l'adresse de production dans Supabase (*Site URL*, étape 1.4).

`vercel.json` route `/cal/<jeton>.ics` vers la fonction `.ics` et toutes les autres pages vers l'app.

## 5. Installer sur téléphone

Ouvre l'adresse Vercel puis **iPhone (Safari)** : Partager → « Sur l'écran d'accueil » ; **Android (Chrome)** : ⋮ → « Installer l'application ». Connecte-toi avec le **code** reçu par e-mail.

---

## Raccourcis clavier

<kbd>?</kbd> dans l'app affiche l'aide.

| Partout | |
|---|---|
| <kbd>⌘/Ctrl</kbd> <kbd>K</kbd> | Palette : capturer, chercher, agir |
| <kbd>N</kbd> | Nouvelle tâche |
| <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> <kbd>4</kbd> | Aujourd'hui, Tâches, Calendrier, Partage |
| <kbd>,</kbd> | Réglages |
| <kbd>⌘/Ctrl</kbd> <kbd>Z</kbd> | Annuler la dernière suppression |
| **Listes de tâches** | |
| <kbd>J</kbd> <kbd>K</kbd> / flèches | Tâche suivante / précédente |
| <kbd>X</kbd> / <kbd>Espace</kbd> | Cocher |
| <kbd>E</kbd> / <kbd>Entrée</kbd> | Modifier |
| <kbd>Suppr</kbd> | Supprimer (annulable) |
| <kbd>Alt</kbd> <kbd>↑</kbd> <kbd>↓</kbd> | Monter / descendre |
| <kbd>F</kbd> | Changer de filtre |
| **Calendrier** | |
| <kbd>←</kbd> <kbd>→</kbd> / <kbd>↑</kbd> <kbd>↓</kbd> | Semaine ± 1 / ± 4 |
| <kbd>T</kbd> | Revenir à aujourd'hui |

Capture : `#ecole` `#entreprise` `#perso`, dates en toutes lettres (`vendredi`, `demain`, `12/11`, `dans 3 jours`), priorité `!` à `!!!`, `@partiel` `@rendu` `@memoire` `@reunion` pour une échéance.

## Structure

```
supabase/
├─ migrations/        Schéma versionné : tables, RLS, déclencheurs d'usage, fonctions de partage
├─ templates/         E-mail de connexion (code + lien)
└─ tests/             Tests RLS dans PGlite (Postgres WebAssembly, sans Docker)
api/                  Fonctions Vercel : ics.ts (abonnement agenda), admin.ts (statistiques)
src/
├─ domain/            Logique métier pure et testée
│  ├─ rhythm.ts, templates.ts   Rythme au jour près, modèles 3/1, 2/2, 4j/1j, 3j/2j, sur mesure
│  ├─ quickCapture.ts           Parseur de capture rapide
│  ├─ planning.ts               Réveil des tâches École, vue Aujourd'hui, revue de transition
│  ├─ ics.ts                    Génération iCalendar
│  ├─ analytics.ts              Actifs hebdomadaires, rétention par cohorte
│  └─ dates.ts, search.ts, order.ts, weekImport.ts, types.ts
├─ data/              Store synchronisé : client Supabase, instantané hors ligne, file d'écritures
├─ features/          Un dossier par écran (today, tasks, calendar, review, share, tutor, admin…)
├─ shell/             Navigation, palette ⌘K, aide des raccourcis
├─ components/        Composants d'interface (boutons, fenêtres, toasts…)
└─ hooks/             Session, données dérivées, thème, raccourcis
```

Les choix sont expliqués dans [DECISIONS.md](DECISIONS.md).
