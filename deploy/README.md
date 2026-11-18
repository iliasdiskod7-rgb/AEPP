# Δοκιμαστική εγκατάσταση

Η εγκατάσταση χρησιμοποιεί έναν Linux server με Docker Engine και Compose v2, ένα domain και ανοικτές θύρες TCP 80/443 (προαιρετικά UDP 443). Το DNS A πρέπει να δείχνει στον server. Πρόσθεσε AAAA μόνο αν λειτουργεί και το IPv6. Το domain γράφεται χωρίς https:// ή διαδρομή.

## Αρχική εκκίνηση

Από τη ρίζα του project στον server:

```sh
cp deploy/.env.example .env
chmod 600 .env
openssl rand -base64 32
```

Συμπλήρωσε στο `.env` το SITE_DOMAIN, το ACME_EMAIL και το παραγόμενο AUTH_SIGNING_KEY. Μην κοινοποιείς το κλειδί και μην ανεβάζεις το `.env` στο Git. Δεν απαιτείται κλειδί Gemini για τη δημόσια έκδοση.

```sh
docker compose up -d --build
docker compose ps
docker compose logs --tail=100 api web
curl --fail https://aepphub.gr/api/health
```

Αντικατάστησε το παράδειγμα domain με το δικό σου. Ο Caddy εκδίδει και ανανεώνει το πιστοποιητικό HTTPS. Το API δεν εκθέτει θύρα στον server. Το frontend χτίζεται με VITE_USE_DEMO=false και /api στο ίδιο domain. Η βαθμολόγηση περιλαμβάνει το Node.js runtime και το παραγόμενο grade.mjs.

Η βάση δημιουργείται και ενημερώνεται αυτόματα κατά την εκκίνηση. Η εγκατάσταση ξεκινά με νέα δοκιμαστικά δεδομένα· δεν αντιγράφει το τοπικό App_Data. Το volume app_data κρατά λογαριασμούς, προσπάθειες και πρόοδο μεταξύ επανεκκινήσεων και rebuild. Τα caddy_data/caddy_config κρατούν τα πιστοποιητικά. Μην εκτελείς docker compose down -v: διαγράφει τα volumes.

Το ιδιωτικό δίκτυο χρησιμοποιεί το 172.29.80.0/24 και ο έμπιστος proxy το 172.29.80.2. Αν υπάρχει σύγκρουση στον server, άλλαξε μαζί subnet, ipv4_address και ReverseProxy__KnownProxy. Μην επιτρέπεις forwarded headers από οποιονδήποτε proxy.

## Έλεγχος πριν δοθεί ο σύνδεσμος

1. Επιβεβαίωσε HTTPS, ανακατεύθυνση από HTTP και φόρτωση εσωτερικής σελίδας μετά από ανανέωση.
2. Δημιούργησε δοκιμαστικό λογαριασμό, συνδέσου, ολοκλήρωσε διαγώνισμα με βαθμολόγηση κώδικα και αποθήκευσε σημείωση.
3. Εκτέλεσε docker compose restart api και επιβεβαίωσε ότι τα δεδομένα παραμένουν μετά από νέα σύνδεση.
4. Έλεγξε δεύτερο λογαριασμό και επιβεβαίωσε ότι δεν βλέπει τις προσωπικές προσπάθειες/σημειώσεις του πρώτου.

## Χειροκίνητο αντίγραφο πριν από ενημέρωση

Για συνεπές αντίγραφο SQLite και τυχόν συνοδευτικών αρχείων, σταμάτησε προσωρινά το API:

```sh
mkdir -p backups
chmod 700 backups
docker compose stop api
docker compose cp api:/app/App_Data ./backups/app-data-before-update
docker compose start api
```

Χρησιμοποίησε νέο όνομα φακέλου για κάθε αντίγραφο. Κράτησε αντίγραφο εκτός server και φύλαξε χωριστά το AUTH_SIGNING_KEY. Για αυτόματο νυχτερινό αντίγραφο δες την επόμενη ενότητα. Πριν από πραγματικούς μαθητές χρειάζεται δοκιμή επαναφοράς σε ξεχωριστό περιβάλλον.

## Αυτόματο αντίγραφο ασφαλείας

Το `deploy/backup.sh` σταματά το API για λίγα δευτερόλεπτα, αντιγράφει το `App_Data` (SQLite και gamification), το ξαναξεκινά και αποθηκεύει συμπιεσμένο αρχείο `app-data-ΗΜΕΡΟΜΗΝΙΑ.tar.gz`. Το API ξαναξεκινά και όταν κάτι αποτύχει. Κρατά τα αντίγραφα των τελευταίων 14 ημερών στο `~/aepp-backups` (αλλάζουν με `KEEP_DAYS` και `BACKUP_DIR`). Το `.env` δεν μπαίνει στο αντίγραφο.

Δοκιμή μία φορά με το χέρι, από τη ρίζα του project:

```sh
chmod +x deploy/backup.sh
./deploy/backup.sh
ls -lh ~/aepp-backups
```

Εγκατάσταση ώστε να τρέχει κάθε βράδυ στις 03:30 (ο χρήστης πρέπει να μπορεί να εκτελεί `docker`):

```sh
crontab -e
```

και πρόσθεσε τη γραμμή, με τη δική σου διαδρομή του project:

```cron
30 3 * * * /home/ΧΡΗΣΤΗΣ/AEPP/deploy/backup.sh >> /home/ΧΡΗΣΤΗΣ/aepp-backups/backup.log 2>&1
```

Έλεγχος την επόμενη μέρα: `tail -n 20 ~/aepp-backups/backup.log`. Τα αντίγραφα βρίσκονται στον ίδιο server· αντέγραψε περιοδικά τα πιο πρόσφατα αλλού (π.χ. `scp` στον υπολογιστή σου ή σε cloud storage).

### Επαναφορά από αντίγραφο

Αντικαθιστά όλα τα τρέχοντα δεδομένα με αυτά του αντιγράφου. Πάρε πρώτα νέο αντίγραφο της τρέχουσας κατάστασης.

```sh
./deploy/backup.sh
docker compose stop api
docker compose run --rm --no-deps --user root -v "$HOME/aepp-backups:/backups:ro" --entrypoint sh api \
  -c 'rm -rf /app/App_Data/* && tar -xzf /backups/app-data-ΗΜΕΡΟΜΗΝΙΑ.tar.gz -C /app && chown -R node:node /app/App_Data'
docker compose start api
```

Το `chown` χρειάζεται επειδή το API τρέχει ως χρήστης `node`. Το αντίγραφο λειτουργεί μόνο με το ίδιο AUTH_SIGNING_KEY· με διαφορετικό κλειδί οι χρήστες πρέπει να συνδεθούν ξανά.

## Τεκμηρίωση

- https://learn.microsoft.com/aspnet/core/host-and-deploy/proxy-load-balancer
- https://caddyserver.com/docs/automatic-https
- https://caddyserver.com/docs/caddyfile/patterns
