#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# migrate-to-supabase.sh
# Dumps content tables from Replit internal DB → Supabase production DB
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SOURCE_URL="${DATABASE_URL}"
TARGET_URL="${SUPABASE_DATABASE_URL}?sslmode=require"

TABLES=(
  syllabus_exams
  syllabus_subjects
  syllabus_topics
  question_bank
  current_affairs
  blog_posts
  exam_patterns
  mock_tests
  mock_test_sections
  mock_test_rules
  mock_test_fixed_questions
)

DUMP_FILE="/tmp/govtguru_migration.sql"
LOG_FILE="/tmp/migration_log.txt"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  GovtGuru → Supabase Migration"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── 1. Row counts from source ─────────────────────────────────────────────────
echo ""
echo "📊 Source row counts (Replit DB):"
for t in "${TABLES[@]}"; do
  count=$(psql "$SOURCE_URL" -t -c "SELECT COUNT(*) FROM $t" 2>/dev/null | tr -d ' \n' || echo "MISSING")
  printf "   %-40s %s rows\n" "$t" "$count"
done

# ── 2. Build table flags for pg_dump ─────────────────────────────────────────
TABLE_FLAGS=()
for t in "${TABLES[@]}"; do
  TABLE_FLAGS+=("-t" "$t")
done

# ── 3. Dump schema (CREATE TABLE) from source ─────────────────────────────────
echo ""
echo "📦 Dumping schema from source..."
pg_dump "$SOURCE_URL" \
  --schema-only \
  --no-owner \
  --no-acl \
  --no-comments \
  "${TABLE_FLAGS[@]}" \
  -f /tmp/govtguru_schema.sql 2>&1

echo "   Schema dump: $(wc -l < /tmp/govtguru_schema.sql) lines"

# ── 4. Dump data only from source ─────────────────────────────────────────────
echo ""
echo "📦 Dumping data from source..."
pg_dump "$SOURCE_URL" \
  --data-only \
  --no-owner \
  --no-acl \
  --disable-triggers \
  "${TABLE_FLAGS[@]}" \
  -f /tmp/govtguru_data.sql 2>&1

echo "   Data dump: $(wc -l < /tmp/govtguru_data.sql) lines"
echo "   File size: $(du -h /tmp/govtguru_data.sql | cut -f1)"

# ── 5. Apply schema to Supabase (DROP + CREATE to ensure clean slate) ─────────
echo ""
echo "🏗️  Applying schema to Supabase..."

# Generate drop + recreate SQL
{
  echo "SET session_replication_role = replica;"  # disable FK checks
  echo ""
  # Drop tables in reverse order (FK safe)
  for t in mock_test_fixed_questions mock_test_rules mock_test_sections mock_tests \
            blog_posts current_affairs exam_patterns \
            question_bank syllabus_topics syllabus_subjects syllabus_exams; do
    echo "DROP TABLE IF EXISTS $t CASCADE;"
  done
  echo ""
  cat /tmp/govtguru_schema.sql
  echo ""
  echo "SET session_replication_role = DEFAULT;"
} > /tmp/govtguru_schema_full.sql

PGSSLMODE=require psql "$TARGET_URL" -f /tmp/govtguru_schema_full.sql > "$LOG_FILE" 2>&1 && \
  echo "   ✅ Schema applied" || \
  { echo "   ❌ Schema error:"; cat "$LOG_FILE"; exit 1; }

# ── 6. Insert data into Supabase ──────────────────────────────────────────────
echo ""
echo "📤 Inserting data into Supabase..."

{
  echo "SET session_replication_role = replica;"  # disable FK/trigger checks during load
  cat /tmp/govtguru_data.sql
  echo "SET session_replication_role = DEFAULT;"
} > /tmp/govtguru_data_full.sql

PGSSLMODE=require psql "$TARGET_URL" -f /tmp/govtguru_data_full.sql >> "$LOG_FILE" 2>&1 && \
  echo "   ✅ Data inserted" || \
  { echo "   ❌ Data insert error:"; tail -30 "$LOG_FILE"; exit 1; }

# ── 7. Verify row counts in Supabase ─────────────────────────────────────────
echo ""
echo "✅ Target row counts (Supabase):"
for t in "${TABLES[@]}"; do
  count=$(PGSSLMODE=require psql "$TARGET_URL" -t -c "SELECT COUNT(*) FROM $t" 2>/dev/null | tr -d ' \n' || echo "MISSING")
  printf "   %-40s %s rows\n" "$t" "$count"
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Migration complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
