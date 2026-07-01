import './App.css';
import React, { useState, useEffect } from "react";
import axios from "axios";

import { AdminPanel } from "./pages/Admin";
import { TeacherPanel, ExamStats, ExamQuestionEditor, QuestionBankManager, ExamManager } from "./pages/Teacher";
import { StudentHistory, ExamTake, StudentDashboard } from "./pages/Student";
import { ProfileSettings } from "./pages/Profile";
import { API } from "./config";

// --- 1a. COMPONENT ĐĂNG NHẬP (ĐÃ KHÔI PHỤC QUÊN MẬT KHẨU) ---
function Login({ onLogin, onSwitchRegister }) {
  const [u, setU] = useState(localStorage.getItem("savedUsername") || "");
  const [p, setP] = useState(localStorage.getItem("savedPassword") || "");
  const [rememberMe, setRememberMe] = useState(!!localStorage.getItem("savedUsername"));
  const [loading, setLoading] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false); // ✅ Khôi phục state modal

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const r = await axios.post(`${API}/auth/login`, { username: u, password: p });
      localStorage.setItem("user", JSON.stringify(r.data.user));
      if (rememberMe) {
        localStorage.setItem("savedUsername", u);
        localStorage.setItem("savedPassword", p);
      } else {
        localStorage.removeItem("savedUsername");
        localStorage.removeItem("savedPassword");
      }
      onLogin(r.data.access_token);
    } catch (err) {
      console.error("Login error:", err);
      const serverMessage = err?.response?.data?.error || err?.response?.data?.message || err?.message || "Lỗi không xác định";
      alert(`Đăng nhập thất bại: ${serverMessage}`);
    } finally { setLoading(false); }
  }

  return (
    <div className="login-container">
      <form className="login-card" onSubmit={handleSubmit}>
        <h2>Welcome Back</h2>
        <input className="login-input" placeholder="Tên đăng nhập hoặc email" value={u} onChange={e => setU(e.target.value)} required />
        <input className="login-input" type="password" placeholder="Mật khẩu" value={p} onChange={e => setP(e.target.value)} required />

        <div className="login-options">
          <label className="remember-me">
            <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} />
            <span>Ghi nhớ</span>
          </label>
          {/* ✅ KHÔI PHỤC LINK QUÊN MẬT KHẨU */}
          <span className="forgot-password" onClick={() => setShowForgotModal(true)} style={{ color: '#4f46e5', cursor: 'pointer', fontSize: '13px' }}>
            Quên mật khẩu?
          </span>
        </div>

        <button type="submit" className="btn-primary login-btn" disabled={loading}>
          {loading ? "Đang xử lý..." : "Đăng nhập"}
        </button>
        <p style={{ marginTop: '15px', textAlign: 'center', color: '#64748b', fontSize: '14px' }}>
          Chưa có tài khoản? <span style={{ color: '#4f46e5', cursor: 'pointer', fontWeight: 'bold' }} onClick={onSwitchRegister}>Tạo tài khoản</span>
        </p>
      </form>

      {/* ✅ KHÔI PHỤC GIAO DIỆN MODAL QUÊN MẬT KHẨU */}
      {showForgotModal && (
        <div className="custom-modal-overlay">
          <div className="custom-modal-content">
            <h3>Khôi phục mật khẩu</h3>
            <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '15px' }}>
              Nhập email của bạn để nhận hướng dẫn đặt lại mật khẩu.
            </p>
            <input className="login-input" type="email" placeholder="Nhập email..." style={{ marginBottom: '15px' }} />
            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn-primary" style={{ flex: 1 }} onClick={() => { alert("Yêu cầu đã gửi! Vui lòng kiểm tra email."); setShowForgotModal(false); }}>Gửi</button>
              <button className="btn-outline" style={{ flex: 1 }} onClick={() => setShowForgotModal(false)}>Hủy</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- 1b. COMPONENT ĐĂNG KÝ (GIỮ NGUYÊN HỌ TÊN) ---
function Register({ onSwitch }) {
  const [form, setForm] = useState({ u: "", fn: "", p: "", cp: "", email: "" });
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    if (form.p !== form.cp) return setError("Mật khẩu xác nhận không khớp!");
    try {
      await axios.post(`${API}/auth/register`, {
        username: form.u, password: form.p, email: form.email, full_name: form.fn
      });
      alert("Đăng ký thành công!"); onSwitch();
    } catch (err) { setError("Lỗi đăng ký!"); }
  }

  return (
    <div className="login-container">
      <form className="login-card" onSubmit={handleSubmit}>
        <h2>Tạo tài khoản mới</h2>
        <input className="login-input" placeholder="Tên đăng nhập" onChange={e => setForm({ ...form, u: e.target.value })} required />
        <input className="login-input" placeholder="Họ và tên thực (VD: Bùi Nam Khánh)" onChange={e => setForm({ ...form, fn: e.target.value })} required />
        <input className="login-input" type="email" placeholder="Email" onChange={e => setForm({ ...form, email: e.target.value })} required />
        <input className="login-input" type="password" placeholder="Mật khẩu" onChange={e => setForm({ ...form, p: e.target.value })} required />
        <input className="login-input" type="password" placeholder="Xác nhận mật khẩu" onChange={e => setForm({ ...form, cp: e.target.value })} required />
        {error && <div style={{ color: 'red', marginBottom: 10 }}>{error}</div>}
        <button type="submit" className="btn-primary login-btn">Đăng ký ngay</button>
        <p style={{ marginTop: '15px', textAlign: 'center' }}>Đã có tài khoản? <span style={{ color: '#4f46e5', cursor: 'pointer', fontWeight: 'bold' }} onClick={onSwitch}>Đăng nhập</span></p>
      </form>
    </div>
  );
}

