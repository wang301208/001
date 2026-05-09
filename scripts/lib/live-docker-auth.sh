#!/usr/bin/env bash

ASSISTANT_DOCKER_LIVE_AUTH_ALL=(.gemini .minimax)
ASSISTANT_DOCKER_LIVE_AUTH_FILES_ALL=(
  .codex/auth.json
  .codex/config.toml
  .claude.json
  .claude/.credentials.json
  .claude/settings.json
  .claude/settings.local.json
  .gemini/settings.json
)

assistant_live_trim() {
  local value="${1:-}"
  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%"${value##*[![:space:]]}"}"
  printf '%s' "$value"
}

assistant_live_normalize_auth_dir() {
  local value
  value="$(assistant_live_trim "${1:-}")"
  [[ -n "$value" ]] || return 1
  value="${value#.}"
  printf '.%s' "$value"
}

assistant_live_should_include_auth_dir_for_provider() {
  local provider
  provider="$(assistant_live_trim "${1:-}")"
  case "$provider" in
    gemini | gemini-cli | google-gemini-cli)
      printf '%s\n' ".gemini"
      ;;
    minimax | minimax-portal)
      printf '%s\n' ".minimax"
      ;;
  esac
}

assistant_live_should_include_auth_file_for_provider() {
  local provider
  provider="$(assistant_live_trim "${1:-}")"
  case "$provider" in
    codex-cli | openai-codex)
      printf '%s\n' ".codex/auth.json"
      printf '%s\n' ".codex/config.toml"
      ;;
    anthropic | claude-cli)
      printf '%s\n' ".claude.json"
      printf '%s\n' ".claude/.credentials.json"
      printf '%s\n' ".claude/settings.json"
      printf '%s\n' ".claude/settings.local.json"
      ;;
  esac
}

assistant_live_collect_auth_dirs_from_csv() {
  local raw="${1:-}"
  local token normalized
  [[ -n "$(assistant_live_trim "$raw")" ]] || return 0
  IFS=',' read -r -a tokens <<<"$raw"
  for token in "${tokens[@]}"; do
    while IFS= read -r normalized; do
      printf '%s\n' "$normalized"
    done < <(assistant_live_should_include_auth_dir_for_provider "$token")
  done | awk 'NF && !seen[$0]++'
}

assistant_live_collect_auth_dirs_from_override() {
  local raw token normalized
  raw="$(assistant_live_trim "${ASSISTANT_DOCKER_AUTH_DIRS:-}")"
  [[ -n "$raw" ]] || return 1
  case "$raw" in
    all)
      printf '%s\n' "${ASSISTANT_DOCKER_LIVE_AUTH_ALL[@]}"
      return 0
      ;;
    none)
      return 0
      ;;
  esac
  IFS=',' read -r -a tokens <<<"$raw"
  for token in "${tokens[@]}"; do
    normalized="$(assistant_live_normalize_auth_dir "$token")" || continue
    printf '%s\n' "$normalized"
  done | awk '!seen[$0]++'
  return 0
}

assistant_live_collect_auth_dirs() {
  if assistant_live_collect_auth_dirs_from_override; then
    return 0
  fi
  printf '%s\n' "${ASSISTANT_DOCKER_LIVE_AUTH_ALL[@]}"
}

assistant_live_collect_auth_files_from_csv() {
  local raw="${1:-}"
  local token normalized
  [[ -n "$(assistant_live_trim "$raw")" ]] || return 0
  IFS=',' read -r -a tokens <<<"$raw"
  for token in "${tokens[@]}"; do
    while IFS= read -r normalized; do
      printf '%s\n' "$normalized"
    done < <(assistant_live_should_include_auth_file_for_provider "$token")
  done | awk 'NF && !seen[$0]++'
}

assistant_live_collect_auth_files_from_override() {
  local raw
  raw="$(assistant_live_trim "${ASSISTANT_DOCKER_AUTH_DIRS:-}")"
  [[ -n "$raw" ]] || return 1
  case "$raw" in
    all)
      printf '%s\n' "${ASSISTANT_DOCKER_LIVE_AUTH_FILES_ALL[@]}"
      return 0
      ;;
    none)
      return 0
      ;;
  esac
  return 0
}

assistant_live_collect_auth_files() {
  if assistant_live_collect_auth_files_from_override; then
    return 0
  fi
  printf '%s\n' "${ASSISTANT_DOCKER_LIVE_AUTH_FILES_ALL[@]}"
}

assistant_live_join_csv() {
  local first=1 value
  for value in "$@"; do
    [[ -n "$value" ]] || continue
    if (( first )); then
      printf '%s' "$value"
      first=0
    else
      printf ',%s' "$value"
    fi
  done
}
