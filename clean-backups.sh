#!/usr/bin/env bash
set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m'

SCAN_DIRS=("$HOME/.claude" "$HOME/.cursor")
BACKUP_PATTERN='*.backup.[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]_[0-9][0-9][0-9][0-9][0-9][0-9]'

# Collect all backup files sorted ascending (oldest first).
# Within each original-path group the last entry will be the newest,
# because the timestamp suffix sorts lexicographically.
all_backups=()
while IFS= read -r line; do
  all_backups+=("$line")
done < <(
  for dir in "${SCAN_DIRS[@]}"; do
    if [ -d "$dir" ]; then
      find "$dir" -maxdepth 2 -name "$BACKUP_PATTERN" 2>/dev/null
    fi
  done | sort
)

if [ "${#all_backups[@]}" -eq 0 ]; then
  printf "${YELLOW}No backups found in ${SCAN_DIRS[*]}.${NC}\n"
  exit 0
fi

# Group files by their original path (strip .backup.YYYYMMDD_HHMMSS suffix).
# Walk through the sorted list; whenever the original path changes we know
# the previous group is complete.  Within a group every entry except the
# last (newest) is a candidate for deletion.
to_delete=()

current_original=""
current_group=()

flush_group() {
  local count="${#current_group[@]}"
  if [ "$count" -ge 2 ]; then
    # Keep the last element (newest); mark the rest for deletion.
    local i
    for (( i = 0; i < count - 1; i++ )); do
      to_delete+=("${current_group[$i]}")
    done
  fi
}

for backup in "${all_backups[@]}"; do
  original="${backup%.backup.*}"
  if [ "$original" != "$current_original" ]; then
    # New group — flush the previous one first.
    if [ -n "$current_original" ]; then
      flush_group
    fi
    current_original="$original"
    current_group=("$backup")
  else
    current_group+=("$backup")
  fi
done
# Flush the final group.
if [ -n "$current_original" ]; then
  flush_group
fi

if [ "${#to_delete[@]}" -eq 0 ]; then
  printf "${GREEN}Nothing to clean — every original path has at most one backup.${NC}\n"
  exit 0
fi

printf "${YELLOW}The following backup files will be deleted (oldest copies only):${NC}\n\n"
for f in "${to_delete[@]}"; do
  printf "  %s\n" "$f"
done
printf "\n%d file(s) will be deleted.\n\n" "${#to_delete[@]}"

printf "${YELLOW}Proceed? [y/N]:${NC} "
read -r input || true

case "$input" in
  y|Y)
    ;;
  *)
    printf "${YELLOW}Aborted. Nothing deleted.${NC}\n"
    exit 0
    ;;
esac

for f in "${to_delete[@]}"; do
  rm "$f"
  printf "${GREEN}Deleted:${NC} %s\n" "$f"
done

printf "\n${GREEN}Done. %d backup file(s) removed.${NC}\n" "${#to_delete[@]}"
