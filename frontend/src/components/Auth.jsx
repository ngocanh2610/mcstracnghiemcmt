import React, { useState } from "react";
import axios from "axios";
import { API } from "../config";

export function Login({ onLogin, onSwitchRegister }) { 
  const [u, setU] = useState(localStorage.getItem("savedUsername") || "");
  const [p, setP] = useState(localStorage.getItem("savedPassword") || "");
  const [rememberMe, setRememberMe] = useState(!!localStorage.getItem("savedUsername"));
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const r = await axios.post(`${API}/auth/login`, { username: u, password: p });
      if (rememberMe) {
        localStorage.setItem("savedUsername", u);
        localStorage.setItem("savedPassword", p);
      } else {
        localStorage.removeItem("savedUsername");
        localStorage.removeItem("savedPassword");
      }
      onLogin(r.data.access_token);
    } catch (err) { 
      alert("Đăng nhập thất bại! Kiểm tra lại tài khoản hoặc mật khẩu."); 
    } finally { 
      setLoading(false); 
    }
  }

  return (
    <div className="login-container">
      <form className="login-card" onSubmit={handleSubmit}>
        <div style={{marginBottom: '30px'}}>
           <h2 style={{margin: '0 0 10px 0', color: '#1e293b', fontSize: '28px'}}>Welcome Back</h2>
           <p style={{margin: 0, color: '#64748b', fontSize: '15px'}}>Đăng nhập để tiếp tục hệ thống.</p>
        </div>

        <input className="login-input" placeholder="Tên đăng nhập" value={u} onChange={e => setU(e.target.value)} required />
        <div style={{ position: 'relative' }}>
          <input
            className="login-input"
            type={showPassword ? "text" : "password"}
            placeholder="Mật khẩu"
            value={p}
            onChange={e => setP(e.target.value)}
            required
            style={{ paddingRight: '40px' }}
          />
          <span
            onClick={() => setShowPassword((v) => !v)}
            style={{
              position: 'absolute',
              right: 10,
              top: '50%',
              transform: 'translateY(-50%)',
              cursor: 'pointer',
              color: '#64748b',
              fontSize: 18,
              userSelect: 'none',
            }}
            title={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
          >
            {showPassword ? '👁️' : '🙈'}
          </span>
        </div>
        
        <div className="login-options">
          <label className="remember-me">
            <input 
              type="checkbox" 
              checked={rememberMe} 
              onChange={(e) => setRememberMe(e.target.checked)} 
            />
            <span>Ghi nhớ đăng nhập</span>
          </label>
          <span className="forgot-password" onClick={() => setShowForgotModal(true)}>
            Quên mật khẩu?
          </span>
        </div>

        <button type="submit" className="btn-primary login-btn" disabled={loading}>
          {loading ? "Đang xử lý..." : "Đăng nhập"}
        </button>
        
        <p style={{ marginTop: '25px', textAlign: 'center', color: '#64748b', fontSize: '14px' }}>
          Chưa có tài khoản? <span style={{ color: '#4f46e5', cursor: 'pointer', fontWeight: 'bold' }} onClick={onSwitchRegister}>Tạo tài khoản</span>
        </p>
      </form>

      {showForgotModal && (
        <div className="custom-modal-overlay">
          <div className="custom-modal-content">
            <h3 style={{margin: '0 0 10px 0', color: '#1e293b', fontSize: '20px'}}>Khôi phục mật khẩu</h3>
            <p style={{color: '#64748b', fontSize: '14px', marginBottom: '20px', lineHeight: '1.5'}}>
              Vui lòng nhập địa chỉ email liên kết với tài khoản của bạn. Chúng tôi sẽ gửi hướng dẫn đặt lại mật khẩu.
            </p>
            <input className="login-input" type="email" placeholder="Nhập email của bạn..." style={{marginBottom: '20px'}} />
            <div style={{display: 'flex', gap: '10px'}}>
              <button 
                className="btn-primary" 
                style={{flex: 1}} 
                onClick={() => {
                  alert("Hệ thống đã ghi nhận yêu cầu. Vui lòng kiểm tra hộp thư đến!");
                  setShowForgotModal(false);
                }}
              >
                Gửi yêu cầu
              </button>
              <button className="btn-outline" style={{flex: 1}} onClick={() => setShowForgotModal(false)}>
                Hủy bỏ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function Register({ onSwitch }) {
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [confirmP, setConfirmP] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (p !== confirmP) {
      setError("Mật khẩu xác nhận không khớp!");
      return;
    }
    try {
      await axios.post(`${API}/auth/register`, { username: u, password: p, email: email });
      alert("Đăng ký thành công!"); onSwitch();
    } catch (err) { setError("Lỗi đăng ký!"); }
  }
  
  return (
    <div className="login-container">
      <form className="login-card" onSubmit={handleSubmit}>
        <h2>Tạo tài khoản mới</h2>
        <input className="login-input" placeholder="Username" value={u} onChange={e => setU(e.target.value)} required />
        <input className="login-input" type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
        <div style={{ position: 'relative', marginBottom: 10 }}>
          <input
            className="login-input"
            type={showPassword ? "text" : "password"}
            placeholder="Password"
            value={p}
            onChange={e => setP(e.target.value)}
            required
            style={{ paddingRight: '40px' }}
          />
          <span
            onClick={() => setShowPassword(v => !v)}
            style={{
              position: 'absolute',
              right: 10,
              top: '50%',
              transform: 'translateY(-50%)',
              cursor: 'pointer',
              color: '#64748b',
              fontSize: 18,
              userSelect: 'none',
            }}
          >
            {showPassword ? '👁️' : '🙈'}
          </span>
        </div>
        <div style={{ position: 'relative', marginBottom: 10 }}>
          <input
            className="login-input"
            type={showConfirmPassword ? "text" : "password"}
            placeholder="Xác nhận mật khẩu"
            value={confirmP}
            onChange={e => setConfirmP(e.target.value)}
            required
            style={{ paddingRight: '40px' }}
          />
          <span
            onClick={() => setShowConfirmPassword(v => !v)}
            style={{
              position: 'absolute',
              right: 10,
              top: '50%',
              transform: 'translateY(-50%)',
              cursor: 'pointer',
              color: '#64748b',
              fontSize: 18,
              userSelect: 'none',
            }}
          >
            {showConfirmPassword ? '👁️' : '🙈'}
          </span>
        </div>
        {error && <div style={{color: 'red', marginBottom: 10, fontSize: 14}}>{error}</div>}
        <button type="submit" className="btn-primary login-btn">Đăng ký ngay</button>
        <p style={{marginTop: '15px', textAlign: 'center'}}>Đã có tài khoản? <span style={{color: '#4f46e5', cursor: 'pointer', fontWeight: 'bold'}} onClick={onSwitch}>Đăng nhập</span></p>
      </form>
    </div>
  );
}