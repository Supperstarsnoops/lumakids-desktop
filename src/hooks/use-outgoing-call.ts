import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../lib/convex-api';
import type { StoredWebSession } from '../lib/web-session';
import { useIceServers } from './use-ice-servers';
import { usePeerConnectionSignaling } from './use-peer-connection-signaling';

export type OutgoingCallStatus = 'connecting' | 'ringing' | 'active' | 'ended' | 'failed';

/**
 * Port de `App/src/hooks/use-outgoing-call.ts` sur `RTCPeerConnection` natif du
 * navigateur (`react-native-webrtc` n'a pas d'équivalent web, voir PLAN.md
 * jalon 8) — même protocole de signalisation Convex, mêmes règles côté offre :
 * vidéo en réception seule, audio `sendrecv` dès le départ sans piste, pour
 * que « parler à bébé » n'ait jamais besoin de renégocier.
 */
export function useOutgoingCall(calleeDeviceId: string | null, session: StoredWebSession | null) {
  const getIceServers = useIceServers(session);
  const startCall = useMutation(api.calls.startCall);
  const endCallMutation = useMutation(api.calls.endCall);
  const pingCall = useMutation(api.calls.pingCall);

  const [pc, setPc] = useState<RTCPeerConnection | null>(null);
  const [callId, setCallId] = useState<string | null>(null);
  const [localStatus, setLocalStatus] = useState<'connecting' | 'ringing' | 'failed' | 'ended'>(
    'connecting'
  );
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const answerAppliedRef = useRef(false);
  const startedRef = useRef(false);

  const audioTransceiverRef = useRef<RTCRtpTransceiver | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const wantsTalkRef = useRef(false);
  const acquiringMicRef = useRef(false);
  const [isTalking, setIsTalking] = useState(false);

  const call = useQuery(
    api.calls.watchCall,
    session && callId ? { deviceId: session.deviceId, secret: session.secret, callId } : 'skip'
  ) as
    | { status: string; answer?: string }
    | undefined;

  usePeerConnectionSignaling(pc, callId, session);

  const status: OutgoingCallStatus = useMemo(() => {
    if (localStatus === 'ended' || localStatus === 'failed') return localStatus;
    if (call?.status === 'ended' || call?.status === 'declined' || call?.status === 'missed') {
      return 'ended';
    }
    if (call?.answer) return 'active';
    return localStatus;
  }, [localStatus, call]);

  useEffect(() => {
    if (!session || !calleeDeviceId || startedRef.current) return;
    startedRef.current = true;
    let cancelled = false;

    (async () => {
      try {
        const iceServers = await getIceServers();
        if (cancelled) return;

        const connection = new RTCPeerConnection({ iceServers });
        connection.ontrack = (event) => {
          setRemoteStream(event.streams[0] ?? null);
        };
        connection.onconnectionstatechange = () => {
          if (connection.connectionState === 'failed' || connection.connectionState === 'closed') {
            setLocalStatus('failed');
          }
        };
        connection.addTransceiver('video', { direction: 'recvonly' });
        audioTransceiverRef.current = connection.addTransceiver('audio', { direction: 'sendrecv' });

        const offer = await connection.createOffer();
        await connection.setLocalDescription(offer);
        setPc(connection);

        const { callId: newCallId } = await startCall({
          deviceId: session.deviceId,
          secret: session.secret,
          calleeDeviceId,
          sdp: offer.sdp,
        });
        if (cancelled) return;
        setCallId(newCallId);
        setLocalStatus('ringing');
      } catch {
        if (!cancelled) setLocalStatus('failed');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session, calleeDeviceId, getIceServers, startCall]);

  useEffect(() => {
    if (!pc || !call?.answer || answerAppliedRef.current) return;
    answerAppliedRef.current = true;
    pc.setRemoteDescription({ type: 'answer', sdp: call.answer });
  }, [call, pc]);

  useEffect(() => {
    if (status !== 'active' || !callId || !session) return;
    const interval = setInterval(() => {
      pingCall({ deviceId: session.deviceId, secret: session.secret, callId }).catch(() => {});
    }, 15_000);
    return () => clearInterval(interval);
  }, [status, callId, session, pingCall]);

  /** Maintenir pour parler — voir le commentaire équivalent côté app pour le
   * détail : micro ouvert seulement à l'appui, posé sur l'émetteur déjà
   * négocié (`replaceTrack`), donc sans renégociation ni coupure vidéo. */
  const startTalking = useCallback(async () => {
    wantsTalkRef.current = true;
    setIsTalking(true);

    const transceiver = audioTransceiverRef.current;
    if (!transceiver) return;

    if (!micStreamRef.current && !acquiringMicRef.current) {
      acquiringMicRef.current = true;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        micStreamRef.current = stream;
        const track = stream.getAudioTracks()[0];
        if (track) {
          track.enabled = false;
          await transceiver.sender.replaceTrack(track);
        }
      } catch {
        wantsTalkRef.current = false;
        setIsTalking(false);
        return;
      } finally {
        acquiringMicRef.current = false;
      }
    }

    micStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = wantsTalkRef.current;
    });
    if (!wantsTalkRef.current) setIsTalking(false);
  }, []);

  const stopTalking = useCallback(() => {
    wantsTalkRef.current = false;
    micStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = false;
    });
    setIsTalking(false);
  }, []);

  const releaseMicrophone = useCallback(() => {
    wantsTalkRef.current = false;
    micStreamRef.current?.getTracks().forEach((track) => track.stop());
    micStreamRef.current = null;
  }, []);

  const end = useCallback(async () => {
    releaseMicrophone();
    if (session && callId) {
      await endCallMutation({ deviceId: session.deviceId, secret: session.secret, callId }).catch(
        () => {}
      );
    }
    pc?.close();
    setLocalStatus('ended');
  }, [session, callId, endCallMutation, pc, releaseMicrophone]);

  /** Voir le commentaire équivalent côté app : lu via une ref pour que le
   * nettoyage au démontage voie le `callId` le plus récent, pas celui capturé
   * au montage (`pc` existe avant `callId`, qui n'arrive qu'une fois
   * `startCall` résolu). */
  const teardownRef = useRef({ pc, session, callId, status, endCallMutation });
  useEffect(() => {
    teardownRef.current = { pc, session, callId, status, endCallMutation };
  });

  useEffect(() => {
    return () => {
      micStreamRef.current?.getTracks().forEach((track) => track.stop());
      micStreamRef.current = null;
      const teardown = teardownRef.current;
      teardown.pc?.close();
      if (teardown.status === 'ended') return;
      if (teardown.session && teardown.callId) {
        teardown
          .endCallMutation({
            deviceId: teardown.session.deviceId,
            secret: teardown.session.secret,
            callId: teardown.callId,
          })
          .catch(() => {});
      }
    };
  }, []);

  return { status, remoteStream, end, isTalking, startTalking, stopTalking };
}
