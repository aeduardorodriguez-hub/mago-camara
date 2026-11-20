#!/usr/bin/env bash
# Guarda el punto de desarrollo: commit + push de la rama actual al terminar cada turno.
cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 0
branch=$(git branch --show-current)
[ -z "$branch" ] && exit 0
if [ -n "$(git status --porcelain)" ]; then
  git add -A
  git commit -q -m "Autosave: $(date -u +%Y-%m-%dT%H:%M:%SZ)" || exit 0
fi
if git rev-parse HEAD >/dev/null 2>&1; then
  for i in 1 2 3 4; do
    git push -q -u origin "$branch" && exit 0
    sleep $((i*2))
  done
fi
exit 0
