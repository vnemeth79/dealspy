-- Trial expired: we revoke access (do not delete user) so we can identify "had trial" by email.
ALTER TABLE users ADD COLUMN IF NOT EXISTS access_revoked_at TIMESTAMP WITH TIME ZONE;
CREATE INDEX IF NOT EXISTS idx_users_access_revoked ON users(access_revoked_at) WHERE access_revoked_at IS NOT NULL;
