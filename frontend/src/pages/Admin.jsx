import React, { useState, useEffect } from "react";
import axios from "axios";
import { API } from "../config";

export function AdminPanel({ token, refresh }) {
  const [allUsers, setAllUsers] = useState([]);

  // Hàm tải danh sách người dùng - Giờ đây đã có thêm trường full_name từ Backend
  const loadUsers = () => 
    axios.get(`${API}/auth/users`, { headers: { Authorization: "Bearer " + token } })
      .then(r => setAllUsers(r.data))
      .catch(err => console.error("Lỗi tải danh sách admin:", err));

  useEffect(() => { loadUsers(); }, [token]);

  const changeRole = async (userId, newRole) => {
    if (!window.confirm(`Xác nhận cấp quyền ${newRole.toUpperCase()} cho người dùng này?`)) return;
    try {
      await axios.put(`${API}/auth/users/${userId}/role`, { role: newRole }, { headers: { Authorization: "Bearer " + token } });
      loadUsers();
      if (refresh) refresh(); // Refresh lại danh sách đề thi nếu cần
    } catch (err) { alert("Lỗi khi đổi quyền!"); }
  };

  const delUser = async (userId) => {
    if (!window.confirm("CẢNH BÁO: Bạn sắp xóa vĩnh viễn tài khoản này khỏi hệ thống. Bạn có chắc chắn?")) return;
    try {
      await axios.delete(`${API}/auth/users/${userId}`, { headers: { Authorization: "Bearer " + token } });
      loadUsers();
    } catch (err) { alert("Lỗi khi xóa tài khoản!"); }
  };

  return (
    <div className="card admin-card animate-fade-in" style={{marginTop:'20px', background: '#fff1f1', padding: '24px', borderRadius: '12px', border: '2px solid #fecaca', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'}}>
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px'}}>
        <h3 style={{margin: 0, color: '#dc2626', fontSize: '24px'}}>🛠 Quản Trị Người Dùng Hệ Thống</h3>
        <button className="btn-outline" onClick={loadUsers} style={{borderColor: '#fca5a5', color: '#dc2626'}}>🔄 Làm mới danh sách</button>
      </div>

      <div style={{overflowX: 'auto', borderRadius: '8px', border: '1px solid #fee2e2'}}>
        <table className="history-table" style={{width: '100%', backgroundColor: 'white', borderCollapse: 'collapse', margin: 0}}>
          <thead style={{background: '#fecaca'}}>
            <tr>
              <th style={{padding: '15px', textAlign: 'left', color: '#991b1b'}}>Họ và Tên</th>
              <th style={{padding: '15px', textAlign: 'left', color: '#991b1b'}}>Tài khoản</th>
              <th style={{padding: '15px', textAlign: 'left', color: '#991b1b'}}>Email</th>
              <th style={{padding: '15px', textAlign: 'left', color: '#991b1b'}}>Quyền</th>
              <th style={{padding: '15px', textAlign: 'center', color: '#991b1b'}}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {allUsers.map(u => (
              <tr key={u.id} style={{borderTop: '1px solid #fee2e2'}}>
                {/* ✅ ĐÃ THÊM: Cột Họ và Tên thực của người dùng */}
                <td style={{padding: '15px'}}>
                  <span style={{fontWeight: '600', color: '#1e293b'}}>{u.full_name || "Chưa cập nhật"}</span>
                </td>
                
                <td style={{padding: '15px'}}>
                  <code style={{background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', color: '#475569'}}>{u.username}</code>
                </td>

                <td style={{padding: '15px', fontSize: '14px', color: '#64748b'}}>{u.email || "—"}</td>
                
                <td style={{padding: '15px'}}>
                  <span style={{
                    padding: '5px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold',
                    backgroundColor: u.role === 'admin' ? '#fee2e2' : u.role === 'teacher' ? '#e0e7ff' : '#d1fae5',
                    color: u.role === 'admin' ? '#ef4444' : u.role === 'teacher' ? '#4f46e5' : '#10b981',
                    display: 'inline-block', minWidth: '80px', textAlign: 'center'
                  }}>
                    {u.role ? u.role.toUpperCase() : 'STUDENT'}
                  </span>
                </td>

                <td style={{padding: '15px'}}>
                  <div style={{display: 'flex', gap: '8px', justifyContent: 'center', alignItems: 'center'}}>
                    <select 
                      className="login-input" 
                      style={{margin: 0, padding: '6px', width: 'auto', fontSize: '13px', cursor: 'pointer', height: '35px'}}
                      value={u.role || 'student'}
                      onChange={(e) => changeRole(u.id, e.target.value)}
                      disabled={u.role === 'admin'} 
                    >
                      <option value="student">🎓 Cấp: Student</option>
                      <option value="teacher">👨‍🏫 Cấp: Teacher</option>
                    </select>
                    
                    {u.role !== 'admin' && (
                      <button 
                        className="btn-logout" 
                        style={{padding: '0 12px', fontSize: '13px', height: '35px', margin: 0, background: '#ef4444'}} 
                        onClick={() => delUser(u.id)}
                      >
                        🗑️ Xóa
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {allUsers.length === 0 && (
        <div style={{padding: '40px', textAlign: 'center', color: '#94a3b8', background: 'white', borderRadius: '0 0 8px 8px'}}>
          Không tìm thấy người dùng nào trong hệ thống.
        </div>
      )}
    </div>
  );
}