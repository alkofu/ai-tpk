#!/usr/bin/env bash
set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

SCAN_DIRS=("$HOME/.claude" "$HOME/.cursor")
BACKUP_PATTERN='*.backup.[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]_[0-9][0-9][0-9][0-9][0-9][0-9]'

backups=()
while IFS= read -r line; do
  backups+=("$line")
done < <(
  for dir in "${SCAN_DIRS[@]}"; do
    if [ -d "$dir" ]; then
      find "$dir" -maxdepth 2 -name "$BACKUP_PATTERN" 2>/dev/null
    fi
  done | sort -r
)

if [ "${#backups[@]}" -eq 0 ]; then
  # shellcheck disable=SC2059  # ANSI colour escape mixed with format specifiers
  printf "${YELLOW}No backups found in ${SCAN_DIRS[*]}.${NC}\n"
  exit 0
fi

# shellcheck disable=SC2059  # ANSI colour escape mixed with format specifiers
printf "${BLUE}Discovered backups (newest first):${NC}\n\n"

for i in "${!backups[@]}"; do
  backup="${backups[$i]}"
  # Strip the .backup.YYYYMMDD_HHmmSS suffix to get the original path
  original="${backup%.backup.*}"
  # Extract the timestamp suffix: YYYYMMDD_HHmmSS
  suffix="${backup##*.backup.}"
  # Parse: YYYYMMDD_HHmmSS
  ts_date="${suffix%%_*}"
  ts_time="${suffix##*_}"
  YYYY="${ts_date:0:4}"
  MM="${ts_date:4:2}"
  DD="${ts_date:6:2}"
  HH="${ts_time:0:2}"
  mm="${ts_time:2:2}"
  SS="${ts_time:4:2}"
  human_ts="${YYYY}-${MM}-${DD} ${HH}:${mm}:${SS}"
  printf "  ${GREEN}[%d]${NC} %s\n      Restores to: %s\n      Timestamp:   %s\n\n" \
    "$((i + 1))" "$backup" "$original" "$human_ts"
done

# shellcheck disable=SC2059  # ANSI colour escape mixed with format specifiers
printf "${BLUE}Enter the number of the backup to restore (or press Enter to cancel):${NC} "
read -r input || true

if [ -z "$input" ]; then
  # shellcheck disable=SC2059  # ANSI colour escape mixed with format specifiers
  printf "${YELLOW}No selection made. Exiting.${NC}\n"
  exit 0
fi

if ! [[ "$input" =~ ^[0-9]+$ ]] || [ "$input" -lt 1 ] || [ "$input" -gt "${#backups[@]}" ]; then
  printf "${RED}Invalid selection: %s${NC}\n" "$input"
  exit 1
fi

selected_backup="${backups[$((input - 1))]}"
original_path="${selected_backup%.backup.*}"

printf "\n${BLUE}Restoring:${NC} %s\n${BLUE}       to:${NC} %s\n\n" \
  "$selected_backup" "$original_path"

if [ -e "$original_path" ] || [ -L "$original_path" ]; then
  ts_now="$(date '+%Y%m%d_%H%M%S')"
  current_backup="${original_path}.backup.${ts_now}"
  printf "${YELLOW}Backing up existing %s to %s${NC}\n" "$original_path" "$current_backup"
  mv "$original_path" "$current_backup"
fi

mv "$selected_backup" "$original_path"
# shellcheck disable=SC2059  # ANSI colour escape mixed with format specifiers
printf "${GREEN}Restored successfully.${NC}\n"
