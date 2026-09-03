import { useState } from 'react';
import { ConvexProvider } from 'convex/react';
import { convexClient } from '../../lib/convex-client';
import { loadWebSession, clearWebSession, type StoredWebSession } from '../../lib/web-session';
import { JoinFlow } from './JoinFlow';
import { StationList } from './StationList';
import { CallView } from './CallView';
import { SessionErrorBoundary } from './SessionErrorBoundary';
import '../../styles/watch.css';

/**
 * Racine de la visionneuse web (`/watch`, PLAN.md jalon 8 : « client web,
 * l'API WebRTC native du navigateur, react-native-webrtc n'ayant pas
 * d'équivalent web »). Trois états, jamais plus d'un affiché à la fois :
 * appairage → liste des stations → appel. Montée avec `client:only="react"`
 * (voir `watch.astro`) : tout ici dépend d'API navigateur (localStorage,
 * getUserMedia, RTCPeerConnection) absentes côté serveur, un rendu SSR
 * n'aurait produit qu'une coquille vide à hydrater pour rien.
 */
export function WatchApp() {
  const [session, setSession] = useState<StoredWebSession | null>(() => loadWebSession());
  const [watching, setWatching] = useState<{ deviceId: string; name: string } | null>(null);

  const signOut = () => {
    clearWebSession();
    setWatching(null);
    setSession(null);
  };

  return (
    <ConvexProvider client={convexClient}>
      <div className="watch-shell">
        <header className="watch-header">
          <img src="/logo.png" alt="Lumakids" className="watch-logo" />
        </header>

        <main className="watch-main">
          {!session ? (
            <JoinFlow onPaired={setSession} />
          ) : (
            <SessionErrorBoundary onInvalidSession={signOut}>
              {watching ? (
                <CallView
                  session={session}
                  deviceId={watching.deviceId}
                  deviceName={watching.name}
                  onClose={() => setWatching(null)}
                />
              ) : (
                <StationList
                  session={session}
                  onWatch={(deviceId, name) => setWatching({ deviceId, name })}
                  onSignOut={signOut}
                />
              )}
            </SessionErrorBoundary>
          )}
        </main>
      </div>
    </ConvexProvider>
  );
}
