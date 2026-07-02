-- 1. Khởi tạo Extension (Chỉ cần 1 lần duy nhất)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Tạo hàm hỗ trợ Update Timestamp (Cần cho các trigger sau này)
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 3. Các bảng độc lập (Không có khóa ngoại)
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  action TEXT,
  service TEXT,
  resource_id UUID,
  payload JSONB,
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  text TEXT NOT NULL,
  points INT DEFAULT 1,
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS question_banks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject TEXT NOT NULL,
  text TEXT NOT NULL,
  points INT DEFAULT 1,
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  subject TEXT,
  description TEXT,
  duration INT DEFAULT 60,
  created_by UUID NOT NULL,
  is_published BOOLEAN DEFAULT true,
  published_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- 4. Các bảng phụ thuộc vào các bảng trên (Có khóa ngoại)
CREATE TABLE IF NOT EXISTS exam_questions (
  exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  PRIMARY KEY (exam_id, question_id)
);

CREATE TABLE IF NOT EXISTS question_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  text TEXT NOT NULL,
  is_correct BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS question_bank_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_bank_id UUID NOT NULL REFERENCES question_banks(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  text TEXT NOT NULL,
  is_correct BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS leaderboard_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID NOT NULL,
  user_id UUID NOT NULL,
  score INT NOT NULL,
  calculated_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_id TEXT NOT NULL, 
    user_id TEXT NOT NULL, 
    answers JSONB DEFAULT '{}', 
    duration_seconds INT DEFAULT 0, 
    metadata JSONB DEFAULT '{}', 
    status TEXT DEFAULT 'submitted', 
    created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS submission_answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
    question_id TEXT NOT NULL,
    selected_options JSONB NOT NULL, 
    answered_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id TEXT UNIQUE NOT NULL, 
  user_id TEXT NOT NULL,
  exam_id TEXT NOT NULL,
  score DECIMAL(4,2) DEFAULT 0,
  total_questions INT DEFAULT 0,
  correct_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT now()
);

-- 5. Các bảng cấu hình đặc biệt và Trigger
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL, 
  full_name TEXT,
  avatar_url TEXT,
  role TEXT,
  "class" TEXT, 
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Tạo Trigger cho profiles
DROP TRIGGER IF EXISTS update_profile_modtime ON profiles;
CREATE TRIGGER update_profile_modtime
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE PROCEDURE update_modified_column();

-- 6. Xử lý các thay đổi cột (ALTER TABLE)
-- Chạy sau khi các bảng đã được tạo thành công
ALTER TABLE results DROP CONSTRAINT IF EXISTS results_user_id_fkey;
ALTER TABLE results ALTER COLUMN user_id TYPE TEXT;
ALTER TABLE results ALTER COLUMN submission_id TYPE TEXT;

ALTER TABLE submissions DROP CONSTRAINT IF EXISTS submissions_user_id_fkey;