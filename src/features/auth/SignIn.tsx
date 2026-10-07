import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Icon } from '../../components/Icon';
import { Button, cx, inputClass } from '../../components/ui';
import { supabase } from '../../data/supabase';

const RESEND_DELAY = 60;

function friendlyError(message: string): string {
  if (/rate limit|too many|security purposes/i.test(message)) return 'Trop de demandes. Patiente une minute avant de réessayer.';
  if (/expired|invalid/i.test(message)) return 'Code incorrect ou expiré. Vérifie-le ou demande un nouveau code.';
  if (/fetch|network/i.test(message)) return 'Pas de connexion internet. Réessaie dans un instant.';
  return 'Une erreur est survenue. Réessaie dans un instant.';
}

/** Connexion sans mot de passe : un e-mail contenant un lien et un code à 6 chiffres. */
export function SignIn() {
  const [email, setEmail] = useState(() => localStorage.getItem('rythme:last-email') ?? '');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown(cooldown - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const sendCode = async (e?: FormEvent) => {
    e?.preventDefault();
    const address = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
      setError('Cette adresse e-mail ne semble pas valide.');
      return;
    }
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.signInWithOtp({
      email: address,
      options: { shouldCreateUser: true, emailRedirectTo: `${location.origin}/auth/confirm` },
    });
    setBusy(false);
    if (err) {
      setError(friendlyError(err.message));
      return;
    }
    try {
      localStorage.setItem('rythme:last-email', address);
    } catch {
      /* sans importance */
    }
    setStep('code');
    setCode('');
    setCooldown(RESEND_DELAY);
    setTimeout(() => codeRef.current?.focus(), 0);
  };

  const verify = async (value: string) => {
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token: value, type: 'email' });
    setBusy(false);
    if (err) setError(friendlyError(err.message));
    // En cas de succès, la session change et l'app s'affiche d'elle-même.
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-10">
      <div className="mb-10">
        <div className="mb-6 flex h-11 w-11 items-center justify-center rounded-xl bg-ink text-bg">
          <Icon name="calendar" size={22} />
        </div>
        <h1 className="text-[28px] font-semibold leading-tight tracking-tight">Rythme</h1>
        <p className="mt-2 text-[15px] leading-6 text-muted">
          Ton alternance, organisée. Sache toujours où tu en es entre école et entreprise, et partage ton calendrier avec ton tuteur.
        </p>
      </div>

      {step === 'email' ? (
        <form onSubmit={sendCode} className="space-y-3" noValidate>
          <label htmlFor="email" className="block text-[13px] font-medium">
            Ton adresse e-mail
          </label>
          <input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="prenom@exemple.fr"
            className={inputClass}
            aria-describedby="email-help"
          />
          <Button type="submit" variant="primary" className="w-full" disabled={busy}>
            {busy ? 'Envoi…' : 'Recevoir mon code'}
          </Button>
          <p id="email-help" className="text-xs leading-5 text-muted">
            Pas de mot de passe : tu reçois un code à usage unique. Nouveau ? Ton compte est créé automatiquement.
          </p>
        </form>
      ) : (
        <div className="space-y-3">
          <p className="text-[15px] leading-6">
            Code envoyé à <strong className="font-semibold">{email}</strong>. Saisis-le ci-dessous, ou clique sur le lien de l’e-mail.
          </p>
          <label htmlFor="code" className="sr-only">
            Code reçu par e-mail
          </label>
          <input
            ref={codeRef}
            id="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={10}
            value={code}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, '');
              setCode(v);
              if (v.length === 6) void verify(v);
            }}
            placeholder="123456"
            className={cx(inputClass, 'text-center font-mono text-2xl tracking-[0.4em] md:text-2xl')}
            disabled={busy}
          />
          <Button variant="primary" className="w-full" disabled={busy || code.length < 6} onClick={() => void verify(code)}>
            {busy ? 'Vérification…' : 'Se connecter'}
          </Button>
          <div className="flex items-center justify-between text-[13px]">
            <button type="button" className="min-h-11 text-muted hover:text-ink" onClick={() => setStep('email')}>
              Changer d’adresse
            </button>
            <button type="button" className="min-h-11 text-accent disabled:text-faint" disabled={cooldown > 0 || busy} onClick={() => void sendCode()}>
              {cooldown > 0 ? `Renvoyer dans ${cooldown} s` : 'Renvoyer le code'}
            </button>
          </div>
          <p className="text-xs leading-5 text-muted">Rien reçu ? Regarde dans les spams ou les promotions.</p>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      <p className="mt-12 text-xs text-faint">
        <a href="/confidentialite" className="underline underline-offset-2 hover:text-muted">
          Confidentialité
        </a>{' '}
        · Tes données ne sont jamais partagées ni revendues.
      </p>
    </main>
  );
}

/** Arrivée depuis le lien de l'e-mail : /auth/confirm?token_hash=…&type=email */
export function AuthConfirm() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tokenHash = params.get('token_hash');
    const type = (params.get('type') ?? 'email') as 'email' | 'magiclink' | 'signup';
    if (!tokenHash) {
      setError('Lien incomplet.');
      return;
    }
    void supabase.auth.verifyOtp({ token_hash: tokenHash, type }).then(({ error: err }) => {
      if (err) setError(friendlyError(err.message));
      else history.replaceState(null, '', '/');
    });
  }, []);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      {error ? (
        <>
          <p className="text-[15px]">{error}</p>
          <a href="/" className="text-sm font-medium text-accent">
            Demander un nouveau code
          </a>
        </>
      ) : (
        <p className="text-sm text-muted">Connexion…</p>
      )}
    </main>
  );
}
