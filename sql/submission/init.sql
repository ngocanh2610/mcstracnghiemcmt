CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Bảng lưu lượt làm bài (Submissions)
CREATE TABLE IF NOT EXISTS submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_id TEXT NOT NULL, -- Để TEXT cho linh hoạt khi gọi chéo service
    user_id TEXT NOT NULL, -- Đổi thành TEXT để nhận chuỗi UUID từ Auth Service
    
    -- Cột này chứa toàn bộ đáp án dạng JSON (Khớp với code Node.js)
    answers JSONB DEFAULT '{}', 
    
    duration_seconds INT DEFAULT 0, 
    metadata JSONB DEFAULT '{}', 
    status TEXT DEFAULT 'submitted', -- submitted, grading, completed
    created_at TIMESTAMP DEFAULT now()
);

-- 2. Bảng lưu chi tiết từng câu trả lời (Dùng nếu sau này bạn muốn tách nhỏ dữ liệu)
CREATE TABLE IF NOT EXISTS submission_answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
    question_id TEXT NOT NULL,
    selected_options JSONB NOT NULL, 
    answered_at TIMESTAMP DEFAULT now()
);

-- 3. Đảm bảo không bị lỗi khóa ngoại khi nộp bài
ALTER TABLE submissions DROP CONSTRAINT IF EXISTS submissions_user_id_fkey;