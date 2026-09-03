import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../lib/convex-api';
import { saveWebSession, type StoredWebSession } from '../../lib/web-session';

type Stage = 'form' | 'pending';

/**
 * Appairage du navigateur comme un appareil « web » du foyer, avec le même
 * protocole que l'app mobile (`App/src/app/onboarding/join-code.tsx` +
 * `pending.tsx`, fusionnés ici en un seul composant) : un parent de l'app
 * génère un code à 6 chiffres depuis Réglages ▸ Ajouter un appareil, ce
 * navigateur le saisit, puis attend l'approbation en réactif.
 *
 * `requesterToken` est un identifiant que CE navigateur invente lui-même —
 * avant l'appairage, il n'a aucune identité connue de Convex, donc rien
 * d'autre à présenter tant que la demande n'est pas approuvée.
 */
export function JoinFlow({ onPaired }: { onPaired: (session: StoredWebSession) => void }) {
  const [stage, setStage] = useState<Stage>('form');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const handledRef = useRef(false);

  const requesterToken = useMemo(() => crypto.randomUUID(), []);

  // Voir `App/convex/pairing.ts` : submitPairingRequest / watchPairingSessionStatus / acknowledgePairing.
  const submitPairingRequest = useMutation(api.pairing.submitPairingRequest);
  const acknowledgePairing = useMutation(api.pairing.acknowledgePairing);
  const status = useQuery(
    api.pairing.watchPairingSessionStatus,
    stage === 'pending' && sessionId ? { sessionId, requesterToken } : 'skip'
  ) as
    | { status: 'awaiting_approval' | 'rejected' | 'expired' | 'locked' }
    | { status: 'approved'; issuedDeviceId: string; issuedSecretOnce: string }
    | undefined;

  // Effet et non calcul pendant le rendu : `saveWebSession`/`onPaired` sont
  // des effets de bord, les déclencher au fil du rendu romprait la règle de
  // pureté de React (et pourrait s'exécuter deux fois en mode strict).
  useEffect(() => {
    if (status?.status !== 'approved' || handledRef.current || !sessionId) return;
    handledRef.current = true;
    const session: StoredWebSession = { deviceId: status.issuedDeviceId, secret: status.issuedSecretOnce };
    saveWebSession(session);
    // Le secret ne doit pas traîner en base au-delà de la fenêtre de remise ;
    // best-effort, l'appairage est déjà acquis à ce stade.
    acknowledgePairing({ sessionId, requesterToken }).catch(() => {});
    onPaired(session);
  }, [status, sessionId, requesterToken, acknowledgePairing, onPaired]);

  const submit = async () => {
    if (code.length !== 6 || isSubmitting) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const { sessionId: newSessionId } = await submitPairingRequest({
        manualCode: code,
        requesterToken,
        name: name.trim() || 'Navigateur',
        platform: 'web',
      });
      setSessionId(newSessionId);
      setStage('pending');
    } catch {
      setError('Ce code est invalide, expiré, ou a déjà été utilisé.');
      setIsSubmitting(false);
    }
  };

  if (stage === 'pending') {
    const message =
      status?.status === 'rejected'
        ? 'La demande a été refusée depuis l’app.'
        : status?.status === 'expired'
          ? 'Le code a expiré. Générez-en un nouveau depuis l’app.'
          : status?.status === 'locked'
            ? 'Trop de tentatives, ce code est verrouillé.'
            : null;

    return (
      <div className="watch-card">
        {message ? (
          <p className="watch-error">{message}</p>
        ) : (
          <>
            <div className="watch-spinner" aria-hidden="true" />
            <h2>En attente d’approbation</h2>
            <p className="watch-muted">
              Ouvrez l’app sur un téléphone déjà connecté au foyer pour approuver ce navigateur.
            </p>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="watch-card">
      <h2>Rejoindre votre foyer</h2>
      <p className="watch-muted">
        Dans l’app, allez dans Réglages ▸ Ajouter un appareil ▸ Inviter un parent, puis saisissez le
        code ici.
      </p>

      <input
        className="watch-code-input"
        inputMode="numeric"
        maxLength={6}
        placeholder="000000"
        value={code}
        onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
      />
      <input
        className="watch-text-input"
        placeholder="Nom de cet appareil (facultatif)"
        value={name}
        onChange={(event) => setName(event.target.value)}
        maxLength={40}
      />

      {error && <p className="watch-error">{error}</p>}

      <button className="watch-button" disabled={code.length !== 6 || isSubmitting} onClick={submit}>
        {isSubmitting ? 'Envoi…' : 'Continuer'}
      </button>
    </div>
  );
}
