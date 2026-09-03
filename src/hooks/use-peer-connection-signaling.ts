import { useEffect, useRef } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../lib/convex-api';
import type { StoredWebSession } from '../lib/web-session';

/**
 * Port de `App/src/hooks/use-peer-connection-signaling.ts` sur l'API WebRTC
 * native du navigateur (`react-native-webrtc` n'a pas d'équivalent web, voir
 * PLAN.md jalon 8). Même protocole de signalisation que l'app : les candidats
 * ICE locaux partent vers Convex (`calls.submitIceCandidate`), ceux de l'autre
 * participant arrivent en réactif (`calls.watchRemoteIceCandidates`) et sont
 * appliqués une seule fois chacun.
 *
 * Pas besoin ici du contournement de typage `asIceEventTarget` de l'app :
 * c'est un vrai `RTCPeerConnection` du navigateur, ses événements sont
 * correctement typés nativement.
 */
export function usePeerConnectionSignaling(
  pc: RTCPeerConnection | null,
  callId: string | null,
  session: StoredWebSession | null
) {
  const submitIceCandidate = useMutation(api.calls.submitIceCandidate);
  const remoteCandidates = useQuery(
    api.calls.watchRemoteIceCandidates,
    session && callId ? { deviceId: session.deviceId, secret: session.secret, callId } : 'skip'
  ) as
    | { candidateId: string; candidate: string; sdpMid: string | null; sdpMLineIndex: number | null }[]
    | undefined;
  const appliedIds = useRef(new Set<string>());

  useEffect(() => {
    if (!pc || !session || !callId) return;

    const handleIceCandidate = (event: RTCPeerConnectionIceEvent) => {
      if (!event.candidate) return;
      submitIceCandidate({
        deviceId: session.deviceId,
        secret: session.secret,
        callId,
        candidate: event.candidate.candidate,
        sdpMid: event.candidate.sdpMid ?? null,
        sdpMLineIndex: event.candidate.sdpMLineIndex ?? null,
      }).catch(() => {});
    };
    pc.addEventListener('icecandidate', handleIceCandidate);
    return () => {
      pc.removeEventListener('icecandidate', handleIceCandidate);
    };
  }, [pc, session, callId, submitIceCandidate]);

  useEffect(() => {
    if (!pc || !remoteCandidates) return;
    for (const candidate of remoteCandidates) {
      if (appliedIds.current.has(candidate.candidateId)) continue;
      appliedIds.current.add(candidate.candidateId);
      pc.addIceCandidate({
        candidate: candidate.candidate,
        sdpMid: candidate.sdpMid,
        sdpMLineIndex: candidate.sdpMLineIndex,
      }).catch(() => {});
    }
  }, [pc, remoteCandidates]);
}
