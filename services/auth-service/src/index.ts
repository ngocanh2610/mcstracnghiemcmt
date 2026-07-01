// @ts-nocheck
import express, { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { Pool } from "pg";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const JWT_SECRET = process.env.JWT_SECRET || "BuiNamKhanh_SecretKey_BaoVeDoAn2026";

// ✅ ĐỊNH NGHĨA KHUÔN (INTERFACE) CHO TOKEN
// Việc này giúp TypeScript hiểu payload có chứa id, username và roles
interface MyJwtPayload extends jwt.JwtPayload {
    id: string;
    username: string;
    roles: string[];
}

// Logger kiểm soát luồng
app.use((req: Request, res: Response, next) => {
    console.log(`>>> [AUTH-INTERNAL] ${req.method} ${req.url}`);
    next();
});

// --- 1. ROUTE ĐĂNG KÝ ---
app.post("/register", async (req: Request, res: Response) => {
    // 1. Nhận dữ liệu: Lấy các thông tin cần thiết từ body của request do Frontend gửi lên
    const { username, email, password, role, full_name } = req.body;
    
    // 2. Kiểm tra (Validate): Bắt buộc phải có username và password. Nếu thiếu thì từ chối ngay.
    if (!username || !password) return res.status(400).json({ error: "Thiếu thông tin đăng ký" });

    // 3. Mượn kết nối (Connection): Lấy một client từ Pool kết nối Database để thực hiện giao dịch
    const client = await pool.connect();
    
    try {
        // 4. Mã hóa bảo mật: Băm (hash) mật khẩu bằng thuật toán bcrypt với độ khó (salt) là 10
        // Đảm bảo dù DB có bị rò rỉ thì mật khẩu gốc vẫn an toàn.
        const hash = await bcrypt.hash(password, 10);
        
        // 5. Bắt đầu Transaction (Giao dịch): Đánh dấu điểm bắt đầu. 
        // Nếu bất kỳ lệnh SQL nào ở dưới bị lỗi, tất cả sẽ bị hủy (Rollback) để tránh dữ liệu bị lưu một nửa.
        await client.query('BEGIN');
        
        // 6. Lưu User mới: Thêm thông tin vào bảng users. 
        // - Nếu email trống thì lưu null.
        // - Nếu full_name trống thì tự động lấy username làm tên hiển thị.
        // - RETURNING id: Trả về ngay ID của user vừa được tạo để dùng cho bước phân quyền bên dưới.
        const userRes = await client.query(
            "INSERT INTO users(username, email, password_hash, full_name) VALUES($1, $2, $3, $4) RETURNING id",
            [username, email || null, hash, full_name || username]
        );
        const userId = userRes.rows[0].id; // Lấy ID của user vừa tạo

        // 7. Xác định Quyền (Role): Nếu người dùng đăng ký không truyền role lên, mặc định sẽ là "student"
        const roleName = role || "student";
        
        // 8. Tìm ID của Role: Truy vấn vào bảng roles để lấy ra ID tương ứng với tên quyền (VD: student -> id 1)
        const roleRes = await client.query("SELECT id FROM roles WHERE name=$1", [roleName]);
        
        // 9. Gán quyền cho User: Nếu tìm thấy Role ID hợp lệ, thêm một bản ghi vào bảng trung gian user_roles
        if (roleRes.rows[0]) {
            await client.query(
                "INSERT INTO user_roles(user_id, role_id) VALUES($1, $2)",
                [userId, roleRes.rows[0].id]
            );
        }

        // 10. Xác nhận (Commit): Nếu mọi lệnh SQL từ bước 6 đến 9 đều chạy thành công không lỗi lầm,
        // lệnh COMMIT sẽ lưu vĩnh viễn dữ liệu xuống Database.
        await client.query('COMMIT');
        
        // Trả về HTTP 201 (Created) báo cho Frontend biết đã tạo tài khoản thành công
        res.status(201).json({ message: "Đăng ký thành công" });
        
    } catch (err) {
        // 11. Xử lý lỗi (Rollback): Nếu có bất kỳ lỗi nào (VD: trùng username do vi phạm ràng buộc Unique),
        // chạy lệnh ROLLBACK để xóa sạch những thao tác vừa thực hiện từ lúc BEGIN.
        await client.query('ROLLBACK');
        res.status(400).json({ error: "Tài khoản đã tồn tại hoặc lỗi hệ thống" });
        
    } finally {
        // 12. Dọn dẹp: Dù thành công hay thất bại, bắt buộc phải trả lại connection cho Pool 
        // để hệ thống dùng cho các request khác, tránh bị treo Database do cạn kiệt kết nối.
        client.release();
    }
});

// --- 2. ROUTE ĐĂNG NHẬP ---
app.post("/login", async (req: Request, res: Response) => {
    try {
        // 1. Nhận dữ liệu đầu vào: Lấy username và password mà người dùng nhập từ form đăng nhập.
        const { username, password } = req.body;
        
        // 2. Tìm người dùng trong Database: Lấy thông tin tài khoản dựa trên username hoặc email.
        const r = await pool.query("SELECT * FROM users WHERE username=$1 OR email=$1", [username]);
        const user = r.rows[0];

        // 3. Xác thực (Authentication):
        // - '!user': Kiểm tra xem username/email này có tồn tại trong hệ thống hay không.
        // - 'bcrypt.compare(...)': Thuật toán mã hóa một chiều không thể giải mã ngược lại.
        //   Hàm này sẽ tự động mã hóa cái 'password' vừa nhập vào và so sánh với mã băm 'password_hash' lưu trong DB.
        // => Nếu 1 trong 2 điều kiện sai, lập tức từ chối và trả về lỗi 400.
        if (!user || !(await bcrypt.compare(password, user.password_hash))) {
            return res.status(400).json({ error: "Sai tài khoản hoặc mật khẩu" });
        }

        // 4. Lấy danh sách Quyền (Role Authorization):
        // Thực hiện truy vấn JOIN (kết nối) 3 bảng: users, user_roles, và roles.
        // Mục đích: Tìm xem user.id này đang được gán những quyền gì (Ví dụ: student, teacher, admin).
        const rolesQ = await pool.query(
            "SELECT r.name FROM user_roles ur JOIN roles r ON ur.role_id=r.id WHERE ur.user_id=$1",
            [user.id]
        );
        
        // Trích xuất kết quả từ dạng mảng Object [{name: 'student'}, {name: 'admin'}] 
        // thành một mảng chuỗi đơn giản: ['student', 'admin'].
        const roles = rolesQ.rows.map((x: any) => x.name);

        // 5. Tạo Thẻ thông hành (JWT - JSON Web Token):
        // Sau khi xác thực thành công, hệ thống không lưu trạng thái đăng nhập trên Server (Stateless).
        // Thay vào đó, nó cấp một Token chứa Payload (id, username, roles).
        // Token này được ký bằng chữ ký số 'JWT_SECRET' để chống giả mạo.
        // 'expiresIn: "6h"': Đặt thời gian sống của token là 6 tiếng. Sau 6 tiếng user phải đăng nhập lại.
        const token = jwt.sign(
            { id: user.id, username: user.username, roles }, 
            JWT_SECRET, 
            { expiresIn: "6h" }
        );

        // 6. Trả kết quả về cho Frontend:
        // - Gửi 'access_token' để Frontend lưu vào LocalStorage/Cookies, dùng cho các request cần xác thực sau này.
        // - Gửi kèm object 'user' chứa thông tin cơ bản (bao gồm 'full_name' lấy từ DB) để hiển thị ngay lập tức lên giao diện (ví dụ: chữ "Xin chào, ...")
        res.json({ 
            access_token: token, 
            user: { 
                id: user.id, 
                username: user.username, 
                full_name: user.full_name || user.username, // Trả về họ tên thực hoặc lấy username làm mặc định
                roles 
            } 
        });
        
    } catch (err) {
        // 7. Xử lý ngoại lệ: Bắt các lỗi xảy ra trong quá trình chạy (ví dụ: mất kết nối Database) 
        // và trả về lỗi 500 (Internal Server Error) để tránh sập ứng dụng.
        res.status(500).json({ error: "Lỗi Server" });
    }
});

// --- 3. THÔNG TIN CÁ NHÂN (HẾT LỖI TS2339 & TS2698) ---
app.get("/me", async (req: Request, res: Response) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "No token" });
    try {
        // ✅ ÉP KIỂU SANG MyJwtPayload ĐỂ TRUY CẬP .id VÀ SPREAD OBJECT
        const payload = jwt.verify(token, JWT_SECRET) as MyJwtPayload;
        
        const r = await pool.query("SELECT email, full_name FROM users WHERE id=$1", [payload.id]);
        const dbUser = r.rows[0];

        res.json({ 
            ...payload, 
            email: dbUser?.email || "", 
            full_name: dbUser?.full_name || payload.username 
        });
    } catch {
        res.status(401).json({ error: "Invalid token" });
    }
});

