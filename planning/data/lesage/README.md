# Catalogue École Lesage

Les 25 offres des trois catégories du site français ont été collectées : 13 Initiation, 9 Perfectionnement et 3 Spécialisation (dont le forfait des deux spécialisations).

`catalogue.json` conserve pour chaque fiche le titre, le niveau, les durées totale et unitaire, le nombre de séances, le tarif TTC, la description, les objectifs, les techniques, les informations pédagogiques et pratiques, les URL d’images, les liens annexes, l’identifiant du produit WooCommerce, la provenance et la date de collecte. Les informations sur les séminaires, proposés sur demande sans tarif ou durée fixes, sont conservées dans `seminaires.json`.

Les textes du site restent attribués à École Lesage et les liens sources figurent dans chaque fiche. Les images sont référencées par leur URL publique.

## Actualiser

Depuis `planning/` :

```sh
python3 scripts/scrape-lesage.py
node --env-file=.env --import tsx scripts/import-lesage.ts
```

La collecte échoue si une fiche est incomplète ou si ses durées ne correspondent pas au nombre de séances. L’import utilise une transaction. Les cours déjà importés sont retrouvés par identifiant produit ou titre et niveau pour éviter les doublons. Les autres cours du planning sont conservés.

L’import crée cinq profils fictifs avec des adresses réservées en `example.test`, puis répartit aléatoirement les 25 cours entre eux (cinq chacun au premier import). Leur attribution est conservée lors des réimports. L’affectation concerne le professeur par défaut du cours ; les séances déjà planifiées ne sont pas modifiées. `import-report.json` contient le résultat de l’import.

Les capacités de six élèves et la validité d’un an proviennent des informations pratiques des fiches. Les paramètres internes du planning pour les nouveaux cours restent : délai entre séances de 48 h, rappel J-1, annulation jusqu’à 48 h avant la séance. Ces trois valeurs sont des réglages du planning et ne sont pas présentées comme des règles collectées sur le site.

La section « Fiche du catalogue Lesage » a été retirée du planning. Les descriptions, techniques, informations pratiques, images, tarifs et métadonnées de provenance ne sont plus conservés en base ni réimportés. Le fichier de collecte local reste une archive de l’extraction initiale.
