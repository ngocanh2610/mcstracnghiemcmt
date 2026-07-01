# 🎓 Hệ Thống Thi Trắc Nghiệm Trực Tuyến (Microservices Architecture)

Dự án Web thi trắc nghiệm trực tuyến được thiết kế và xây dựng theo kiến trúc **Microservices**. Hệ thống cung cấp giải pháp toàn diện cho việc tổ chức thi, phân quyền chặt chẽ, xử lý tự động chấm điểm khối lượng lớn (Background Task) và giao diện xem lại bài làm trực quan.

---

## 🏗 Kiến trúc hệ thống (Architecture)

Hệ thống được chia nhỏ thành các dịch vụ độc lập, giao tiếp với nhau qua API Gateway, đảm bảo tính mở rộng và chịu lỗi cao:

1. **API Gateway (`:4000`)**: Cổng giao tiếp duy nhất, xử lý xác thực token (JWT), chặn truy cập trái phép và định tuyến luồng dữ liệu (Stream Proxying) siêu tốc, giải quyết triệt để lỗi thắt cổ chai (Pending).
2. **Auth Service (`:3001`)**: Quản lý đăng nhập, đăng ký và cấp phát JWT Token.
3. **User Service (`:3002`)**: Quản lý thông tin người dùng và phân định vai trò.
4. **Exam Service (`:3003`)**: Quản lý ngân hàng câu hỏi, đề thi và đáp án chuẩn.
5. **Submission Service (`:3004`)**: Nhận bài thi, tự động chấm điểm và xử lý luồng "Chấm lại toàn bộ" chạy ngầm.
6. **Result Service (`:3005`)**: Lưu trữ điểm số (UPSERT), tính toán thống kê (Tổng điểm, Trung bình, Cao nhất, Thấp nhất).
7. **Frontend (`:5173`)**: Ứng dụng ReactJS SPA (Single Page Application).

## 🚀 Công nghệ sử dụng (Tech Stack)

* **Frontend:** ReactJS, Vite, Axios, CSS thuần.
* **Backend:** Node.js, Express.js, JSON Web Token (JWT), `http-proxy`.
* **Database:** PostgreSQL (Mỗi Microservice sở hữu một Database độc lập để đảm bảo tính đóng gói).
* **Triển khai:** Docker, Docker Compose.

---

## 🌟 Các tính năng nổi bật (Key Features)

### 1. Phân quyền truy cập chặt chẽ (RBAC - Role-Based Access Control)
* **Admin:** Giao diện tối giản, tập trung vào quyền lực tối cao: Quản lý danh sách đề thi (Xóa) và Xem thống kê tổng quan. Không bị phân tâm bởi các chức năng thi cử.
* **Teacher:** Soạn đề thi mới, chỉnh sửa nội dung/đáp án, xem thống kê chi tiết và kích hoạt tính năng chấm lại.
* **Student:** Làm bài thi với đồng hồ đếm ngược, xem lịch sử và chi tiết bài làm.

### 2. Trải nghiệm làm bài thông minh (Smart Exam Execution)
* **Tự động nộp bài (Auto-Submit):** Khi thời gian làm bài chạm `00:00`, hệ thống tự động khóa lựa chọn, đóng gói dữ liệu và nộp ngầm lên server mà không làm gián đoạn trải nghiệm.
* **Review bài làm (Azota-style):** Sau khi có điểm, sinh viên có thể xem lại chi tiết bài làm. Giao diện trực quan highlight đáp án đúng (Xanh), đáp án sai (Đỏ) và đối chiếu với lựa chọn của bản thân.

### 3. Xử lý ngầm hiệu năng cao (Background Processing)
* **Tính năng Chấm lại (Regrade):** Khi giáo viên phát hiện đề sai và sửa lại đáp án, hệ thống cho phép chấm lại toàn bộ hàng trăm bài nộp.
* **Cơ chế:** Backend lập tức trả về phản hồi thành công để giải phóng giao diện người dùng, trong khi đó tiến trình chấm điểm và cập nhật Database vẫn lẳng lặng chạy ngầm phía sau (Non-blocking I/O).

---

## 🛠 Hướng dẫn Cài đặt & Khởi chạy (Getting Started)

### Yêu cầu tiên quyết
Đảm bảo máy tính của bạn đã cài đặt:
* **Docker Desktop** (Bắt buộc bật trước khi chạy).
* **Git**.
* (Tùy chọn) Node.js 18+ để dev độc lập.

### Các bước khởi chạy dự án

**Bước 1: Tải mã nguồn**
```bash
git clone <đường-dẫn-repo-của-nhóm>
cd "web thi TN"

Bước 2: Khởi động hệ thống Microservices
Mở Terminal tại thư mục gốc của dự án và chạy:

Bash
docker compose up -d --build
(Lưu ý: Lần chạy đầu có thể mất 3-5 phút để tải Image và build Container. Các lần sau sẽ rất nhanh).

Bước 3: Truy cập hệ thống

Frontend (Giao diện người dùng): http://localhost:5173

API Gateway (Cổng Backend): http://localhost:4000

📝 Quy trình & Tiêu chuẩn làm việc nhóm
Để dự án vận hành trơn tru, các thành viên cần lưu ý các quy tắc sau:

Gỡ lỗi (Debugging): Nếu gặp lỗi không phản hồi (Pending) hoặc lỗi 500, hãy kiểm tra log của Gateway và Service liên quan bằng lệnh:

Bash
docker compose logs -f api-gateway submission-service
Cập nhật Database:
Mỗi Service có thư mục sql/ riêng. Khi thay đổi cấu trúc bảng, hãy sửa file SQL tương ứng, sau đó làm sạch và khởi tạo lại volume:

Bash
docker compose down -v
docker compose up -d --build
(Cảnh báo: Lệnh này sẽ xóa toàn bộ dữ liệu hiện tại).

Kiểm tra kết nối mạng nội bộ:
Các Service gọi nhau thông qua biến môi trường (Environment Variables) cấu hình trong docker-compose.yml, không dùng localhost trong code Backend.

Bảo mật file .env:
Các biến số nhạy cảm (JWT Secret, Database URL) phải được giữ trong file .env và tuyệt đối không push file này lên Git (đã khai báo trong .gitignore).