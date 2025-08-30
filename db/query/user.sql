-- name: GetUser :one
SELECT * FROM users
WHERE id = $1 LIMIT 1;

-- name: GetUserByEmail :one
SELECT * FROM users
WHERE email = $1 LIMIT 1;

-- name: GetUserByProvider :one
SELECT * FROM users
WHERE provider = $1 AND provider_id = $2 LIMIT 1;

-- name: ListUsers :many
SELECT * FROM users
ORDER BY created_at;

-- name: CreateUser :one
INSERT INTO users (
  username, email, password_hash, provider, provider_id, avatar_url, name
) VALUES (
  $1, $2, $3, $4, $5, $6, $7
)
RETURNING *;

-- name: CreateEmailUser :one
INSERT INTO users (
  email, password_hash, provider
) VALUES (
  $1, $2, 'email'
)
RETURNING *;

-- name: CreateOAuthUser :one
INSERT INTO users (
  email, provider, provider_id, avatar_url, name, username
) VALUES (
  $1, $2, $3, $4, $5, $6
)
RETURNING *;

-- name: UpdateUser :one
UPDATE users
SET username = $2, email = $3, updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: DeleteUser :exec
DELETE FROM users
WHERE id = $1;

-- Session management queries
-- name: CreateSession :one
INSERT INTO user_sessions (
  user_id, session_token, expires_at
) VALUES (
  $1, $2, $3
)
RETURNING *;

-- name: GetSession :one
SELECT s.*, u.id as user_id, u.email, u.username, u.name, u.avatar_url, u.provider
FROM user_sessions s
JOIN users u ON s.user_id = u.id
WHERE s.session_token = $1 AND s.expires_at > NOW()
LIMIT 1;

-- name: DeleteSession :exec
DELETE FROM user_sessions
WHERE session_token = $1;

-- name: DeleteExpiredSessions :exec
DELETE FROM user_sessions
WHERE expires_at <= NOW();

-- name: DeleteUserSessions :exec
DELETE FROM user_sessions
WHERE user_id = $1;
