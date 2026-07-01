import express from "express";
import { Pool } from "pg";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({ 
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 5000 
});

// Middleware Logger để theo dõi luồng dữ liệu nội bộ
app.use((req, res, next) => {
    console.log(`>>> [RESULT-SERVICE] ${req.method} ${req.url}`);
    next();
});

// --- 1. LẤY KẾT QUẢ THEO MÃ BÀI NỘP (Dành cho Sinh viên xem điểm) ---
app.get("/submission/:submissionId", async (req, res) => {
    try {
        const query = "SELECT * FROM results WHERE submission_id = $1";
        const r = await pool.query(query, [req.params.submissionId]);
        
        if (r.rows.length === 0) {
            // Trả về trạng thái đang chấm để Frontend hiển thị "Đang chấm..."
            return res.status(200).json({ 
                status: "grading",
                message: "Bài làm đang được hệ thống xử lý..." 
            });
        }
        res.json(r.rows[0]);
    } catch (err: any) {
        console.error("-> Lỗi lấy kết quả:", err.message);
        res.status(500).json({ error: "Lỗi hệ thống khi lấy điểm" });
    }
});

// --- 2. LẤY THỐNG KÊ ĐIỂM THEO ĐỀ THI (Dành cho Giáo viên/Admin) ---
app.get("/exam/:examId", async (req, res) => {
    const { examId } = req.params;
    try {
        // Lấy danh sách chi tiết điểm của từng sinh viên
        const details = await pool.query(
            "SELECT * FROM results WHERE exam_id = $1 ORDER BY score DESC", 
            [examId]
        );

        // Tính toán các chỉ số thống kê nhanh
        const stats = await pool.query(
            `SELECT 
                COUNT(*) as total, 
                ROUND(AVG(score), 2) as avg, 
                MAX(score) as max, 
                MIN(score) as min 
             FROM results WHERE exam_id = $1`,
            [examId]
        );

        res.json({
            stats: stats.rows[0],
            details: details.rows
        });
    } catch (err: any) {
        console.error("-> Lỗi lấy thống kê:", err.message);
        res.status(500).json({ error: "Lỗi hệ thống khi lấy thống kê" });
    }
});

// --- 3. LƯU HOẶC CẬP NHẬT KẾT QUẢ (Cơ chế UPSERT cho Auto-Regrade) ---
app.post("/", async (req, res) => {
    const { submission_id, exam_id, user_id, correct_count, total_questions, score } = req.body;

    try {
        /**
         * Giải thích logic:
         * Nếu chưa có điểm cho submission_id này -> INSERT mới.
         * Nếu đã có điểm (trùng submission_id) -> UPDATE lại correct_count, total_questions và score.
         */
        const query = `
            INSERT INTO results (submission_id, exam_id, user_id, correct_count, total_questions, score, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, NOW())
            ON CONFLICT (submission_id) 
            DO UPDATE SET 
                score = EXCLUDED.score,
                correct_count = EXCLUDED.correct_count,
                total_questions = EXCLUDED.total_questions,
                created_at = results.created_at -- Giữ nguyên thời gian nộp bài đầu tiên
            RETURNING *;
        `;
        const values = [submission_id, exam_id, user_id, correct_count, total_questions, score];
        
        const result = await pool.query(query, values);
        
        console.log(`[UPSERT] Bài nộp ${submission_id.slice(0,8)}... cập nhật thành công: ${score}đ`);
        res.status(201).json({ success: true, data: result.rows[0] });
    } catch (err: any) {
        console.error("-> Lỗi UPSERT điểm:", err.message);
        res.status(500).json({ 
            error: "Lỗi lưu Database", 
            detail: "Hãy đảm bảo cột submission_id trong DB là UNIQUE." 
        });
    }
});

// --- 4. CỬA CHẶN 404 ---
app.use((req, res) => {
    res.status(404).json({ error: `Route ${req.url} không tồn tại trong Result Service` });
});

const port = process.env.PORT || 3005;
app.listen(port, () => {
    console.log(`📊 RESULT SERVICE IS RUNNING ON PORT ${port}`);
});