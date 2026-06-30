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
    // 1. Nhận dữ liệu từ Frontend khi học sinh bấm "Nộp bài"
    const { exam_id, user_id, answers, duration_seconds } = req.body;
    
    // Kiểm tra dữ liệu: Thiếu ID đề, ID học sinh hoặc bộ đáp án thì chặn lại ngay
    if (!exam_id || !user_id || !answers) return res.status(400).json({ error: "Dữ liệu thiếu" });

    try {
        // 2. GIAO TIẾP MICROSERVICES: Gọi sang Exam Service để lấy ĐÁP ÁN GỐC
        const examRes = await http.get(`${EXAM_SERVICE_URL}/internal/${exam_id}/answers`);
        const questions = examRes.data.questions;

        // 3. THUẬT TOÁN CHẤM ĐIỂM TỰ ĐỘNG
        let correct_count = 0;
        questions.forEach((q: any) => {
            // Tìm ra đáp án đúng của câu hỏi hiện tại từ dữ liệu gốc
            const correctOption = q.options.find((opt: any) => opt.is_correct === true);
            // Lấy đáp án mà học sinh đã chọn (ví dụ: "A", "B")
            const studentAnswer = answers[q.id];
            
            if (correctOption && studentAnswer) {
                // So sánh đáp án: Dùng toString(), trim() và toUpperCase() để đảm bảo 
                // không bị sai lệch do khoảng trắng hay chữ hoa/chữ thường (ví dụ " a " vẫn tính là đúng bằng "A").
                if (studentAnswer.toString().trim().toUpperCase() === correctOption.code.toString().trim().toUpperCase()) {
                    correct_count++; // Nếu khớp thì cộng 1 câu đúng
                }
            }
        });

        // 4. Tính điểm thang 10: 
        const score = questions.length > 0 ? Math.round((correct_count / questions.length) * 10 * 100) / 100 : 0;

        // 5. XỬ LÝ DATABASE: NỐI TIẾP LOGIC CỦA AUTOSAVE (LƯU NHÁP)
        let submissionId;
        // Kiểm tra xem hệ thống có đang lưu giữ bản nháp (draft) nào của học sinh này không
        const checkDraft = await pool.query(
            "SELECT id FROM submissions WHERE exam_id = $1 AND user_id = $2 AND status = 'draft' ORDER BY created_at DESC LIMIT 1",
            [exam_id, user_id]
        );

        if (checkDraft.rows.length > 0) {
            // TÌNH HUỐNG A: Có bản nháp
            // Update ghi đè bộ đáp án cuối cùng, cập nhật thời gian làm bài, 
            // và quan trọng nhất: ĐỔI TRẠNG THÁI (status) thành 'completed' (Đã hoàn thành).
            submissionId = checkDraft.rows[0].id;
            await pool.query(
                "UPDATE submissions SET answers = $1, duration_seconds = $2, status = 'completed' WHERE id = $3",
                [JSON.stringify(answers), duration_seconds || 0, submissionId]
            );
        } else {
            // TÌNH HUỐNG B: Không có bản nháp (Trường hợp học sinh làm quá nhanh, hoặc lỗi mạng nên autosave chưa kịp chạy)
            // Tạo hẳn một bản ghi mới toanh, chốt luôn trạng thái là 'completed'.
            const result = await pool.query(
                "INSERT INTO submissions (exam_id, user_id, answers, duration_seconds, status, created_at) VALUES ($1, $2, $3, $4, 'completed', NOW()) RETURNING id",
                [exam_id, user_id, JSON.stringify(answers), duration_seconds || 0]
            );
            submissionId = result.rows[0].id;
        }

        // 6. GIAO TIẾP MICROSERVICES LẦN 2: BẮN ĐIỂM SANG RESULT SERVICE (EVENT-DRIVEN CƠ BẢN)
        http.post(`${RESULT_SERVICE_URL}/`, {
            submission_id: submissionId, exam_id, user_id, correct_count, total_questions: questions.length, score
        }).catch(err => console.error("!!! Lỗi gửi điểm:", err.message));

        // 7. Hoàn tất: Trả về HTTP 201 cùng số điểm nóng hổi cho Frontend hiển thị.
        res.status(201).json({ message: "Nộp bài thành công", submission_id: submissionId, score });
        
    } catch (err: any) {
        // 8. Bắt lỗi tổng
        console.error("!!! Lỗi nộp bài:", err.message);
        res.status(500).json({ error: "Lỗi hệ thống khi nộp bài" });
    }
});

// --- 1.2 ENDPOINT LƯU NHÁP (POST /autosave) ---
app.post("/autosave", async (req, res) => {
    // 1. Nhận dữ liệu: Lấy ID đề thi, ID học sinh, bộ đáp án đang chọn dở và thời gian đã trôi qua
    const { exam_id, user_id, answers, duration_seconds } = req.body;
    
    // 2. Kiểm tra hợp lệ: Bắt buộc phải có định danh đề thi và người dùng
    if (!exam_id || !user_id) return res.status(400).json({ error: "Thiếu exam_id hoặc user_id" });

    try {
        // 3. Kiểm tra bài thi dở dang (Draft Check):
        // Tìm trong Database xem học sinh này có đang làm dở cái đề này không.
        // Chỉ tìm những bản ghi có trạng thái là 'draft' (đang nháp). Nếu đã 'submitted' (đã nộp) thì bỏ qua.
        // Dùng 'ORDER BY created_at DESC LIMIT 1' để đề phòng lỗi có nhiều bản nháp, ta lấy bản nháp mới nhất.
        const checkDraft = await pool.query(
            "SELECT id FROM submissions WHERE exam_id = $1 AND user_id = $2 AND status = 'draft' ORDER BY created_at DESC LIMIT 1",
            [exam_id, user_id]
        );

        if (checkDraft.rows.length > 0) {
            // 4A. Đã có nháp -> Cập nhật (UPDATE)
            // Lấy id của bản nháp tìm được và đè bộ đáp án mới nhất (answers) cùng thời gian làm bài (duration_seconds) lên.
            // Dùng JSON.stringify() để chuyển đổi Object đáp án thành chuỗi JSON trước khi lưu vào PostgreSQL.
            await pool.query(
                "UPDATE submissions SET answers = $1, duration_seconds = $2 WHERE id = $3",
                [JSON.stringify(answers || {}), duration_seconds || 0, checkDraft.rows[0].id]
            );
        } else {
            // 4B. Chưa có nháp -> Tạo mới (INSERT)
            // Lần đầu tiên hệ thống tự động lưu, nó sẽ tạo ra một record hoàn toàn mới 
            // Gắn cứng status là 'draft' để đánh dấu đây là bài đang làm, chưa phải kết quả cuối.
            await pool.query(
                "INSERT INTO submissions (exam_id, user_id, answers, duration_seconds, status, created_at) VALUES ($1, $2, $3, $4, 'draft', NOW())",
                [exam_id, user_id, JSON.stringify(answers || {}), duration_seconds || 0]
            );
        }

        // 5. Trả về thành công
        res.status(200).json({ message: "Đã lưu nháp" });
        
    } catch (err: any) {
        // 6. Xử lý lỗi: Ghi log lỗi ra console Server để dễ debug và trả về lỗi 500 cho Frontend
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