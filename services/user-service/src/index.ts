import express from "express";
import { Pool } from "pg";
import cors from "cors";

const app = express();

// 1. Cấu hình CORS
app.use(cors());
app.use(express.json());

// 2. Kết nối Database
const pool = new Pool({ 
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 5000 
});

const SERVICE_TOKEN = process.env.SERVICE_TOKEN || "service_token";

// 3. Middleware bảo vệ Service (Chỉ Gateway mới được gọi)
const checkServiceToken = (req: any, res: any, next: any) => {
    const sToken = req.headers["x-service-token"];
    if (sToken !== SERVICE_TOKEN) {
        return res.status(403).json({ error: "Direct access forbidden" });
    }
    next();
};

// 4. Log request để Khánh dễ debug qua Docker Terminal
app.use((req, res, next) => {
    console.log(`>>> [USER-SERVICE] ${req.method} ${req.url}`);
    next();
});

// --- ENDPOINT: Lấy thông tin Profile ---
app.get("/users/:id/profile", checkServiceToken, async (req, res) => {
    try {
        const { id } = req.params;
        const r = await pool.query("SELECT * FROM profiles WHERE user_id=$1", [id]);
        
        if (r.rows.length === 0) {
            return res.status(404).json({ error: "Profile không tồn tại" });
        }
        res.json(r.rows[0]);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// --- ENDPOINT: Cập nhật hoặc Tạo mới Profile (Upsert) ---
app.post("/users/:id/profile", checkServiceToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { full_name, avatar_url, role, class: cls } = req.body;

        // Lưu ý: "class" được bọc trong dấu ngoặc kép để tránh lỗi từ khóa SQL
        const query = `
            INSERT INTO profiles(user_id, full_name, avatar_url, role, "class") 
            VALUES($1, $2, $3, $4, $5)
            ON CONFLICT (user_id) 
            DO UPDATE SET 
                full_name = EXCLUDED.full_name, 
                avatar_url = EXCLUDED.avatar_url, 
                role = EXCLUDED.role, 
                "class" = EXCLUDED."class"
            RETURNING *
        `;
        
        const upsert = await pool.query(query, [id, full_name || null, avatar_url || null, role || null, cls || null]);
        res.json(upsert.rows[0]);
    } catch (err: any) {
        console.error("Lỗi Upsert Profile:", err.message);
        res.status(500).json({ error: "Không thể cập nhật hồ sơ" });
    }
});

// --- ENDPOINT: Danh sách Profiles (Dành cho Admin) ---
app.get("/users", checkServiceToken, async (req, res) => {
    try {
        const r = await pool.query('SELECT * FROM profiles ORDER BY "class" ASC');
        res.json(r.rows);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

const port = parseInt(process.env.PORT || "3002", 10);
app.listen(port, () => {
    console.log(`=========================================`);
    console.log(`👤 USER SERVICE ĐÃ SẴN SÀNG TẠI CỔNG ${port}`);
    console.log(`=========================================`);
});