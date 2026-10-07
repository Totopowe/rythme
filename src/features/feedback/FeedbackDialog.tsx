import { useState } from 'react';
import { useLocation } from 'wouter';
import { Modal } from '../../components/Modal';
import { useToast } from '../../components/Toast';
import { Button, cx, inputClass } from '../../components/ui';
import { supabase } from '../../data/supabase';

/** « Donner mon avis » : un message libre enregistré en base, lu sur /admin. */
export function FeedbackDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} label="Donner mon avis">
      {open && <FeedbackForm onClose={onClose} />}
    </Modal>
  );
}

function FeedbackForm({ onClose }: { onClose: () => void }) {
  const [location] = useLocation();
  const toast = useToast();
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    if (!message.trim()) return;
    setSending(true);
    setError(null);
    const { error: err } = await supabase.from('feedback').insert({ message: message.trim().slice(0, 5000), page: location.slice(0, 200) });
    setSending(false);
    if (err) {
      setError('Envoi impossible pour le moment (connexion ?). Ton message est conservé, réessaie dans un instant.');
      return;
    }
    toast.show('Merci ! Ton avis a bien été envoyé.');
    onClose();
  };

  return (
    <div className="space-y-4 p-5">
      <div>
        <h2 className="text-lg font-semibold">Donner mon avis</h2>
        <p className="mt-1 text-sm text-muted">Un bug, une idée, un truc qui agace ? Chaque message est lu.</p>
      </div>
      <textarea
        autoFocus
        rows={5}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void send();
        }}
        maxLength={5000}
        aria-label="Ton message"
        placeholder="J’aimerais que Rythme…"
        className={cx(inputClass, 'py-2 leading-6')}
      />
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Annuler
        </Button>
        <Button variant="primary" onClick={() => void send()} disabled={sending || !message.trim()}>
          {sending ? 'Envoi…' : 'Envoyer'}
        </Button>
      </div>
    </div>
  );
}