// --- 2. COMPONENT CHÍNH (APP) ---
function App() {
  const [token, setToken] = useState(localStorage.getItem("token") || "");
  const [isRegister, setIsRegister] = useState(false);

  useEffect(() => {
    if (token) localStorage.setItem("token", token);
    else { localStorage.removeItem("token"); localStorage.removeItem("user"); }
  }, [token]);

  if (!token) {
    return isRegister ? <Register onSwitch={() => setIsRegister(false)} /> : <Login onLogin={setToken} onSwitchRegister={() => setIsRegister(true)} />;
  }
  return <Main token={token} onLogout={() => setToken("")} />;
}

// --- 3. COMPONENT GIAO DIỆN CHÍNH (MAIN) ---
function Main({ token, onLogout }) {
  const [me, setMe] = useState(null);
  const [exams, setExams] = useState([]);
  const [view, setView] = useState("exam_list");
  const [selected, setSelected] = useState(null);

  const fetchExams = () => axios.get(`${API}/exams`).then(r => setExams(r.data));

  useEffect(() => {
    const savedUser = JSON.parse(localStorage.getItem("user") || "{}");
    if (savedUser.full_name) setMe(savedUser);

    axios.get(`${API}/auth/me`, { headers: { Authorization: "Bearer " + token } })
      .then(r => { setMe(r.data); localStorage.setItem("user", JSON.stringify(r.data)); })
      .catch(onLogout);
    fetchExams();
  }, [token]);

  if (!me) return <div style={{ padding: '50px', textAlign: 'center' }}>Đang kết nối hệ thống...</div>;

  const roles = (me.roles || []).map(r => r.toLowerCase());
  const isStudent = roles.includes("student");
  const isTeacher = roles.includes("teacher");
  const isAdmin = roles.includes("admin");

  const menuItems = [
    { id: "exam_list", label: "Trang chủ", icon: "🏠", show: true },
    { id: "take_exam", label: "Vào thi", icon: "📝", show: isStudent },
    { id: "history", label: "Lịch sử", icon: "🕒", show: isStudent },
    { id: "create_exam", label: "Soạn đề mới", icon: "➕", show: isTeacher },
    { id: "question_bank", label: "Ngân hàng câu", icon: "🗄️", show: isTeacher },
    { id: "manage_exams", label: "Quản lý kho đề", icon: "📁", show: isTeacher || isAdmin },
    { id: "admin_panel", label: "Quản trị hệ thống", icon: "⚙️", show: isAdmin },
    { id: "profile", label: "Hồ sơ cá nhân", icon: "👤", show: true }
  ];

  return (
    <div className="modern-layout">
      <div className="modern-sidebar">
        <div className="sidebar-brand">🎓 THI TRẮC NGHIỆM</div>
        <div className="sidebar-user">
          <div style={{ fontWeight: 'bold' }}>{me.full_name || me.username}</div>
          <div style={{ fontSize: '11px', color: '#64748b' }}>{roles.join(", ").toUpperCase()}</div>
        </div>
        <div className="sidebar-menu">
          {menuItems.filter(i => i.show).map(item => (
            <button key={item.id} className={`nav-item ${view === item.id ? "active" : ""}`} onClick={() => setView(item.id)}>
              {item.icon} {item.label}
            </button>
          ))}
        </div>
        <div className="sidebar-footer">
          <button className="btn-logout-modern" onClick={onLogout}>🚪 Đăng xuất</button>
        </div>
      </div>

      <div className="modern-content">
        {view === "exam_list" && (
          <div className="animate-fade-in" style={{ textAlign: 'center', padding: '40px' }}>
            <h1>Xin chào, {me.full_name || me.username}! 👋</h1>
            <p>Hôm nay bạn muốn thực hiện thử thách nào?</p>
          </div>
        )}
        {view === "take_exam" && <StudentDashboard token={token} exams={exams} onTakeExam={setSelected} />}
        {view === "history" && <StudentHistory token={token} exams={exams} />}
        {view === "create_exam" && <TeacherPanel token={token} me={me} refresh={() => { fetchExams(); setView("manage_exams"); }} />}
        {view === "question_bank" && <QuestionBankManager token={token} />}
        {view === "manage_exams" && <ExamManager token={token} me={me} />}
        {view === "admin_panel" && <AdminPanel token={token} refresh={fetchExams} />}
        {view === "profile" && <ProfileSettings token={token} user={me} />}
      </div>

      {selected && (
        <ExamTake
          token={token}
          examId={selected}
          me={me}
          onClose={(gotoHistory) => {
            setSelected(null);
            if (gotoHistory === true) setView("history");
          }}
        />
      )}
    </div>
  );
}

export default App;