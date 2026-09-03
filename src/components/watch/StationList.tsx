import { useQuery } from 'convex/react';
import { api } from '../../lib/convex-api';
import type { StoredWebSession } from '../../lib/web-session';

type DeviceRow = {
  deviceId: string;
  role: 'parent' | 'baby';
  name: string;
};

/** Voir `App/src/app/(tabs)/(home)/index.tsx` (`ParentHome`) : même source,
 * `devices.listDevices` + `calls.watchHouseholdLiveStatus` pour le badge EN
 * DIRECT. Réglages de la Station Bébé elle-même (veilleuse, vision nocturne)
 * volontairement absents ici — PLAN.md limite la visionneuse web à
 * « surveillance (son + parole) », ces réglages restent l'affaire de l'app.
 * Le Picture-in-Picture, lui, est un réglage du spectateur : voir
 * `CallView.tsx`. */
export function StationList({
  session,
  onWatch,
  onSignOut,
}: {
  session: StoredWebSession;
  onWatch: (deviceId: string, name: string) => void;
  onSignOut: () => void;
}) {
  const devices = useQuery(api.devices.listDevices, {
    deviceId: session.deviceId,
    secret: session.secret,
  }) as DeviceRow[] | undefined;
  const liveStatus = useQuery(api.calls.watchHouseholdLiveStatus, {
    deviceId: session.deviceId,
    secret: session.secret,
  }) as { calleeDeviceId: string; viewerCount: number }[] | undefined;

  const babyDevices = (devices ?? []).filter((d) => d.role === 'baby');
  const liveByDevice = new Map((liveStatus ?? []).map((s) => [s.calleeDeviceId, s.viewerCount]));

  return (
    <div className="watch-card watch-card-wide">
      <div className="watch-list-header">
        <h2>Stations Bébé</h2>
        <button className="watch-link" onClick={onSignOut}>
          Se déconnecter
        </button>
      </div>

      {devices === undefined ? (
        <p className="watch-muted">Chargement…</p>
      ) : babyDevices.length === 0 ? (
        <p className="watch-muted">
          Aucune Station Bébé dans ce foyer pour le moment. Ajoutez-en une depuis l’app.
        </p>
      ) : (
        <ul className="watch-station-list">
          {babyDevices.map((device) => {
            const viewerCount = liveByDevice.get(device.deviceId) ?? 0;
            return (
              <li key={device.deviceId} className="watch-station-row">
                <div className="watch-station-info">
                  <span className="watch-station-name">{device.name}</span>
                  <span className="watch-muted">
                    {viewerCount > 0 ? `En direct · ${viewerCount} spectateur(s)` : 'Inactif'}
                  </span>
                </div>
                <button className="watch-button watch-button-small" onClick={() => onWatch(device.deviceId, device.name)}>
                  Regarder
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
