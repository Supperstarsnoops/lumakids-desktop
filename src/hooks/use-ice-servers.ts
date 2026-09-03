import { useCallback } from 'react';
import { useAction } from 'convex/react';
import { api } from '../lib/convex-api';
import type { StoredWebSession } from '../lib/web-session';

/** Voir `App/convex/calls.ts` : `getIceServers` (action) — jetons TURN
 * Cloudflare Calls de courte durée, mêmes serveurs que l'app mobile. */
export function useIceServers(session: StoredWebSession | null) {
  const getIceServersAction = useAction(api.calls.getIceServers);

  return useCallback(async () => {
    if (!session) {
      throw new Error('Appareil non authentifié');
    }
    const { iceServers } = await getIceServersAction({
      deviceId: session.deviceId,
      secret: session.secret,
    });
    return iceServers as RTCIceServer[];
  }, [session, getIceServersAction]);
}
