import express from "express";
import { Pool } from "pg";
import cors from "cors";
import axios from "axios";

const app = express();
const router = express.Router();
app.use(express.json());
app.use(cors());

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Khởi tạo bảng nếu chưa có (Hỗ trợ Ngân hàng câu hỏi)
// Khởi tạo bảng nếu chưa có
const initDB = async () => {
    try {
        // Bật extension hỗ trợ UUID (nếu Postgres bản cũ)
        await pool.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);

        // Tạo bảng Ngân hàng câu hỏi (đã bổ sung cột options)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS question_banks (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                subject TEXT NOT NULL,
                text TEXT NOT NULL,
                options JSONB,     -- Thêm cột này để lưu mảng [A,B,C,D]
                points INT DEFAULT 1,
                created_at TIMESTAMP DEFAULT now()
            );
        `);
        console.log("✅ Đã kiểm tra/khởi tạo bảng question_banks thành công!");
    } catch (error: any) {
        console.error("❌ Lỗi tạo bảng:", error.message);
    }
};

initDB();

const SUBMISSION_SERVICE_URL = process.env.SUBMISSION_SERVICE_URL || "http://submission-service:3004";
const http = axios.create({ timeout: 5000 });

// --- LOGGER ---
app.use((req, res, next) => {
    console.log(`>>> [EXAM-SERVICE] ${req.method} | ${req.url}`);
    next();
});

// --- 🛡️ MIDDLEWARE KIỂM TRA QUYỀN ---
const checkRole = (allowedRoles: string[]) => {
    return (req: any, res: any, next: any) => {
        const rolesHeader = req.headers['x-user-roles'] || "";
        const userRoles = typeof rolesHeader === 'string' ? rolesHeader.split(',') : [];
        const hasPermission = allowedRoles.some(role => userRoles.includes(role));

        if (!hasPermission) {
            return res.status(403).json({ error: "Bạn không có quyền thực hiện hành động này!" });
        }
        next();
    };
};

// --- HELPER: Kích hoạt chấm lại ---
const triggerRegrade = (examId: string) => {
    http.post(`${SUBMISSION_SERVICE_URL}/regrade/${examId}`)
        .then(() => console.log(`[AUTO-REGRADE] Đã kích hoạt chấm lại cho đề: ${examId}`))
        .catch(err => console.error("[AUTO-REGRADE] Lỗi kích hoạt:", err.message));
};

// --- ROUTER LOGIC (Lắng nghe tại gốc /) ---

// 1. Lấy danh sách đề
router.get("/", async (req, res) => {
    try {
        const r = await pool.query("SELECT * FROM exams WHERE is_published = true ORDER BY created_at DESC");
        res.json(r.rows);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// 2. Tạo đề mới
router.post("/", checkRole(['teacher', 'admin']), async (req, res) => {
    try {
        const { title, subject, description, created_by, duration } = req.body;
        const r = await pool.query(
            "INSERT INTO exams (title, subject, description, created_by, duration, is_published) VALUES ($1, $2, $3, $4, $5, true) RETURNING *",
            [title, subject, description, created_by, duration || 60]
        );
        res.status(201).json(r.rows[0]);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// 3.1 Lấy chi tiết đề (Thí sinh làm bài)
router.get("/:id", async (req, res) => {
    const { id } = req.params;
    if (id === 'internal') return; // Tránh nhầm lẫn với route internal
    try {
        const examRes = await pool.query("SELECT * FROM exams WHERE id = $1", [id]);
        if (examRes.rows.length === 0) return res.status(404).json({ error: "Không tìm thấy đề" });
        const questionsRes = await pool.query(`
            SELECT q.id, q.text, q.points, 
                   COALESCE(json_agg(json_build_object('id', o.id, 'code', o.code, 'text', o.text) ORDER BY o.code) 
                   FILTER (WHERE o.id IS NOT NULL), '[]') as options
            FROM questions q 
            LEFT JOIN question_options o ON q.id = o.question_id
            WHERE q.id IN (SELECT question_id FROM exam_questions WHERE exam_id = $1)
            GROUP BY q.id ORDER BY q.id ASC
        `, [id]);
        res.json({ exam: examRes.rows[0], questions: questionsRes.rows });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// 3.2 Lấy chi tiết đề kèm đáp án (Dùng cho Review/Sửa đề)
router.get("/internal/:id/answers", async (req, res) => {
    const { id } = req.params;
    try {
        const examRes = await pool.query("SELECT * FROM exams WHERE id = $1", [id]);
        if (examRes.rows.length === 0) return res.status(404).json({ error: "Không tìm thấy đề" });
        const questionsRes = await pool.query(`
            SELECT q.id, q.text, q.points, 
                   COALESCE(json_agg(json_build_object('id', o.id, 'code', o.code, 'text', o.text, 'is_correct', o.is_correct) ORDER BY o.code) 
                   FILTER (WHERE o.id IS NOT NULL), '[]') as options
            FROM questions q 
            LEFT JOIN question_options o ON q.id = o.question_id
            WHERE q.id IN (SELECT question_id FROM exam_questions WHERE exam_id = $1)
            GROUP BY q.id ORDER BY q.id ASC
        `, [id]);
        res.json({ exam: examRes.rows[0], questions: questionsRes.rows });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// 4. Các route quản lý (Sửa/Xóa/Thêm câu hỏi)
router.post("/:id/questions", checkRole(['teacher', 'admin']), async (req, res) => {
    const exam_id = req.params.id;
    const { text, options } = req.body; 
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const q = await client.query("INSERT INTO questions (text) VALUES ($1) RETURNING id", [text]);
        const qId = q.rows[0].id;
        
        // Insert vào bảng exam_questions để liên kết
        await client.query("INSERT INTO exam_questions (exam_id, question_id) VALUES ($1, $2)", [exam_id, qId]);
        
        for (const opt of options) {
            await client.query("INSERT INTO question_options (question_id, code, text, is_correct) VALUES ($1, $2, $3, $4)", [qId, opt.code, opt.text, opt.is_correct]);
        }
        await client.query('COMMIT');
        res.json({ success: true });
    } catch (err: any) { await client.query('ROLLBACK'); res.status(500).json({ error: err.message }); } finally { client.release(); }
});

router.put("/questions/:qId", checkRole(['teacher', 'admin']), async (req, res) => {
    const { qId } = req.params;
    const { text } = req.body; 
    try {
        await pool.query("UPDATE questions SET text = $1 WHERE id = $2", [text, qId]);
        // Lấy exam_id từ exam_questions
        const examResult = await pool.query("SELECT exam_id FROM exam_questions WHERE question_id = $1", [qId]);
        if (examResult.rowCount > 0) {
            triggerRegrade(examResult.rows[0].exam_id);
        }
        res.json({ success: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.put("/options/:optId", checkRole(['teacher', 'admin']), async (req, res) => {
    const { optId } = req.params;
    const { text } = req.body;
    try {
        // Lấy question_id từ option, rồi exam_id từ exam_questions
        const optResult = await pool.query("SELECT question_id FROM question_options WHERE id = $1", [optId]);
        if (optResult.rowCount === 0) return res.status(404).json({ error: "Không thấy đáp án" });
        
        const qId = optResult.rows[0].question_id;
        await pool.query("UPDATE question_options SET text = $1 WHERE id = $2", [text, optId]);
        
        const examResult = await pool.query("SELECT exam_id FROM exam_questions WHERE question_id = $1", [qId]);
        if (examResult.rowCount > 0) {
            triggerRegrade(examResult.rows[0].exam_id);
        }
        res.json({ success: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.patch("/questions/:qId/correct-option", checkRole(['teacher', 'admin']), async (req, res) => {
    const { qId } = req.params;
    const { correctOptionCode } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        // Lấy exam_id từ exam_questions
        const examResult = await client.query("SELECT exam_id FROM exam_questions WHERE question_id = $1", [qId]);
        await client.query("UPDATE question_options SET is_correct = false WHERE question_id = $1", [qId]);
        await client.query("UPDATE question_options SET is_correct = true WHERE question_id = $1 AND code = $2", [qId, correctOptionCode]);
        await client.query('COMMIT');
        if (examResult.rowCount > 0) {
            triggerRegrade(examResult.rows[0].exam_id);
        }
        res.json({ success: true });
    } catch (err: any) { await client.query('ROLLBACK'); res.status(500).json({ error: err.message }); } finally { client.release(); }
});

router.delete("/:id", checkRole(['teacher', 'admin']), async (req, res) => {
    const { id } = req.params;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        // Xóa các đáp án của các câu hỏi liên kết với đề này
        await client.query(`
            DELETE FROM question_options 
            WHERE question_id IN (SELECT question_id FROM exam_questions WHERE exam_id = $1)
        `, [id]);
        // Xóa các câu hỏi liên kết từ exam_questions
        await client.query("DELETE FROM exam_questions WHERE exam_id = $1", [id]);
        // Xóa đề thi
        await client.query("DELETE FROM exams WHERE id = $1", [id]);
        await client.query('COMMIT');
        res.json({ success: true });
    } catch (err: any) { await client.query('ROLLBACK'); res.status(500).json({ error: err.message }); } finally { client.release(); }
});

// --- NGÂN HÀNG CÂU HỎI (QUESTION BANKS) ---

router.get("/banks/list/subjects", checkRole(['teacher', 'admin']), async (req, res) => {
    try {
        const r = await pool.query("SELECT DISTINCT subject FROM question_banks ORDER BY subject");
        res.json(r.rows.map(row => row.subject));
    } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get("/banks/subject/:subject", checkRole(['teacher', 'admin']), async (req, res) => {
    const { subject } = req.params;
    try {
        const r = await pool.query(`
            SELECT b.id, b.subject, b.text, b.points,
                   COALESCE(json_agg(json_build_object('id', o.id, 'code', o.code, 'text', o.text, 'is_correct', o.is_correct) ORDER BY o.code)
                   FILTER (WHERE o.id IS NOT NULL), '[]') as options
            FROM question_banks b LEFT JOIN question_bank_options o ON b.id = o.question_bank_id
            WHERE b.subject = $1 GROUP BY b.id ORDER BY b.created_at DESC
        `, [subject]);
        res.json(r.rows);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post("/banks", checkRole(['teacher', 'admin']), async (req, res) => {
    const { subject, text, options } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const q = await client.query("INSERT INTO question_banks (subject, text) VALUES ($1, $2) RETURNING id", [subject, text]);
        const qId = q.rows[0].id;
        for (const opt of options) {
            await client.query("INSERT INTO question_bank_options (question_bank_id, code, text, is_correct) VALUES ($1, $2, $3, $4)", [qId, opt.code, opt.text, opt.is_correct]);
        }
        await client.query('COMMIT');
        res.json({ success: true, id: qId });
    } catch (err: any) { await client.query('ROLLBACK'); res.status(500).json({ error: err.message }); } finally { client.release(); }
});

router.post("/banks-batch", checkRole(['teacher', 'admin']), async (req, res) => {
    const { subject, questions } = req.body;
    
    if (!subject || !Array.isArray(questions) || questions.length === 0) {
        return res.status(400).json({ error: "Cần subject và mảng questions hợp lệ" });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        for (const q of questions) {
            if (!q.text || !Array.isArray(q.options)) {
                throw new Error("Mỗi câu hỏi phải có text và options");
            }

            const qResult = await client.query(
                "INSERT INTO question_banks (subject, text) VALUES ($1, $2) RETURNING id",
                [subject, q.text]
            );
            const qId = qResult.rows[0].id;

            for (const opt of q.options) {
                await client.query(
                    "INSERT INTO question_bank_options (question_bank_id, code, text, is_correct) VALUES ($1, $2, $3, $4)",
                    [qId, opt.code, opt.text, opt.is_correct]
                );
            }
        }
        
        await client.query('COMMIT');
        res.json({ success: true, count: questions.length });
    } catch (err: any) { 
        await client.query('ROLLBACK'); 
        res.status(500).json({ error: err.message }); 
    } finally { 
        client.release(); 
    }
});

router.put("/banks/:id", checkRole(['teacher', 'admin']), async (req, res) => {
    const { id } = req.params;
    const { subject, text, options } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query("UPDATE question_banks SET subject = $1, text = $2 WHERE id = $3", [subject, text, id]);
        await client.query("DELETE FROM question_bank_options WHERE question_bank_id = $1", [id]);
        for (const opt of options) {
            await client.query("INSERT INTO question_bank_options (question_bank_id, code, text, is_correct) VALUES ($1, $2, $3, $4)", [id, opt.code, opt.text, opt.is_correct]);
        }
        await client.query('COMMIT');
        res.json({ success: true });
    } catch (err: any) { await client.query('ROLLBACK'); res.status(500).json({ error: err.message }); } finally { client.release(); }
});

router.delete("/banks/:id", checkRole(['teacher', 'admin']), async (req, res) => {
    const { id } = req.params;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query("DELETE FROM question_bank_options WHERE question_bank_id = $1", [id]);
        await client.query("DELETE FROM question_banks WHERE id = $1", [id]);
        await client.query('COMMIT');
        res.json({ success: true });
    } catch (err: any) { await client.query('ROLLBACK'); res.status(500).json({ error: err.message }); } finally { client.release(); }
});

router.get("/banks/subject/:subject/random/:count", checkRole(['teacher', 'admin']), async (req, res) => {
    const { subject, count } = req.params;
    try {
        const r = await pool.query(`
            SELECT b.id, b.subject, b.text, b.points,
                   COALESCE(json_agg(json_build_object('id', o.id, 'code', o.code, 'text', o.text, 'is_correct', o.is_correct) ORDER BY o.code)
                   FILTER (WHERE o.id IS NOT NULL), '[]') as options
            FROM question_banks b LEFT JOIN question_bank_options o ON b.id = o.question_bank_id
            WHERE b.subject = $1 GROUP BY b.id ORDER BY RANDOM() LIMIT $2
        `, [subject, parseInt(count, 10)]);
        res.json(r.rows);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post("/:id/questions-batch", checkRole(['teacher', 'admin']), async (req, res) => {
    const exam_id = req.params.id;
    const { questions } = req.body; 
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        for (const qData of questions) {
            const q = await client.query("INSERT INTO questions (text) VALUES ($1) RETURNING id", [qData.text]);
            const qId = q.rows[0].id;
            
            // Insert vào bảng exam_questions để liên kết
            await client.query("INSERT INTO exam_questions (exam_id, question_id) VALUES ($1, $2)", [exam_id, qId]);
            
            for (const opt of qData.options) {
                await client.query("INSERT INTO question_options (question_id, code, text, is_correct) VALUES ($1, $2, $3, $4)", [qId, opt.code, opt.text, opt.is_correct]);
            }
        }
        await client.query('COMMIT');
        res.json({ success: true });
    } catch (err: any) { await client.query('ROLLBACK'); res.status(500).json({ error: err.message }); } finally { client.release(); }
});

// Lấy danh sách đề thi do một giáo viên (owner) tạo ra
app.get('/exams/owner/:ownerId', async (req, res) => {
    try {
        const { ownerId } = req.params;
        
        // Truy vấn lấy các đề thi do người này tạo, sắp xếp mới nhất lên đầu
        const result = await pool.query(
            "SELECT * FROM exams WHERE created_by = $1 ORDER BY created_at DESC", 
            [ownerId]
        );
        
        res.json(result.rows);
    } catch (err) {
        console.error("Lỗi khi lấy danh sách đề thi:", err);
        res.status(500).json({ error: "Lỗi server khi lấy danh sách đề" });
    }
});
// QUAN TRỌNG: Mount router vào gốc "/"
app.use("/", router);

const port = process.env.PORT || 3003;
app.listen(port, () => console.log(`🚀 Exam Service Ready on ${port}`));