# GitHub Pages pour Desktop — Plan d'implementation

**Objectif :** Publier automatiquement le site Astro `Desktop` sur GitHub Pages avec le domaine personnalise `lu-ma-kids.com`.

**Architecture :** GitHub Actions construit le projet Astro a chaque push sur `main`, puis deploie le dossier `dist` avec l'action officielle GitHub Pages. Astro sera configure pour le domaine racine et un fichier `CNAME` declarera le domaine personnalise.

**Stack technique :** Astro, npm, GitHub Actions, GitHub Pages, DNS du provider.

---

## Tache 1 : Configurer Astro et le domaine

**Fichiers :**
- Modifier : `C:\Users\Rasha\Downloads\Mes projets tech\Lumakids\Desktop\astro.config.mjs`
- Creer : `C:\Users\Rasha\Downloads\Mes projets tech\Lumakids\Desktop\public\CNAME`

**Etapes :**
1. Definir `site: 'https://lu-ma-kids.com'` dans Astro.
2. Ajouter `lu-ma-kids.com` dans `public/CNAME`.
3. Executer `npm run build` depuis `Desktop`.
4. Commiter la configuration.

## Tache 2 : Automatiser le deploiement

**Fichier :**
- Creer : `C:\Users\Rasha\Downloads\Mes projets tech\Lumakids\Desktop\.github\workflows\deploy.yml`

**Etapes :**
1. Declencher le workflow sur les push de `main` et manuellement.
2. Construire Astro avec Node.js 22 et `npm ci`.
3. Publier `dist` avec `actions/deploy-pages`.
4. Pousser le commit vers `origin/main`.

## Tache 3 : Configurer le provider DNS

**A conserver absolument :** tous les enregistrements `MX`, `TXT` SPF, DKIM et DMARC.

**A ajouter ou modifier uniquement pour le site :**
- `@` de type `A` vers `185.199.108.153`
- `@` de type `A` vers `185.199.109.153`
- `@` de type `A` vers `185.199.110.153`
- `@` de type `A` vers `185.199.111.153`
- `www` de type `CNAME` vers `supperstarsnoops.github.io`

Si `www` existe deja en CNAME, modifier sa valeur au lieu de creer un doublon. Ne pas remplacer un `MX` par un CNAME.

## Validation

- `npm run build` doit se terminer sans erreur.
- `git status` doit etre propre apres le push.
- Dans GitHub : Settings > Pages > Source = GitHub Actions.
- Dans GitHub Pages : ajouter `lu-ma-kids.com` comme domaine personnalise et attendre la validation HTTPS.
