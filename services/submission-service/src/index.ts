import express from "express";
import { Pool } from "pg";
import cors from "cors";
import jwt from "jsonwebtoken";
import axios from "axios";

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({ 
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 5000 
});

const JWT_SECRET = process.env.JWT_SECRET || "khanh_secret_key_2026";
const RESULT_SERVICE_URL = process.env.RESULT_SERVICE_URL || "http://result-service:3005";
const EXAM_SERVICE_URL = process.env.EXAM_SERVICE_URL || "http://exam-service:3003"; 

// Tạo instance axios có timeout để không bao giờ bị treo (Pending)
const http = axios.create({ timeout: 5000 });

app.use((req, res, next) => {
    console.log(`>>> [SUBMISSION-SERVICE] ${req.method} ${req.url}`);
    next();
});

// --- 1.1 ENDPOINT NỘP BÀI (POST /) ---
app.post("/", async (req, res) => {
    const { exam_id, user_id, answers, duration_seconds } = req.body;
    if (!exam_id || !user_id || !answers) return res.status(400).json({ error: "Dữ liệu thiếu" });

    try {
        const examRes = await http.get(`${EXAM_SERVICE_URL}/internal/${exam_id}/answers`);
        const questions = examRes.data.questions;

        let correct_count = 0;
        questions.forEach((q: any) => {
            const correctOption = q.options.find((opt: any) => opt.is_correct === true);
            const studentAnswer = answers[q.id];
            if (correctOption && studentAnswer) {
                if (studentAnswer.toString().trim().toUpperCase() === correctOption.code.toString().trim().toUpperCase()) {
                    correct_count++;
                }
            }
        });

        const score = questions.length > 0 ? Math.round((correct_count / questions.length) * 10 * 100) / 100 : 0;

        // KIỂM TRA: ĐÃ CÓ BẢN NHÁP (draft) DO AUTOSAVE TẠO CHƯA?
        let submissionId;
        const checkDraft = await pool.query(
            "SELECT id FROM submissions WHERE exam_id = $1 AND user_id = $2 AND status = 'draft' ORDER BY created_at DESC LIMIT 1",
            [exam_id, user_id]
        );

        if (checkDraft.rows.length > 0) {
            // Có bản nháp -> Ghi đè đáp án cuối cùng và ĐỔI TRẠNG THÁI THÀNH 'completed'
            submissionId = checkDraft.rows[0].id;
            await pool.query(
                "UPDATE submissions SET answers = $1, duration_seconds = $2, status = 'completed' WHERE id = $3",
                [JSON.stringify(answers), duration_seconds || 0, submissionId]
            );
        } else {
            // Chưa có bản nháp -> Tạo dòng mới cứng với status 'completed'
            const result = await pool.query(
                "INSERT INTO submissions (exam_id, user_id, answers, duration_seconds, status, created_at) VALUES ($1, $2, $3, $4, 'completed', NOW()) RETURNING id",
                [exam_id, user_id, JSON.stringify(answers), duration_seconds || 0]
            );
            submissionId = result.rows[0].id;
        }

        // Gửi điểm sang Result Service (Chạy ngầm)
        http.post(`${RESULT_SERVICE_URL}/`, {
            submission_id: submissionId, exam_id, user_id, correct_count, total_questions: questions.length, score
        }).catch(err => console.error("!!! Lỗi gửi điểm:", err.message));

        res.status(201).json({ message: "Nộp bài thành công", submission_id: submissionId, score });
    } catch (err: any) {
        console.error("!!! Lỗi nộp bài:", err.message);
        res.status(500).json({ error: "Lỗi hệ thống khi nộp bài" });
    }
});