// --- 4. DANH SÁCH USER ---
app.get("/users", async (req: Request, res: Response) => {
    try {
        const r = await pool.query(`
            SELECT u.id, u.username, u.email, u.full_name, r.name as role
            FROM users u
            LEFT JOIN user_roles ur ON u.id = ur.user_id
            LEFT JOIN roles r ON ur.role_id = r.id
            ORDER BY u.id DESC
        `);
        res.json(r.rows);
    } catch (err) { 
        res.status(500).json({ error: "Lỗi lấy danh sách user" }); 
    }
});

// --- 5. ĐỔI MẬT KHẨU ---
app.put("/change-password", async (req: Request, res: Response) => {
    // 1. Trích xuất Token: Lấy token từ HTTP Header 'Authorization'. 
    // Định dạng chuẩn thường là "Bearer <chuỗi_token>", nên ta dùng .split(" ")[1] để cắt lấy phần <chuỗi_token>.
    const token = req.headers.authorization?.split(" ")[1];
    
    // Nếu client không gửi lên token, lập tức chặn cửa và trả về lỗi 401 (Unauthorized - Không có quyền).
    if (!token) return res.status(401).json({ error: "No token" });

    try {
        // 2. Xác thực Token (Verify): Dùng chìa khóa bí mật (JWT_SECRET) để kiểm tra xem token này có hợp lệ không, có bị sửa đổi hay hết hạn chưa.
        // Ép kiểu 'as MyJwtPayload' để TypeScript hiểu rằng sau khi giải mã, ta sẽ có được 'payload.id' của người dùng.
        const payload = jwt.verify(token, JWT_SECRET) as MyJwtPayload;
        
        // 3. Lấy dữ liệu: Trích xuất mật khẩu cũ và mật khẩu mới do Frontend gửi lên trong req.body.
        const { oldPassword, newPassword } = req.body;

        // 4. Lấy mật khẩu hiện tại trong DB: Dùng ID (được giải mã từ token) để truy vấn lấy password_hash hiện tại của người dùng.
        const r = await pool.query("SELECT password_hash FROM users WHERE id=$1", [payload.id]);
        const user = r.rows[0];
        
        // (Trường hợp hiếm) Nếu token hợp lệ nhưng user đã bị xóa khỏi DB thì báo lỗi 404.
        if (!user) return res.status(404).json({ message: "User không tồn tại" });

        // 5. Xác minh Mật khẩu cũ: Dùng hàm 'bcrypt.compare' để so sánh 'oldPassword' người dùng nhập vào với cái 'password_hash' đang lưu.
        // Việc này cực kỳ quan trọng để đảm bảo chính chủ đang thao tác chứ không phải ai đó mượn máy tính khi chưa đăng xuất.
        const isMatch = await bcrypt.compare(oldPassword, user.password_hash);
        if (!isMatch) return res.status(400).json({ message: "Mật khẩu cũ không đúng" });

        // 6. Mã hóa Mật khẩu mới: Nếu mật khẩu cũ đúng, tiến hành băm (hash) cái 'newPassword' bằng bcrypt với độ khó là 10.
        const newHash = await bcrypt.hash(newPassword, 10);
        
        // 7. Cập nhật Database: Dùng lệnh UPDATE để ghi đè mã băm mới (newHash) vào dòng của user tương ứng trong bảng users.
        await pool.query("UPDATE users SET password_hash=$1 WHERE id=$2", [newHash, payload.id]);

        // Hoàn tất và gửi thông báo thành công cho Frontend.
        res.json({ message: "Cập nhật mật khẩu thành công" });
        
    } catch (err) {
        // 8. Xử lý ngoại lệ: Nếu token bị sai chữ ký, token đã hết hạn (expired), hoặc Database bị lỗi,
        // khối catch sẽ bắt lại và trả về lỗi 500 (hoặc có thể tùy biến thành 403 nếu do token).
        res.status(500).json({ message: "Lỗi Server hoặc Token không hợp lệ" });
    }
});

