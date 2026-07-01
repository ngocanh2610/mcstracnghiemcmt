CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Tạo hàm tự động cập nhật thời gian (Optional nhưng rất chuyên nghiệp)
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 2. Bảng lưu hồ sơ người dùng
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL, -- Bắt buộc UNIQUE để dùng ON CONFLICT
  full_name TEXT,
  avatar_url TEXT,
  role TEXT,
  "class" TEXT,                 -- Bọc trong ngoặc kép để tránh trùng từ khóa hệ thống
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- 3. Gán trigger để mỗi khi UPDATE dữ liệu, updated_at sẽ tự nhảy giờ
DROP TRIGGER IF EXISTS update_profile_modtime ON profiles;
CREATE TRIGGER update_profile_modtime
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE PROCEDURE update_modified_column();