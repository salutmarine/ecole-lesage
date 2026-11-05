# Rappels par email

Dans Gestion des cours, « Envoyer un rappel à J-X » définit le nombre de jours avant la séance. Une valeur vide désactive l’envoi ; 0 signifie le jour du cours. Les dates sont interprétées en heure de Paris.

Configurer les variables suivantes dans l’environnement du serveur (ne pas les committer) :

- `SMTP_HOST` : serveur SMTP.
- `SMTP_PORT` : 587 par défaut, ou 465 pour TLS immédiat.
- `SMTP_USER` et `SMTP_PASSWORD` : identifiants du service email.
- `MAIL_FROM` : adresse d’expédition autorisée par le service email.
- `CRON_SECRET` : secret aléatoire réservé au planificateur.

Planifier un appel horaire à `GET /api/cron/reminders` avec l’en-tête `Authorization: Bearer <CRON_SECRET>`. Aucun envoi ne se produit tant que le service SMTP et ce planificateur ne sont pas configurés. La route renvoie 503 lorsque la configuration est absente.

Seules les réservations confirmées de séances futures et non bloquées sont concernées. Les envois réussis sont mémorisés par réservation et date de séance pour éviter les doublons lors des appels successifs ou concurrents. Un échec d’envoi est réessayé au prochain appel le même jour. Un arrêt entre l’acceptation SMTP et l’enregistrement en base peut entraîner un nouvel envoi ; SMTP ne garantit pas une livraison exactement une fois.

Les réglages de capacité s’appliquent par défaut aux nouveaux créneaux. Les créneaux existants conservent leur capacité. Les délais d’annulation suivent le cours actuellement affecté à la séance. Les tarifs du catalogue ont été retirés de la base du planning.
