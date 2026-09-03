// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

// https://astro.build/config
export default defineConfig({
	site: 'https://lu-ma-kids.com',
	// React n'habille qu'une seule page (/watch, voir src/pages/watch.astro) :
	// le reste du site reste du Astro statique pur. La visionneuse a besoin
	// d'un vrai state machine (code → attente → liste → appel) et doit
	// reproduire fidèlement la logique WebRTC/Convex de l'app mobile — un
	// paquet d'îlots vanilla-JS aurait divergé de ce code au premier correctif
	// oublié d'un côté.
	integrations: [react()],
});