// --- 1.2 ENDPOINT LƯU NHÁP (POST /autosave) ---
app.post("/autosave", async (req, res) => {
    const { exam_id, user_id, answers, duration_seconds } = req.body;
    if (!exam_id || !user_id) return res.status(400).json({ error: "Thiếu exam_id hoặc user_id" });

    try {
        // Tìm xem học sinh này có ĐANG làm dở bản nháp nào không (status = 'draft')
        const checkDraft = await pool.query(
            "SELECT id FROM submissions WHERE exam_id = $1 AND user_id = $2 AND status = 'draft' ORDER BY created_at DESC LIMIT 1",
            [exam_id, user_id]
        );

        if (checkDraft.rows.length > 0) {
            // Đã có nháp -> Chỉ Cập nhật (UPDATE)
            await pool.query(
                "UPDATE submissions SET answers = $1, duration_seconds = $2 WHERE id = $3",
                [JSON.stringify(answers || {}), duration_seconds || 0, checkDraft.rows[0].id]
            );
        } else {
            // Chưa có nháp -> Thêm mới (INSERT) với status là 'draft'
            await pool.query(
                "INSERT INTO submissions (exam_id, user_id, answers, duration_seconds, status, created_at) VALUES ($1, $2, $3, $4, 'draft', NOW())",
                [exam_id, user_id, JSON.stringify(answers || {}), duration_seconds || 0]
            );
        }
        res.status(200).json({ message: "Đã lưu nháp" });
    } catch (err: any) {
        console.error("!!! Lỗi lưu nháp:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// --- 1.3 ENDPOINT LẤY BẢN NHÁP (PHIÊN BẢN CHỈ LẤY 'draft') ---
app.get("/draft/:exam_id/:user_id", async (req, res) => {
    const { exam_id, user_id } = req.params;

    try {
        // CHỈ LẤY những bài có trạng thái là 'draft'
        const draft = await pool.query(
            "SELECT answers, duration_seconds FROM submissions WHERE exam_id = $1 AND user_id = $2 AND status = 'draft' ORDER BY created_at DESC LIMIT 1",
            [exam_id, user_id]
        );
        
        if (draft.rows.length > 0) {
            return res.status(200).json(draft.rows[0]);
        } else {
            return res.status(200).json(null);
        }
    } catch (err: any) {
        console.error("❌ LỖI BACKEND:", err.message);
        return res.status(500).json({ error: err.message });
    }
});

// --- 2. LẤY LỊCH SỬ THI ---
app.get("/my", async (req, res) => {
    const auth = req.headers.authorization;
    if (!auth) return res.status(401).json({ error: "Thiếu Token" });
    try {
        const token = auth.split(" ")[1];
        const decoded: any = jwt.verify(token, JWT_SECRET);
        
        // CHỈ hiển thị những bài ĐÃ NỘP (status = 'completed') ra lịch sử
        const r = await pool.query(
            "SELECT * FROM submissions WHERE user_id = $1 AND status = 'completed' ORDER BY created_at DESC", 
            [decoded.id]
        );
        
        const subs = await Promise.all(r.rows.map(async (sub) => {
            try {
                const resSc = await http.get(`${RESULT_SERVICE_URL}/submission/${sub.id}`);
                return { ...sub, score: resSc.data.score };
            } catch { return { ...sub, score: "Đang chấm..." }; }
        }));
        res.json(subs);
    } catch { res.status(401).json({ error: "Token sai" }); }
});

// --- 3. TÍNH NĂNG CHẤM LẠI (BACKGROUND PROCESSING) ---
app.post("/regrade/:examId", async (req, res) => {
    const { examId } = req.params;
    
    // PHẢN HỒI NGAY cho Gateway để không bị Pending
    res.json({ success: true, message: "Hệ thống đã nhận lệnh và đang chấm lại ngầm..." });

    // BẮT ĐẦU XỬ LÝ NGẦM (IIFE)
    (async () => {
        console.log(`[RE-GRADE] >>> Bắt đầu chạy ngầm cho đề: ${examId}`);
        try {
            const examRes = await http.get(`${EXAM_SERVICE_URL}/internal/${examId}/answers`);
            const questions = examRes.data.questions;
            const subRes = await pool.query("SELECT * FROM submissions WHERE exam_id = $1 AND status = 'completed'", [examId]);
            const allSubmissions = subRes.rows;

            const tasks = allSubmissions.map(async (sub) => {
                try {
                    let correct_count = 0;
                    const answers = sub.answers ? (typeof sub.answers === 'string' ? JSON.parse(sub.answers) : sub.answers) : {};

                    questions.forEach((q: any) => {
                        const correctOpt = q.options.find((opt: any) => opt.is_correct === true);
                        const studentChoice = answers[q.id];
                        if (correctOpt && studentChoice && 
                            studentChoice.toString().trim().toUpperCase() === correctOpt.code.toString().trim().toUpperCase()) {
                            correct_count++;
                        }
                    });

                    const newScore = questions.length > 0 ? Math.round((correct_count / questions.length) * 10 * 100) / 100 : 0;

                    return await http.post(`${RESULT_SERVICE_URL}/`, {
                        submission_id: sub.id, exam_id: examId, user_id: sub.user_id, correct_count, total_questions: questions.length, score: newScore
                    });
                } catch (e: any) {
                    console.error(`[RE-GRADE] Lỗi bài ${sub.id}:`, e.message);
                }
            });

            await Promise.allSettled(tasks);
            console.log(`[RE-GRADE] <<< Hoàn tất chấm lại cho ${allSubmissions.length} bài.`);
        } catch (err: any) {
            console.error("!!! [RE-GRADE] Lỗi ngầm:", err.message);
        }
    })();
});

// --- 4. TÍNH NĂNG XEM LẠI BÀI LÀM  ---
// Định tuyến này PHẢI nằm trước /:id
app.get("/review/:id", async (req, res) => {
    try {
        // Lấy bài nộp
        const r = await pool.query("SELECT * FROM submissions WHERE id = $1", [req.params.id]);
        if (r.rows.length === 0) return res.status(404).json({ error: "Không tìm thấy bài nộp" });
        const sub = r.rows[0];

        // Lấy đáp án chuẩn từ Exam Service
        const examRes = await http.get(`${EXAM_SERVICE_URL}/internal/${sub.exam_id}/answers`);
        const questions = examRes.data.questions;
        const answers = sub.answers ? (typeof sub.answers === 'string' ? JSON.parse(sub.answers) : sub.answers) : {};

        // Gộp dữ liệu: So sánh
        const review = questions.map((q: any) => {
            const correctOpt = q.options.find((opt: any) => opt.is_correct === true);
            const studentChoice = answers[q.id];
            const isCorrect = correctOpt && studentChoice && 
                studentChoice.toString().trim().toUpperCase() === correctOpt.code.toString().trim().toUpperCase();

            return {
                id: q.id,
                text: q.text,
                options: q.options.map((o: any) => ({ code: o.code, text: o.text })), // Ẩn is_correct đi để an toàn
                studentChoice: studentChoice || null,
                correctChoice: correctOpt ? correctOpt.code : null,
                isCorrect
            };
        });

        res.json({ title: examRes.data.exam.title, review });
    } catch (err: any) {
        console.error("Lỗi tạo Review:", err.message);
        res.status(500).json({ error: "Lỗi hệ thống khi tải chi tiết bài làm" });
    }
});

// --- 5. INTERNAL API ---
// Bắt ID động nên luôn phải nằm dưới cùng của các route GET
app.get("/:id", async (req, res) => {
    try {
        const r = await pool.query("SELECT * FROM submissions WHERE id = $1", [req.params.id]);
        if (r.rows.length === 0) return res.status(404).json({ error: "Không thấy bài" });
        res.json(r.rows[0]);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
});

const port = process.env.PORT || 3004;
app.listen(port, () => console.log(`🚀 SUBMISSION SERVICE READY ON ${port}`));