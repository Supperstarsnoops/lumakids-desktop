import { anyApi } from 'convex/server';

/**
 * Références aux fonctions Convex du projet App (`App/convex/*.ts`).
 *
 * Pas de `npx convex codegen` ici : ce site est un repo séparé de l'app
 * mobile, sans accès à son dossier `convex/`. `anyApi.pairing.xxx` construit
 * la même référence que le `api.pairing.xxx` généré côté app, mais sans
 * validation de type à la compilation — un nom de fonction ou d'argument
 * mal orthographié se verrait à l'exécution (`ConvexError`), pas ici. Chaque
 * site d'appel porte un commentaire renvoyant vers la fonction réelle dans
 * `App/convex/`, pour qu'un renommage côté serveur se retrouve en cherchant
 * ce fichier.
 */
export const api = anyApi;
