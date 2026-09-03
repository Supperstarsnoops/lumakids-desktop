import { useEffect, useRef, useState } from 'react';
import { useOutgoingCall } from '../../hooks/use-outgoing-call';
import type { StoredWebSession } from '../../lib/web-session';

/**
 * Écran de surveillance en direct depuis le navigateur. Plus simple que
 * `App/src/app/(tabs)/(home)/call/[calleeDeviceId].tsx` sur un point : pas de
 * zoom, veilleuse ni vision nocturne ici — PLAN.md limite la visionneuse web
 * à « surveillance (son + parole) », et ces réglages-là sont posés sur la
 * Station Bébé elle-même (`convex/night.ts`), pas sur ce qui regarde. Le
 * Picture-in-Picture, lui, EST un réglage du spectateur (comme sur l'app), et
 * le navigateur en a une vraie API standard — voir `togglePip` ci-dessous.
 */

/**
 * `HTMLVideoElement` standard n'expose que l'API W3C
 * (`requestPictureInPicture`, déjà dans `lib.dom.d.ts`). Safari suit encore
 * son ancienne API "mode de présentation" (`webkitSupportsPresentationMode` /
 * `webkitSetPresentationMode`), absente des typings DOM — d'où cette
 * extension locale plutôt qu'un `as any` à chaque site d'appel.
 */
interface SafariPipVideoElement extends HTMLVideoElement {
  webkitSupportsPresentationMode?: (mode: 'picture-in-picture') => boolean;
  webkitSetPresentationMode?: (mode: 'picture-in-picture' | 'inline') => void;
  webkitPresentationMode?: 'picture-in-picture' | 'inline';
}

export function CallView({
  session,
  deviceId,
  deviceName,
  onClose,
}: {
  session: StoredWebSession;
  deviceId: string;
  deviceName: string;
  onClose: () => void;
}) {
  const { status, remoteStream, end, isTalking, startTalking, stopTalking } = useOutgoingCall(
    deviceId,
    session
  );
  const [isMuted, setIsMuted] = useState(false);
  const [isPip, setIsPip] = useState(false);
  const [pipSupported, setPipSupported] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = remoteStream;
  }, [remoteStream]);

  // Vérifié après le premier rendu (pas dans un `useState` paresseux) : sur
  // Safari, la disponibilité dépend de l'élément vidéo lui-même
  // (`webkitSupportsPresentationMode`), qui n'existe qu'une fois le `<video>`
  // monté.
  useEffect(() => {
    const video = videoRef.current as SafariPipVideoElement | null;
    const standard = document.pictureInPictureEnabled;
    const safari = typeof video?.webkitSupportsPresentationMode === 'function';
    setPipSupported(standard || safari);
  }, [remoteStream]);

  // Le bouton doit refléter un PiP fermé depuis la fenêtre flottante
  // elle-même (sa propre croix) et pas seulement celui fermé par ce bouton.
  useEffect(() => {
    const video = videoRef.current as SafariPipVideoElement | null;
    if (!video) return;
    const onEnter = () => setIsPip(true);
    const onLeave = () => setIsPip(false);
    const onSafariModeChange = () => setIsPip(video.webkitPresentationMode === 'picture-in-picture');
    video.addEventListener('enterpictureinpicture', onEnter);
    video.addEventListener('leavepictureinpicture', onLeave);
    video.addEventListener('webkitpresentationmodechanged', onSafariModeChange);
    return () => {
      video.removeEventListener('enterpictureinpicture', onEnter);
      video.removeEventListener('leavepictureinpicture', onLeave);
      video.removeEventListener('webkitpresentationmodechanged', onSafariModeChange);
    };
  }, [remoteStream]);

  // Sortir automatiquement de la fenêtre flottante en quittant l'appel :
  // sinon le PiP continuerait d'afficher un flux dont la connexion vient
  // d'être fermée.
  useEffect(() => {
    return () => {
      if (document.pictureInPictureElement) document.exitPictureInPicture().catch(() => {});
    };
  }, []);

  const togglePip = async () => {
    const video = videoRef.current as SafariPipVideoElement | null;
    if (!video) return;
    try {
      if (typeof video.webkitSetPresentationMode === 'function') {
        // Safari : pas de promesse, l'état se lit via l'événement ci-dessus.
        video.webkitSetPresentationMode(
          video.webkitPresentationMode === 'picture-in-picture' ? 'inline' : 'picture-in-picture'
        );
        return;
      }
      if (document.pictureInPictureElement === video) {
        await document.exitPictureInPicture();
      } else {
        await video.requestPictureInPicture();
      }
    } catch {
      // Refusé par le navigateur (geste utilisateur manquant, autre PiP déjà
      // ouvert) : le bouton reste actionnable, pas d'état à corriger.
    }
  };

  const toggleMute = () => {
    const nextMuted = !isMuted;
    remoteStream?.getAudioTracks().forEach((track) => {
      track.enabled = !nextMuted;
    });
    setIsMuted(nextMuted);
  };

  const handleEnd = async () => {
    await end();
    onClose();
  };

  const isLive = remoteStream !== null;

  return (
    <div className="watch-call">
      <div className="watch-call-header">
        <span>{deviceName}</span>
        <button className="watch-link watch-link-light" onClick={handleEnd}>
          Fermer
        </button>
      </div>

      <div className="watch-video-wrapper">
        {isLive ? (
          // eslint-disable-next-line jsx-a11y/media-has-caption -- flux live, pas de piste de sous-titres possible.
          <video ref={videoRef} className="watch-video" autoPlay playsInline />
        ) : (
          <p className="watch-video-status">
            {status === 'failed' ? 'Connexion impossible.' : 'Connexion en cours…'}
          </p>
        )}
      </div>

      <div className="watch-call-controls">
        <button className="watch-round-button" onClick={toggleMute} aria-pressed={isMuted}>
          {isMuted ? '🔇' : '🔊'}
        </button>
        {pipSupported && (
          <button
            className="watch-round-button"
            onClick={togglePip}
            disabled={!isLive}
            aria-pressed={isPip}
            aria-label="Fenêtre flottante">
            🗗
          </button>
        )}
        <button
          className={`watch-talk-button${isTalking ? ' watch-talk-button-active' : ''}`}
          disabled={!isLive}
          onMouseDown={startTalking}
          onMouseUp={stopTalking}
          onMouseLeave={stopTalking}
          onTouchStart={(event) => {
            event.preventDefault();
            startTalking();
          }}
          onTouchEnd={(event) => {
            event.preventDefault();
            stopTalking();
          }}
          aria-label="Maintenir pour parler">
          🎤
        </button>
        <button className="watch-round-button watch-round-button-danger" onClick={handleEnd} aria-label="Terminer">
          ✕
        </button>
      </div>
    </div>
  );
}
