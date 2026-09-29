#!/usr/bin/env bash
#
# Creates or updates the repository rulesets defined in this directory, matching
# live rulesets by name. Enterprise rulesets are never touched.
#
# Usage: .github/rulesets/apply.sh [--check] [owner/repo]
#   --check  Report rulesets that are missing or differ from their file, and
#            exit non-zero if any do, without changing anything.
#
# Requires the gh CLI (repository admin rights to apply) and node.

set -euo pipefail

check=false
if [ "${1:-}" = --check ]; then
    check=true
    shift
fi
repo="${1:-amazonmusic/vinyl}"
dir="$(cd "$(dirname "$0")" && pwd)"

# Prints the fields a ruleset file defines, with sorted keys, so a live ruleset
# (which carries extra read-only fields) compares equal to its file.
normalize() {
    node -e '
        const sort = (v) =>
            Array.isArray(v)
                ? v.map(sort)
                : v && typeof v === "object"
                  ? Object.fromEntries(
                        Object.keys(v).sort().map((k) => [k, sort(v[k])])
                    )
                  : v
        const r = JSON.parse(require("fs").readFileSync(0, "utf8"))
        const { name, target, enforcement, bypass_actors, conditions, rules } = r
        console.log(JSON.stringify(sort({ name, target, enforcement, bypass_actors, conditions, rules }), null, 2))
    '
}

drift=false
for file in "$dir"/*.json; do
    name=$(node -p "require(process.argv[1]).name" "$file")
    id=$(gh api "repos/$repo/rulesets" --paginate \
        --jq ".[] | select(.source_type == \"Repository\" and .name == \"$name\") | .id")

    if $check; then
        if [ -z "$id" ]; then
            echo "Missing: $name"
            drift=true
        elif ! diff -u --label "live $name" --label "$(basename "$file")" \
            <(gh api "repos/$repo/rulesets/$id" | normalize) \
            <(normalize < "$file"); then
            drift=true
        else
            echo "Up to date: $name ($id)"
        fi
    elif [ -n "$id" ]; then
        gh api -X PUT "repos/$repo/rulesets/$id" --input "$file" > /dev/null
        echo "Updated: $name ($id)"
    else
        id=$(gh api -X POST "repos/$repo/rulesets" --input "$file" --jq .id)
        echo "Created: $name ($id)"
    fi
done

if $drift; then exit 1; fi
