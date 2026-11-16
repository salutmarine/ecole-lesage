# École Lesage — Planning

Démo publique : https://salutmarine.github.io/ecole-lesage/

Le site complet s’ouvre sur la vitrine française, conservée dans le dossier
[`showcase`](showcase/README.md). « Mes cours & réservations » mène à la démo
du planning : https://salutmarine.github.io/ecole-lesage/planning/.
La vitrine et le planning sont publiés ensemble en fichiers statiques, avec leurs
sources séparées. Pour construire l’ensemble : `node showcase/scripts/build-site.mjs`.

## Démo autonome GitHub Pages

La démo affiche une mire de connexion fictive : `admin`, `prof` ou `etudiant`
permettent de choisir un rôle, avec un mot de passe prérempli sans vérification.
Aucun compte réel ni connexion à un service externe n’est nécessaire. Les réservations et les pointages de la démonstration sont
conservés dans le `localStorage` du navigateur et ne sont jamais partagés entre
visiteurs. Le stockage désactivé est pris en charge en mémoire jusqu’au rechargement.
Le bouton « Réinitialiser ma démo » restaure les données de départ.

La démo réutilise les composants et styles de l’application locale : espaces
administrateur, étudiant et professeur, formulaires de gestion, calendrier, pointage
et export PDF. Le logo est servi avec les fichiers statiques ; l’interface utilise la police Manrope. Le bouton « Se déconnecter » ramène à la mire sans effacer les réservations locales.
La navigation utilise des fragments d’URL (`#/admin/planning`) pour fonctionner sur
GitHub Pages, y compris après un rechargement.
La démo charge l’instantané de la base locale enregistré dans
`planning/data/lesage/local-demo.json` : profils, cours, achats, créneaux,
réservations, pointages, attributions de professeurs et indisponibilités. Les
identifiants et les liens entre les données sont conservés. Le choix des comptes
étudiant et professeur reprend les comptes de démonstration de la base locale.
Chaque nouvel instantané utilise une clé de stockage distincte pour apparaître dès
la publication ; « Réinitialiser ma démo » restaure cet instantané.

Pour actualiser les données avant publication :

```sh
cd planning
npm run export:demo
```

Cette commande lit la base configurée dans `.env` et produit le fichier suivi par
Git, qui sera inclus dans le site public. GitHub Actions utilise ce fichier et
n’accède pas à la base locale. Les secrets de configuration ne sont pas exportés.
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

## Prise en charge des élèves par les professeurs

L’espace professeur conserve un calendrier de tous les créneaux et leurs détails.
L’onglet « Organiser ma journée » présente les créneaux d’une journée
(heure de Paris) et les élèves inscrits, filtrables par cours et niveau. Le professeur
sélectionne les élèves qu’il prend en charge ; plusieurs professeurs peuvent se
partager un créneau. Aucun élève n’est attribué automatiquement à partir de l’ancien
professeur du créneau. La fiche professeur dans l’administration reflète ces prises
en charge individuelles.

Seul le professeur ayant pris en charge un élève peut faire son appel. Un élève
non pointé peut être libéré avant la fin de la séance. Un déplacement ou un
changement de cours retire la prise en charge afin de permettre une nouvelle
répartition. Les prises en charge concurrentes sont vérifiées dans une transaction.

Après récupération de ces changements, synchroniser le schéma de la base locale :

```sh
cd planning
npm run db:push
```

Les tests de démonstration ne nécessitent pas de base. `npm run test:teacher`
utilise la base PostgreSQL configurée dans `planning/.env` pour vérifier les
conflits de prise en charge, la libération et les déplacements ; il crée puis
supprime ses propres données de test.
