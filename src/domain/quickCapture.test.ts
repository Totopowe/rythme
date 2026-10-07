import { describe, expect, it } from 'vitest';
import { parseCapture } from './quickCapture';

// Mercredi 7 octobre 2026.
const TODAY = '2026-10-07';
const parse = (s: string) => parseCapture(s, TODAY);

describe('parseCapture — exemple de référence', () => {
  it('« rendre dossier finance #ecole vendredi »', () => {
    const r = parse('rendre dossier finance #ecole vendredi');
    expect(r.title).toBe('Rendre dossier finance');
    expect(r.context).toBe('ecole');
    expect(r.dueDate).toBe('2026-10-09');
    expect(r.priority).toBe(0);
    expect(r.deadlineKind).toBeNull();
  });
});

describe('contexte', () => {
  it.each([
    ['#ecole', 'ecole'],
    ['#école', 'ecole'],
    ['#École', 'ecole'],
    ['#cours', 'ecole'],
    ['#entreprise', 'entreprise'],
    ['#boulot', 'entreprise'],
    ['#taf', 'entreprise'],
    ['#perso', 'perso'],
  ])('%s → %s', (tag, ctx) => {
    expect(parse(`tâche ${tag}`).context).toBe(ctx);
  });

  it('laisse un hashtag inconnu dans le titre', () => {
    const r = parse('lire #react docs');
    expect(r.context).toBeNull();
    expect(r.title).toBe('Lire #react docs');
  });

  it('garde le premier contexte reconnu', () => {
    expect(parse('a #perso #ecole').context).toBe('perso');
  });

  it('accepte le contexte en début de saisie', () => {
    const r = parse('#entreprise point avec tuteur');
    expect(r.context).toBe('entreprise');
    expect(r.title).toBe('Point avec tuteur');
  });
});

describe('dates relatives', () => {
  it.each([
    ["appeler aujourd'hui", '2026-10-07'],
    ['appeler aujourd’hui', '2026-10-07'],
    ['appeler auj', '2026-10-07'],
    ['appeler ce soir', '2026-10-07'],
    ['appeler demain', '2026-10-08'],
    ['appeler après-demain', '2026-10-09'],
    ['appeler apres demain', '2026-10-09'],
    ['appeler dans 3 jours', '2026-10-10'],
    ['appeler dans 3j', '2026-10-10'],
    ['appeler dans une semaine', '2026-10-14'],
    ['appeler dans 2 semaines', '2026-10-21'],
    ['appeler semaine prochaine', '2026-10-12'],
    ['appeler fin du mois', '2026-10-31'],
  ])('%s → %s', (input, date) => {
    const r = parse(input);
    expect(r.dueDate).toBe(date);
    expect(r.title).toBe('Appeler');
  });
});

describe('jours de la semaine', () => {
  it.each([
    ['lundi', '2026-10-12'],
    ['mardi', '2026-10-13'],
    ['mercredi', '2026-10-07'], // aujourd'hui inclus
    ['jeudi', '2026-10-08'],
    ['vendredi', '2026-10-09'],
    ['samedi', '2026-10-10'],
    ['dimanche', '2026-10-11'],
    ['Vendredi', '2026-10-09'],
  ])('%s → %s', (day, date) => {
    expect(parse(`réviser ${day}`).dueDate).toBe(date);
  });

  it('« vendredi prochain » vise la semaine suivante', () => {
    expect(parse('réviser vendredi prochain').dueDate).toBe('2026-10-16');
    expect(parse('réviser lundi prochain').dueDate).toBe('2026-10-12');
  });

  it('retire la préposition qui précède la date', () => {
    expect(parse('finir slides pour vendredi').title).toBe('Finir slides');
    expect(parse('envoyer CV avant lundi').title).toBe('Envoyer CV');
    expect(parse('payer loyer le 5/11').title).toBe('Payer loyer');
  });

  it('ne confond pas les mots courants avec des jours', () => {
    const r = parse('aller à la mer avec Sam');
    expect(r.dueDate).toBeNull();
    expect(r.title).toBe('Aller à la mer avec Sam');
  });
});

