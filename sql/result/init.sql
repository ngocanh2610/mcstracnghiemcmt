-- 1. Cho phép sử dụng hàm gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Tạo bảng lưu kết quả (Results)
CREATE TABLE IF NOT EXISTS results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- submission_id: Để TEXT để nhận UUID từ Submission Service mà không bị lỗi kiểu dữ liệu
  submission_id TEXT UNIQUE NOT NULL, 
  
  -- user_id: BẮT BUỘC để TEXT để khớp với UUID của Auth Service
  user_id TEXT NOT NULL,
  
  -- exam_id: Để TEXT để linh hoạt
  exam_id TEXT NOT NULL,
  
  score DECIMAL(4,2) DEFAULT 0,
  total_questions INT DEFAULT 0,
  correct_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT now()
);

-- 3. Dọn dẹp ràng buộc (Để đề phòng trường hợp bạn chạy đè lên DB cũ)
-- Xóa ràng buộc khóa ngoại vì user_id trỏ sang DB khác không tồn tại ở đây
ALTER TABLE results DROP CONSTRAINT IF EXISTS results_user_id_fkey;

-- Đảm bảo cột user_id là TEXT (Nếu bảng đã lỡ tạo kiểu UUID/INT trước đó)
ALTER TABLE results ALTER COLUMN user_id TYPE TEXT;
ALTER TABLE results ALTER COLUMN submission_id TYPE TEXT;