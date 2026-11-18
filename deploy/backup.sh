#!/usr/bin/env bash
# Νυχτερινό αντίγραφο ασφαλείας του App_Data (SQLite λογαριασμών/προόδου + gamification.json).
#
# Το API σταματά για λίγα δευτερόλεπτα, ώστε το αντίγραφο της SQLite να είναι συνεπές,
# και ξαναξεκινά πάντα, ακόμη κι αν κάτι αποτύχει. Το .env (AUTH_SIGNING_KEY) ΔΕΝ μπαίνει
# στο αντίγραφο: φύλαξέ το χωριστά.
#
# Ρυθμίσεις (μεταβλητές περιβάλλοντος, όλες προαιρετικές):
#   PROJECT_DIR  φάκελος με το compose.yaml        (προεπιλογή: ο γονικός του deploy/)
#   BACKUP_DIR   πού αποθηκεύονται τα αντίγραφα    (προεπιλογή: ~/aepp-backups)
#   KEEP_DAYS    πόσες μέρες κρατάμε αντίγραφα     (προεπιλογή: 14)
#
# Χειροκίνητα:  ./deploy/backup.sh
# Επαναφορά:     δες την ενότητα «Αυτόματο αντίγραφο ασφαλείας» στο deploy/README.md.

set -euo pipefail

PROJECT_DIR="${PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
BACKUP_DIR="${BACKUP_DIR:-$HOME/aepp-backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"

log() { printf '%s %s\n' "$(date '+%F %T')" "$*"; }
fail() { log "ΣΦΑΛΜΑ: $*" >&2; exit 1; }

[[ "$KEEP_DAYS" =~ ^[0-9]+$ && "$KEEP_DAYS" -ge 1 ]] || fail "Το KEEP_DAYS πρέπει να είναι θετικός ακέραιος."
[[ -f "$PROJECT_DIR/compose.yaml" ]] || fail "Δεν βρέθηκε compose.yaml στο $PROJECT_DIR."

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

# Ένα αντίγραφο τη φορά (flock στο Linux· αλλιώς φάκελος-κλειδαριά).
lock_dir=""
if command -v flock >/dev/null; then
  exec 9>"$BACKUP_DIR/.lock"
  flock -n 9 || fail "Τρέχει ήδη άλλο αντίγραφο."
else
  lock_dir="$BACKUP_DIR/.lock.d"
  mkdir "$lock_dir" 2>/dev/null || fail "Τρέχει ήδη άλλο αντίγραφο (αν όχι, σβήσε το $lock_dir)."
fi

cd "$PROJECT_DIR"
compose() { docker compose "$@"; }

stamp="$(date '+%F_%H%M%S')"
work="$(mktemp -d "$BACKUP_DIR/.work-$stamp-XXXX")"
archive="$BACKUP_DIR/app-data-$stamp.tar.gz"

api_was_running=false
if [[ -n "$(compose ps --status running --quiet api)" ]]; then api_was_running=true; fi

cleanup() {
  rm -rf "$work"
  [[ -n "$lock_dir" ]] && rmdir "$lock_dir" 2>/dev/null
  if $api_was_running && [[ -z "$(compose ps --status running --quiet api)" ]]; then
    log "Επανεκκίνηση του API."
    compose start api >/dev/null || log "ΠΡΟΣΟΧΗ: το API δεν ξεκίνησε· έλεγξε με: docker compose ps"
  fi
}
trap cleanup EXIT

log "Αντίγραφο ασφαλείας → $archive"
if $api_was_running; then
  log "Προσωρινή παύση του API για συνεπές αντίγραφο της SQLite."
  compose stop api >/dev/null
fi

compose cp api:/app/App_Data "$work/App_Data" || fail "Η αντιγραφή του App_Data από το container απέτυχε."

if $api_was_running; then
  compose start api >/dev/null
  log "Το API ξεκίνησε ξανά."
fi

[[ -s "$work/App_Data/accounts.sqlite" ]] || fail "Λείπει ή είναι άδειο το accounts.sqlite· το αντίγραφο δεν αποθηκεύτηκε."

tar -czf "$archive.partial" -C "$work" App_Data
tar -tzf "$archive.partial" >/dev/null || fail "Το αρχείο αντιγράφου δεν διαβάζεται."
mv "$archive.partial" "$archive"
chmod 600 "$archive"
log "Ολοκληρώθηκε: $(du -h "$archive" | cut -f1)."

# Διαγραφή παλιών αντιγράφων (μόνο αρχεία που έφτιαξε αυτό το script).
find "$BACKUP_DIR" -maxdepth 1 -type f -name 'app-data-*.tar.gz' -mtime +"$((KEEP_DAYS - 1))" -print -delete \
  | while read -r old; do log "Διαγράφηκε παλιό αντίγραφο: $(basename "$old")"; done

log "Αντίγραφα που υπάρχουν: $(find "$BACKUP_DIR" -maxdepth 1 -type f -name 'app-data-*.tar.gz' | wc -l)."
