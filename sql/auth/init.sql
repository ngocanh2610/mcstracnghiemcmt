-- 1. Khởi tạo Extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Tạo bảng Roles
CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL
);

-- 3. Tạo bảng Users (Gộp luôn full_name vào đây cho sạch)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE,
  password_hash TEXT NOT NULL,
  full_name VARCHAR(100), 
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT now()
);

-- 4. Tạo bảng User_Roles
CREATE TABLE IF NOT EXISTS user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id INT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  UNIQUE(user_id, role_id)
);

-- 5. Nạp dữ liệu mẫu
INSERT INTO roles (name) VALUES ('admin'), ('teacher'), ('student') ON CONFLICT (name) DO NOTHING;

INSERT INTO users (username, full_name, password_hash) VALUES 
('khanhsv', 'Bùi Nam Khánh', '$2a$12$JMtsB61N0asQsqJ1hCUeyekcLUhdr/hzarfjV/iJmXBGoYoTQtjay'),
('khanhgv', 'Nguyễn Hoài Cương', '$2a$12$Br9/inB8/9/UziwLolFrtujwn6v7JbiOm27942lOuPA2gve2bOdu6'),
('khanhad', 'Admin Nam Khánh', '$2a$12$ctRwjv/rtJZQLu2X5Hay6u43GSCkiPLv1SbI0xmmS.GP8N9Itoute')
ON CONFLICT (username) DO UPDATE SET full_name = EXCLUDED.full_name;

-- 6. Gán Role
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id FROM users u, roles r WHERE u.username = 'khanhsv' AND r.name = 'student' ON CONFLICT DO NOTHING;
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id FROM users u, roles r WHERE u.username = 'khanhgv' AND r.name = 'teacher' ON CONFLICT DO NOTHING;
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id FROM users u, roles r WHERE u.username = 'khanhad' AND r.name = 'admin' ON CONFLICT DO NOTHING;