import type { ReactNode } from 'react';
import { Link } from 'wouter';
import { Icon } from '../../components/Icon';

const contact = import.meta.env.VITE_CONTACT_EMAIL as string | undefined;

/** Politique de confidentialité : courte, en clair, accessible sans compte. */
export function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-5 pb-16 pt-[max(2rem,env(safe-area-inset-top))]">
      <Link href="/" className="inline-flex min-h-11 items-center gap-1 text-sm text-muted hover:text-ink">
        <Icon name="chevronLeft" size={16} /> Rythme
      </Link>
      <h1 className="mt-4 text-[28px] font-semibold tracking-tight">Confidentialité</h1>
      <p className="mt-2 text-[15px] leading-7 text-muted">
        Rythme est un projet en phase de test. Tes données servent uniquement à faire fonctionner l’app pour toi. Elles ne sont ni vendues, ni partagées, ni
        utilisées pour de la publicité.
      </p>

      <Block title="Quelles données ?">
        <ul className="list-disc space-y-1 pl-5">
          <li>Ton adresse e-mail, pour te connecter.</li>
          <li>Ton prénom, ton école et ton rythme d’alternance.</li>
          <li>Ce que tu saisis : tâches, échéances, absences, bilans de période, avis envoyés.</li>
          <li>
            Une mesure d’usage minimale : un type d’événement (connexion, tâche créée ou terminée, revue faite, lien tuteur créé) et sa date, rattachés à un
            identifiant aléatoire, pas à ton nom ni à ton e-mail.
          </li>
        </ul>
        <p className="mt-2">Aucun cookie publicitaire, aucun outil de suivi tiers.</p>
      </Block>

      <Block title="Pourquoi ?">
        Pour t’afficher ton calendrier, synchroniser tes appareils et, avec la mesure d’usage anonyme, savoir si l’app est utile et l’améliorer.
      </Block>

      <Block title="Où sont-elles stockées ?">
        <ul className="list-disc space-y-1 pl-5">
          <li>Dans une base de données Supabase hébergée dans l’Union européenne (Paris).</li>
          <li>Une copie est gardée dans ton navigateur pour que l’app fonctionne hors ligne. Elle est effacée à la déconnexion.</li>
          <li>L’app est servie par Vercel ; les e-mails de connexion sont envoyés par Brevo, qui ne reçoit que ton adresse e-mail.</li>
        </ul>
      </Block>

      <Block title="Qui peut les voir ?">
        Toi seul. Si tu crées un lien pour ton tuteur, il voit uniquement ton prénom, ton école, tes périodes école / entreprise, les dates de tes absences et
        les échéances que tu as choisi de partager. Jamais tes tâches ni tes bilans. Tu peux révoquer ce lien à tout moment.
      </Block>

      <Block title="Combien de temps ?">Tant que ton compte existe. Quand tu le supprimes, tout est effacé immédiatement et définitivement.</Block>

      <Block title="Tes droits">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong className="font-medium text-ink">Récupérer tes données</strong> : Réglages → Exporter mes données (fichier JSON).
          </li>
          <li>
            <strong className="font-medium text-ink">Tout supprimer</strong> : Réglages → Supprimer mon compte.
          </li>
          <li>
            Une question ? {contact ? <a className="text-accent underline-offset-2 hover:underline" href={`mailto:${contact}`}>{contact}</a> : 'Utilise le bouton « Donner mon avis ».'} Tu peux aussi
            saisir la <a className="text-accent underline-offset-2 hover:underline" href="https://www.cnil.fr/fr/plaintes" target="_blank" rel="noreferrer">CNIL</a>.
          </li>
        </ul>
      </Block>
    </main>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-[15px] font-semibold">{title}</h2>
      <div className="mt-2 text-[15px] leading-7 text-muted">{children}</div>
    </section>
  );
}
