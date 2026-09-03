/**
 * Session de l'appareil « web » de ce navigateur, une fois appairé.
 *
 * Équivalent de `App/src/lib/secure-store.ts`, mais en `localStorage` : il
 * n'y a pas de trousseau système dans un navigateur, et la sécurité réelle ici
 * vient du même endroit que côté app — le secret n'est utile qu'à qui l'a
 * reçu au moment de l'appairage, jamais transmis en clair ensuite (chaque
 * appel Convex l'envoie sur une connexion chiffrée). Perdre ce `localStorage`
 * (autre navigateur, navigation privée, données de site effacées) revient à
 * perdre l'appareil : il suffit de se réappairer depuis l'app.
 */

const STORAGE_KEY = 'lumakids.webDevice';

export interface StoredWebSession {
  deviceId: string;
  secret: string;
}

export function loadWebSession(): StoredWebSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredWebSession;
  } catch {
    return null;
  }
}

export function saveWebSession(session: StoredWebSession): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearWebSession(): void {
  localStorage.removeItem(STORAGE_KEY);
}
