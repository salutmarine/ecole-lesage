# École Lesage — Planning

Démo publique : https://salutmarine.github.io/ecole-lesage/

## Démo autonome GitHub Pages

La démo s’ouvre sans connexion. Les réservations et les pointages sont fictifs,
conservés dans le `localStorage` du navigateur et ne sont jamais partagés entre
visiteurs. Le stockage désactivé est pris en charge en mémoire jusqu’au rechargement.
Le bouton « Réinitialiser ma démo » restaure les données de départ.

La démo comprend l’espace étudiant (réserver, déplacer, annuler et consulter ses
crédits), une vue du planning et un espace professeur pour tester le pointage.
Les formulaires d’administration du serveur ne font pas partie de la version statique.
Les cours proviennent du catalogue du projet ; les personnes et les créneaux sont
fictifs. Le calendrier de démonstration couvre le mois courant et les cinq mois suivants.
Aucun serveur, compte, secret, paiement ou envoi d’email n’est utilisé par la démo.

```sh
cd planning
npm ci
npm run test:demo
npm run build:demo
```

Le résultat se trouve dans `planning/.pages-build/out`. Le script copie les composants
existants dans un projet Next.js temporaire, remplace les appels API par un adaptateur
local et produit un export statique. L’application serveur d’origine reste disponible
avec `npm run dev` et sa configuration habituelle.

Le workflow `.github/workflows/pages.yml` reconstruit et publie la démo à chaque
modification de `planning/` sur `main`. Dans les paramètres GitHub du dépôt,
**Settings → Pages → Source** doit être réglé sur **GitHub Actions**.
Le chemin `/ecole-lesage` est géré par `basePath` ; `PAGES_BASE_PATH` permet de l’adapter.
