import { Component, type ReactNode } from 'react';
import { clearWebSession } from '../../lib/web-session';

interface Props {
  children: ReactNode;
  onInvalidSession: () => void;
}
interface State {
  hasError: boolean;
}

/**
 * Convex `useQuery` lance l'erreur serveur PENDANT le rendu (voir
 * `convex/react/client.js`, `if (result instanceof Error) throw result`) —
 * une session locale invalide (appareil révoqué, secret corrompu) doit donc
 * être rattrapée par une error boundary, seul mécanisme React qui capture ce
 * genre d'erreur. Composant de classe : React n'a pas d'équivalent en hook.
 */
export class SessionErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch() {
    // La session stockée ne mène plus nulle part (appareil révoqué depuis
    // l'app, ou entrée corrompue) : l'effacer ramène au flux d'appairage au
    // lieu de figer la page sur une erreur.
    clearWebSession();
    this.props.onInvalidSession();
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="watch-card">
          <h2>Session expirée</h2>
          <p className="watch-muted">Cet appareil a été retiré du foyer. Réappairez-le ci-dessous.</p>
        </div>
      );
    }
    return this.props.children;
  }
}
