#!/usr/bin/env bash
# 마이그레이션 SQL 을 로컬 Postgres(가짜 auth 스키마)에 적용하고 RLS·권한·rev 충돌·계정 삭제 연쇄를 검사
# 사용: tools/sky-online/sql-test.sh <psql 접속 옵션...>   예) tools/sky-online/sql-test.sh -h /var/tmp/skypg -p 5499 -U postgres
set -euo pipefail
cd "$(dirname "$0")/../.."
psql "$@" -q -v ON_ERROR_STOP=1 -c "drop database if exists sky_rls_test" -c "create database sky_rls_test"
psql "$@" -d sky_rls_test -q -v ON_ERROR_STOP=1 -f tools/sky-online/stub-auth.sql
psql "$@" -d sky_rls_test -q -v ON_ERROR_STOP=1 -f supabase/migrations/20261126000000_sky_online.sql
psql "$@" -d sky_rls_test -q -t -A -f tools/sky-online/rls-test.sql 2>&1 | grep -E '^(PASS|FAIL)'
