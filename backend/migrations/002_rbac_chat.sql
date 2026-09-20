-- Role-based access, psychologist assignment, consent, and private chat.
CREATE TABLE IF NOT EXISTS user_access (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'psychologist', 'user')),
  is_banned BOOLEAN NOT NULL DEFAULT FALSE,
  psychologist_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  share_data_with_psychologist BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS user_access_psychologist_idx ON user_access (psychologist_id);

CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY,
  sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS chat_messages_pair_idx ON chat_messages (sender_id, recipient_id, created_at ASC);
