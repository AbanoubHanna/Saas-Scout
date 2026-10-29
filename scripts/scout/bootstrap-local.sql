-- Local preview only. Never run against a hosted/production database.
-- This identity belongs to the starter's explicit loopback-only mock sign-in.
INSERT OR IGNORE INTO platform_operators(user_id, created_at)
VALUES ('local_seedy', strftime('%Y-%m-%dT%H:%M:%fZ','now'));
