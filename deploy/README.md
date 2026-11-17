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

Χρησιμοποίησε νέο όνομα φακέλου για κάθε αντίγραφο. Κράτησε αντίγραφο εκτός server και φύλαξε χωριστά το AUTH_SIGNING_KEY. Η παραπάνω διαδικασία είναι χειροκίνητη· δεν έχει εγκατασταθεί αυτόματο backup. Πριν από πραγματικούς μαθητές χρειάζεται δοκιμή επαναφοράς σε ξεχωριστό περιβάλλον.

## Τεκμηρίωση

- https://learn.microsoft.com/aspnet/core/host-and-deploy/proxy-load-balancer
- https://caddyserver.com/docs/automatic-https
- https://caddyserver.com/docs/caddyfile/patterns