// --- 6. QUẢN LÝ TÀI KHOẢN (Admin) ---
app.put("/users/:id/role", async (req: Request, res: Response) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "No token" });
    try {
        const payload = jwt.verify(token, JWT_SECRET) as MyJwtPayload;
        if (!payload.roles.includes("admin")) return res.status(403).json({ error: "Forbidden" });

        const { id } = req.params;
        const { role } = req.body;
        
        const roleRes = await pool.query("SELECT id FROM roles WHERE name=$1", [role]);
        if (!roleRes.rows[0]) return res.status(400).json({ error: "Role không hợp lệ" });
        const roleId = roleRes.rows[0].id;

        await pool.query("DELETE FROM user_roles WHERE user_id=$1", [id]);
        await pool.query("INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)", [id, roleId]);

        res.json({ success: true });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

app.delete("/users/:id", async (req: Request, res: Response) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "No token" });
    try {
        const payload = jwt.verify(token, JWT_SECRET) as MyJwtPayload;
        if (!payload.roles.includes("admin")) return res.status(403).json({ error: "Forbidden" });

        const { id } = req.params;
        await pool.query("DELETE FROM users WHERE id=$1", [id]);
        res.json({ success: true });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

const port = process.env.PORT || 3001;
app.listen(port, () => console.log(`🔐 Auth Service (Internal) flying on ${port}`));