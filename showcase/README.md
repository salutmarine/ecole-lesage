# Vitrine française de l’École Lesage

Copie statique du site de référence : https://ecole-lesage-refonte.mothzer.chatgpt.site/fr/

Les pages HTML françaises, les textes, les 25 cours du catalogue, les images,
le film, les feuilles de style et les modules de navigation sont conservés dans ce
dossier. Le miroir contient 331 URL françaises publiques, dont les fiches de cours
et les entrées du lexique. Les pages **ESPACE**, panier et commande ne sont pas
récupérées. Les liens vers cet espace mènent au planning existant.

Les fichiers téléchargés restent séparés du code du planning. La construction
adapte les chemins au préfixe GitHub Pages, retire les liens de langues étrangères
et les scripts techniques injectés par l’hébergeur source. Les alias des fiches de
cours renvoient au détail dans le catalogue. Les formulaires restent des interactions
de démonstration locales, comme sur le site source.

## Construire et prévisualiser

Depuis la racine du dépôt, après `npm ci` dans `planning` :

```sh
node showcase/scripts/build-site.mjs
python3 showcase/scripts/verify.py
node showcase/scripts/preview.mjs
```

Prévisualisation : http://127.0.0.1:8124/ecole-lesage/

La sortie complète est dans `showcase/.site-build/` (ignorée par Git) :

- `/showcase/fr/` : vitrine française ;
- `/planning/` : démo du planning, avec un lien « Retour au site » ;
- `/` : entrée du site complet, qui ouvre la vitrine. Les anciens liens
  `/#/teacher`, `/#/student` ou `/#/admin/planning` restent compatibles.

`PAGES_BASE_PATH` permet de remplacer `/ecole-lesage` (utiliser la même valeur
pour construire, vérifier et prévisualiser). `--showcase-only` construit la vitrine
sans reconstruire le planning. La publication GitHub Pages construit l’ensemble.

## Actualiser le miroir

```sh
python3 showcase/scripts/scrape.py
```

Le script parcourt uniquement les pages publiques sous `/fr/` et leurs ressources.
Les fichiers déjà présents sont conservés ; supprimer volontairement un fichier
précis permet de le télécharger à nouveau. `source-manifest.json` consigne les
chemins, tailles et empreintes SHA-256 des ressources récupérées. Aucun accès à
ESPACE ni récupération des données de son application n’est effectué.