describe('dates absolues', () => {
  it.each([
    ['12/10', '2026-10-12'],
    ['7/10', '2026-10-07'],
    ['3/10', '2027-10-03'], // déjà passé → année suivante
    ['12/03/2027', '2027-03-12'],
    ['12-03-27', '2027-03-12'],
    ['12 mars', '2027-03-12'],
    ['1er décembre', '2026-12-01'],
    ['15 oct', '2026-10-15'],
    ['5 mai 2028', '2028-05-05'],
  ])('%s → %s', (input, date) => {
    expect(parse(`partiel ${input}`).dueDate).toBe(date);
  });

  it('ignore les dates invalides', () => {
    expect(parse('truc 31/02').dueDate).toBeNull();
    expect(parse('truc 31/02').title).toBe('Truc 31/02');
    expect(parse('truc 45 mars').dueDate).toBeNull();
  });

  it('gère le 29 février', () => {
    expect(parse('x 29/02').dueDate).toBe('2028-02-29');
  });

  it('ne garde que la première date', () => {
    const r = parse('préparer oral lundi demain');
    expect(r.dueDate).toBe('2026-10-12');
    expect(r.title).toBe('Préparer oral demain');
  });

  it('ne prend pas un nombre seul pour une date', () => {
    const r = parse('lire 3 chapitres');
    expect(r.dueDate).toBeNull();
    expect(r.title).toBe('Lire 3 chapitres');
  });
});

describe('priorité', () => {
  it.each([
    ['!', 1],
    ['!!', 2],
    ['!!!', 3],
    ['!1', 1],
    ['!3', 3],
  ])('%s → %i', (tok, prio) => {
    const r = parse(`tâche ${tok}`);
    expect(r.priority).toBe(prio);
    expect(r.title).toBe('Tâche');
  });

  it('garde un point d’exclamation collé au texte', () => {
    expect(parse('super idée!').title).toBe('Super idée!');
    expect(parse('super idée!').priority).toBe(0);
  });
});

describe('échéances', () => {
  it('reconnaît @partiel, @rendu, @mémoire, @réunion', () => {
    expect(parse('compta @partiel 12/11').deadlineKind).toBe('partiel');
    expect(parse('dossier @rendu').deadlineKind).toBe('rendu');
    expect(parse('chapitre 2 @mémoire').deadlineKind).toBe('memoire');
    expect(parse('bilan @réunion').deadlineKind).toBe('reunion');
    expect(parse('truc @echeance').deadlineKind).toBe('autre');
  });

  it('laisse un @ inconnu dans le titre', () => {
    expect(parse('mail @paul').deadlineKind).toBeNull();
    expect(parse('mail @paul').title).toBe('Mail @paul');
  });
});

describe('combinaisons et cas limites', () => {
  it('combine tout dans n’importe quel ordre', () => {
    const r = parse('!!! #entreprise demain préparer démo client');
    expect(r).toMatchObject({
      title: 'Préparer démo client',
      context: 'entreprise',
      dueDate: '2026-10-08',
      priority: 3,
    });
    expect(r.matches.map((m) => m.type).sort()).toEqual(['context', 'date', 'priority']);
  });

  it('rapporte le texte reconnu pour l’aperçu', () => {
    const r = parse('finir slides pour vendredi #ecole');
    expect(r.matches).toContainEqual({ type: 'date', text: 'pour vendredi' });
    expect(r.matches).toContainEqual({ type: 'context', text: '#ecole' });
  });

  it('gère une saisie vide ou faite uniquement de méta-données', () => {
    expect(parse('').title).toBe('');
    expect(parse('   ').title).toBe('');
    const r = parse('#perso demain');
    expect(r.title).toBe('');
    expect(r.context).toBe('perso');
  });

  it('normalise les espaces', () => {
    expect(parse('  lire   un   livre  ').title).toBe('Lire un livre');
  });
});
