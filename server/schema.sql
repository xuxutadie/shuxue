CREATE TABLE IF NOT EXISTS users (
 id uuid PRIMARY KEY, username text UNIQUE NOT NULL, name text NOT NULL,
 password_hash text NOT NULL, role text NOT NULL CHECK(role IN ('teacher','student')),
 must_change boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS classes (
 id uuid PRIMARY KEY, teacher_id uuid NOT NULL REFERENCES users(id), name text NOT NULL,
 settings jsonb NOT NULL DEFAULT '{"dates":{},"videos":{}}'
);
CREATE TABLE IF NOT EXISTS students (
 user_id uuid PRIMARY KEY REFERENCES users(id), class_id uuid NOT NULL REFERENCES classes(id),
 data jsonb NOT NULL DEFAULT '{"completed":[],"practice":{},"talk":{},"notes":{},"games":{},"history":[]}'
);
CREATE TABLE IF NOT EXISTS sessions (
 token_hash text PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id), csrf text NOT NULL,
 expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE TABLE IF NOT EXISTS assignments (
 student_id uuid NOT NULL REFERENCES students(user_id), kind text NOT NULL CHECK(kind IN ('A','B')),
 enabled boolean NOT NULL DEFAULT false, PRIMARY KEY(student_id,kind)
);
CREATE TABLE IF NOT EXISTS attempts (
 id uuid PRIMARY KEY, student_id uuid NOT NULL REFERENCES students(user_id),
 kind text NOT NULL CHECK(kind IN ('A','B')), version text NOT NULL DEFAULT 'v2',
 answers jsonb NOT NULL, revision integer NOT NULL DEFAULT 0,
 started_at timestamptz NOT NULL DEFAULT now(), deadline timestamptz NOT NULL,
 submitted_at timestamptz, score integer, correct jsonb, released boolean NOT NULL DEFAULT false,
 timed_out boolean NOT NULL DEFAULT false, UNIQUE(student_id,kind)
);
CREATE INDEX IF NOT EXISTS attempt_deadline ON attempts(deadline) WHERE submitted_at IS NULL;
CREATE TABLE IF NOT EXISTS migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());
INSERT INTO migrations(name) VALUES('001-online') ON CONFLICT DO NOTHING;

-- AI 配置归教师所有；学生记录单独保存，不修改正式练习和测评成绩。
CREATE TABLE IF NOT EXISTS ai_settings (
 teacher_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 endpoint text NOT NULL, model text NOT NULL, key_cipher text,
 enabled boolean NOT NULL DEFAULT false,
 daily_limit integer NOT NULL DEFAULT 20 CHECK(daily_limit BETWEEN 1 AND 100),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS ai_usage (
 user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, day date NOT NULL,
 used integer NOT NULL DEFAULT 0 CHECK(used>=0), pending uuid,
 pending_until timestamptz, reserved integer NOT NULL DEFAULT 0,
 PRIMARY KEY(user_id,day)
);
CREATE TABLE IF NOT EXISTS ai_questions (
 id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 teacher_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 lesson integer NOT NULL CHECK(lesson BETWEEN 0 AND 11),
 difficulty integer NOT NULL CHECK(difficulty BETWEEN 1 AND 3),
 problem jsonb NOT NULL, hint_count integer NOT NULL DEFAULT 0 CHECK(hint_count BETWEEN 0 AND 3),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ai_questions_user_date ON ai_questions(user_id,created_at DESC);
CREATE TABLE IF NOT EXISTS ai_submissions (
 id uuid PRIMARY KEY, question_id uuid NOT NULL REFERENCES ai_questions(id) ON DELETE CASCADE,
 answer text NOT NULL, correct boolean NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ai_submissions_question_date ON ai_submissions(question_id,created_at);
INSERT INTO migrations(name) VALUES('002-guided-practice') ON CONFLICT DO NOTHING;
