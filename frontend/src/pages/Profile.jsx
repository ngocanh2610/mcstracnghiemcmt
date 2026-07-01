import React, { useState } from "react";
import axios from "axios";
import { API } from "../config";

export function ProfileSettings({ token, user }) {
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) return alert("Mật khẩu mới không khớp!");
    
    setLoading(true);
    try {
      await axios.put(`${API}/auth/change-password`, 
        { oldPassword, newPassword },
        { headers: { Authorization: "Bearer " + token } }
      );
      alert("Đổi mật khẩu thành công!");
      setOldPassword(""); setNewPassword(""); setConfirmPassword("");
    } catch (err) {
      alert("Lỗi: " + (err.response?.data?.message || "Không thể đổi mật khẩu, vui lòng kiểm tra lại mật khẩu cũ."));
    } finally { setLoading(false); }
  };

  return (
    <div className="exam-layout-split">
      <div className="exam-questions-list">
        <div className="question-card">
          <p>Thông tin định danh</p>
          <div className="options-list">
            <div className="option-item"><span><strong>Tên đăng nhập:</strong> {user.username}</span></div>
            <div className="option-item"><span><strong>Email:</strong> {user.email || "Chưa cập nhật"}</span></div>
            <div className="option-item">
              <span><strong>Vai trò:</strong> {user.roles?.join(", ").toUpperCase() || "STUDENT"}</span>
            </div>
            <div className="option-item"><span><strong>Mã tài khoản:</strong> {user.id}</span></div>
          </div>
        </div>
      </div>

      <div className="exam-palette-panel" style={{width: '400px'}}>
        <h4 style={{marginBottom: '15px'}}>Đổi mật khẩu</h4>
        <form onSubmit={handleChangePassword} style={{display: 'flex', flexDirection: 'column', gap: '12px'}}>
          <input className="login-input" style={{margin: 0}} type="password" placeholder="Mật khẩu cũ" 
                 value={oldPassword} onChange={e => setOldPassword(e.target.value)} required />
          <input className="login-input" style={{margin: 0}} type="password" placeholder="Mật khẩu mới" 
                 value={newPassword} onChange={e => setNewPassword(e.target.value)} required />
          <input className="login-input" style={{margin: 0}} type="password" placeholder="Xác nhận mật khẩu mới" 
                 value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required />
          <button type="submit" className="btn-primary" style={{width: '100%', marginTop: '5px'}} disabled={loading}>
            {loading ? "Đang xử lý..." : "Cập nhật mật khẩu"}
          </button>
        </form>
      </div>
    </div>
  );
}