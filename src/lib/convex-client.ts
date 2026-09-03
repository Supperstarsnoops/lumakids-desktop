import { ConvexReactClient } from 'convex/react';

/**
 * URL du déploiement Convex. Volontairement une constante et pas une
 * variable d'environnement injectée par GitHub Actions : c'est exactement la
 * même valeur que `EXPO_PUBLIC_CONVEX_URL` dans l'app mobile (`App/.env.local`)
 * — une URL publique, jamais un secret, déjà présente en clair dans le bundle
 * de l'app iOS/Android. La faire dépendre d'une variable CI aurait ajouté une
 * étape de configuration pour rien.
 *
 * À METTRE À JOUR quand le jalon 8 (« déploiement Convex prod séparé »,
 * PLAN.md §6) crée un déploiement de production distinct du déploiement dev
 * `lovely-koala-744` utilisé ici — c'est la même bascule que le futur
 * `EXPO_PUBLIC_CONVEX_URL` de production côté app.
 */
const CONVEX_URL = 'https://lovely-koala-744.convex.cloud';

/**
 * Un seul client pour toute la page /watch (voir `WatchApp`, monté une seule
 * fois avec `client:only="react"`). Recréer un `ConvexReactClient` à chaque
 * rendu rouvrirait une connexion WebSocket à chaque fois.
 */
export const convexClient = new ConvexReactClient(CONVEX_URL, {
  unsavedChangesWarning: false,
});
