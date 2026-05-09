import React, { useState, useEffect } from "react";
import axios from "axios";
import { API } from "../config";
import * as mammoth from "mammoth";
import * as XLSX from "xlsx";

export function ExamStats({ token, examId, onClose }) {
  const [st, setSt] = useState(null);
  const [loading, setLoading] = useState(false);
  const [usersInfo, setUsersInfo] = useState({});

  const loadStats = async () => {
    try {
      const resStats = await axios.get(`${API}/results/exam/${examId}`, { headers: { Authorization: "Bearer " + token } });
      setSt(resStats.data);

      try {
        const [authUsersRes, profilesRes] = await Promise.all([
          axios.get(`${API}/auth/users`, { headers: { Authorization: "Bearer " + token } }),
          axios.get(`${API}/users`, { headers: { Authorization: "Bearer " + token } })
        ]);
        
        const infoMap = {};
        if (authUsersRes.data && Array.isArray(authUsersRes.data)) {
          authUsersRes.data.forEach(u => {
            infoMap[u.id] = { username: u.username };
          });
        }
        if (profilesRes.data && Array.isArray(profilesRes.data)) {
          profilesRes.data.forEach(p => {
            if (infoMap[p.user_id]) {
              infoMap[p.user_id].fullName = p.full_name;
              infoMap[p.user_id].class = p.class;
            } else {
              infoMap[p.user_id] = { fullName: p.full_name, class: p.class };
            }
          });
        }
        setUsersInfo(infoMap);
      } catch (userErr) {
        console.error("Lỗi khi tải thông tin user:", userErr);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => { loadStats(); }, [examId, token]);

  const handleRegrade = async () => {
    if (!window.confirm("Hành động này sẽ tính lại điểm cho toàn bộ bài thi. Tiếp tục?")) return;
    setLoading(true);
    try {
      const res = await axios.post(`${API}/submissions/regrade/${examId}`, {}, { headers: { Authorization: "Bearer " + token } });
      alert(res.data.message || "Đang chấm lại ngầm...");
      setTimeout(() => {
        loadStats();
        setLoading(false);
      }, 2000);
    } catch {
      alert("Lỗi khi gửi yêu cầu chấm lại!");
      setLoading(false);
    }
  };

  const handleExportExcel = () => {
    if (!st || !st.details || st.details.length === 0) {
      return alert("Không có dữ liệu để xuất!");
    }

    const dataToExport = st.details.map((d, index) => {
      const uInfo = usersInfo[d.user_id] || {};
      const name = uInfo.fullName || uInfo.username || `Thí sinh ${d.user_id.slice(0, 5)}`;
      return {
        "STT": index + 1,
        "Họ và Tên": name,
        "Tên Đăng Nhập": uInfo.username || "",
        "Lớp": uInfo.class || "",
        "Số Câu Đúng": d.correct_count,
        "Tổng Số Câu": d.total_questions,
        "Điểm Số": d.score,
        "Ngày Nộp": new Date(d.created_at).toLocaleString('vi-VN')
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "ThongKeDiem");
    XLSX.writeFile(workbook, `Thong_Ke_Diem_De_${examId.slice(0,5)}.xlsx`);
  };

  if (!st) return <div style={{ padding: '20px', textAlign: 'center' }}>Đang tải...</div>;
  return (
    <div style={{ padding: '10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ margin: 0, fontSize: '20px', color: '#1e293b' }}>📊 Thống kê kết quả đề thi</h2>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            className="btn-primary" 
            style={{ background: '#10b981', padding: '6px 12px', border: 'none', fontSize: '14px' }} 
            onClick={handleExportExcel} 
          >
            📥 Xuất Excel
          </button>
          <button 
            className="btn-primary" 
            style={{ background: '#f59e0b', padding: '6px 12px', border: 'none', fontSize: '14px' }} 
            onClick={handleRegrade} 
            disabled={loading}
          >
            {loading ? "⌛ Đang chấm..." : "🔄 Chấm lại"}
          </button>
          <button 
            className="btn-outline" 
            style={{ padding: '6px 12px', fontSize: '14px' }} 
            onClick={onClose}
          >
            ⬅ Quay lại
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '15px', marginBottom: '25px' }}>
        <div className="stat-card-mini">
          Tổng thí sinh: <strong>{st.stats.total}</strong>
        </div>
        <div className="stat-card-mini" style={{ borderLeft: '4px solid #10b981' }}>
          Điểm trung bình: <strong>{st.stats.avg}</strong>
        </div>
        <div className="stat-card-mini" style={{ borderLeft: '4px solid #4f46e5' }}>
          Điểm cao nhất: <strong>{st.stats.max}</strong>
        </div>
      </div>

      <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
        <table className="history-table" style={{ width: '100%', borderCollapse: 'collapse', margin: 0 }}>
          <thead style={{ background: '#f8fafc' }}>
            <tr>
              <th style={{ padding: '12px', textAlign: 'left', color: '#64748b', fontSize: '13px' }}>THÍ SINH</th>
              <th style={{ padding: '12px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>SỐ CÂU ĐÚNG</th>
              <th style={{ padding: '12px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>ĐIỂM SỐ</th>
              <th style={{ padding: '12px', textAlign: 'right', color: '#64748b', fontSize: '13px' }}>NGÀY NỘP</th>
            </tr>
          </thead>
          <tbody>
            {st.details && st.details.length > 0 ? (
              st.details.map(d => {
                const uInfo = usersInfo[d.user_id] || {};
                const displayName = uInfo.fullName || uInfo.username || `Thí sinh ${d.user_id.slice(0, 5)}`;
                return (
                  <tr key={d.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px', fontWeight: '500' }}>
                      {displayName}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      <span style={{ color: '#10b981', fontWeight: 'bold' }}>{d.correct_count}</span>/{d.total_questions}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      <b style={{ fontSize: '16px', color: '#4f46e5' }}>{d.score}đ</b>
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right', color: '#94a3b8', fontSize: '13px' }}>
                      {new Date(d.created_at).toLocaleString('vi-VN')}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="4" style={{ padding: '30px', textAlign: 'center', color: '#94a3b8' }}>
                  Chưa có thí sinh nào nộp bài.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ExamQuestionEditor({ token, examId, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchFullExam = () => {
    axios.get(`${API}/exams/internal/${examId}/answers`, { headers: { Authorization: "Bearer " + token } })
      .then(r => setData(r.data));
  };

  useEffect(() => { fetchFullExam(); }, [examId]);

  const handleUpdateQuestionText = async (qId, newText) => {
    try {
      await axios.put(`${API}/exams/questions/${qId}`, { text: newText }, { headers: { Authorization: "Bearer " + token } });
    } catch { alert("Lỗi khi sửa nội dung câu hỏi!"); }
  };

  const handleUpdateOptionText = async (optId, newText) => {
    try {
      await axios.put(`${API}/exams/options/${optId}`, { text: newText }, { headers: { Authorization: "Bearer " + token } });
    } catch { alert("Lỗi khi sửa nội dung đáp án!"); }
  };

  const updateCorrectAnswer = async (qId, code) => {
    setLoading(true);
    try {
      await axios.patch(`${API}/exams/questions/${qId}/correct-option`, { correctOptionCode: code }, { headers: { Authorization: "Bearer " + token } });
      fetchFullExam();
    } catch { alert("Lỗi khi sửa đáp án!"); } finally { setLoading(false); }
  };

  if (!data) return <div style={{ padding: '20px', textAlign: 'center' }}>Đang tải...</div>;

  return (
    <div style={{ padding: '10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #f1f5f9', paddingBottom: '15px' }}>
        <h3 style={{ margin: 0, fontSize: '18px', color: '#1e293b' }}>
          📝 Chỉnh sửa đề: <span style={{ color: '#4f46e5' }}>{data?.exam?.title}</span>
        </h3>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            className="btn-primary" 
            onClick={() => alert("✅ Các thay đổi đã được lưu thành công!")}
            style={{ padding: '6px 12px', fontSize: '14px', border: 'none', background: '#10b981', color: 'white', borderRadius: '4px', cursor: 'pointer' }}
          >
            💾 Lưu
          </button>
          <button 
            className="btn-outline" 
            onClick={onClose}
            style={{ padding: '6px 12px', fontSize: '14px' }}
          >
            ⬅ Quay lại
          </button>
        </div>
      </div>

      <div style={{ maxHeight: '70vh', overflowY: 'auto', paddingRight: '5px' }}>
        {data?.questions && data.questions.length > 0 ? (
          data.questions.map((q, i) => (
            <div 
              key={q.id} 
              style={{ 
                borderLeft: '4px solid #4f46e5', 
                background: '#fff', 
                padding: '15px', 
                marginBottom: '15px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                borderRadius: '0 8px 8px 0'
              }}
            >
              <div style={{ marginBottom: '10px' }}>
                <div style={{ marginBottom: '5px', fontWeight: 'bold', color: '#475569', fontSize: '14px' }}>Câu {i + 1}:</div>
                <textarea
                  className="login-input"
                  style={{ width: '100%', height: '50px', fontSize: '14px', padding: '8px', borderRadius: '4px', border: '1px solid #e2e8f0', margin: 0 }}
                  defaultValue={q.text}
                  onBlur={(e) => handleUpdateQuestionText(q.id, e.target.value)}
                  placeholder="Nhập nội dung câu hỏi..."
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {q.options.map(opt => (
                  <div 
                    key={opt.id} 
                    style={{ 
                      display: 'flex', alignItems: 'center', gap: '10px',
                      background: opt.is_correct ? '#f0fdf4' : '#f8fafc',
                      padding: '6px 10px', borderRadius: '4px',
                      border: opt.is_correct ? '1px solid #bbf7d0' : '1px solid #f1f5f9'
                    }}
                  >
                    <input 
                      type="radio" 
                      name={`q-${q.id}`} 
                      checked={opt.is_correct} 
                      onChange={() => updateCorrectAnswer(q.id, opt.code)} 
                      disabled={loading}
                      style={{ cursor: 'pointer', width: '16px', height: '16px', margin: 0 }}
                    />
                    <span style={{ fontWeight: 'bold', color: '#64748b', fontSize: '14px' }}>{opt.code}.</span>
                    <input
                      className="login-input"
                      style={{ flex: 1, background: 'transparent', border: 'none', padding: '4px 0', margin: 0, fontSize: '14px' }}
                      defaultValue={opt.text}
                      onBlur={(e) => handleUpdateOptionText(opt.id, e.target.value)}
                      placeholder="Nội dung đáp án..."
                    />
                    {opt.is_correct && <span title="Đáp án đúng" style={{ fontSize: '16px' }}>✅</span>}
                  </div>
                ))}
              </div>
            </div>
          ))
        ) : (
          <div style={{ textAlign: 'center', padding: '20px', color: '#94a3b8' }}>
            Không có câu hỏi nào trong đề thi này.
          </div>
        )}
      </div>
      <div style={{ marginTop: '15px', padding: '8px', background: '#fefce8', borderRadius: '4px', border: '1px solid #fef08a' }}>
        <p style={{ margin: 0, fontSize: '13px', color: '#854d0e' }}>
          💡 <strong>Ghi chú:</strong> Hệ thống tự động lưu khi bạn nhấn chuột ra ngoài vùng nhập liệu (onBlur).
        </p>
      </div>
    </div>
  );
}

export function ExamManager({ token, me, onEditQuestions, onViewStats }) {
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [activeView, setActiveView] = useState('list');
  const [selectedExamId, setSelectedExamId] = useState(null);

  const loadExams = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API}/exams`, {
        headers: { Authorization: "Bearer " + token }
      });
      setExams(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadExams(); }, [token, me.id]);

  const deleteExam = async (id) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa đề thi này? Hành động này không thể hoàn tác!")) return;
    try {
      await axios.delete(`${API}/exams/${id}`, {
        headers: { Authorization: "Bearer " + token }
      });
      alert("Đã xóa đề thi thành công!");
      loadExams();
    } catch (e) {
      alert("Lỗi khi xóa đề thi!");
    }
  };

  if (loading) return <div style={{ textAlign: 'center', padding: '20px' }}>Đang tải danh sách đề thi...</div>;

  return (
    <div className="card" style={{ padding: '20px', background: '#fff', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
      {activeView === 'stats' && (
        <ExamStats 
          token={token} 
          examId={selectedExamId} 
          onClose={() => { setActiveView('list'); setSelectedExamId(null); }} 
        />
      )}

      {activeView === 'edit' && (
        <ExamQuestionEditor 
          token={token} 
          examId={selectedExamId} 
          onClose={() => { setActiveView('list'); setSelectedExamId(null); }} 
        />
      )}

      {activeView === 'list' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ margin: 0, color: '#1f2937' }}>Quản lý đề thi đã tạo</h3>
            <button className="btn-outline" onClick={loadExams} style={{ padding: '5px 15px' }}>🔄 Làm mới</button>
          </div>

          {exams.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
              <p>Bạn chưa tạo đề thi nào.</p>
            </div>
          ) : (
            <table className="history-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f3f4f6', textAlign: 'left' }}>
                  <th style={{ padding: '12px' }}>Tên đề thi</th>
                  <th style={{ padding: '12px' }}>Môn học</th>
                  <th style={{ padding: '12px' }}>Thời gian</th>
                  <th style={{ padding: '12px' }}>Ngày tạo</th>
                  <th style={{ padding: '12px', textAlign: 'center' }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {exams.map(ex => (
                  <tr key={ex.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '12px', fontWeight: '500' }}>{ex.title}</td>
                    <td style={{ padding: '12px' }}><span className="stat-card" style={{ padding: '2px 8px', fontSize: '12px' }}>{ex.subject}</span></td>
                    <td style={{ padding: '12px' }}>{ex.duration} phút</td>
                    <td style={{ padding: '12px', color: '#6b7280', fontSize: '13px' }}>
                      {new Date(ex.created_at).toLocaleDateString('vi-VN')}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                        <button
                          title="Xem thống kê điểm"
                          style={{ background: '#10b981', color: 'white', border: 'none', padding: '6px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                          onClick={() => {
                            setSelectedExamId(ex.id);
                            setActiveView('stats');
                          }}
                        >
                          📊 Thống kê
                        </button>
                        <button
                          title="Sửa nội dung câu hỏi"
                          style={{ background: '#3b82f6', color: 'white', border: 'none', padding: '6px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                          onClick={() => {
                            setSelectedExamId(ex.id);
                            setActiveView('edit');
                          }}
                        >
                          ✏️ Sửa câu
                        </button>
                        <button
                          title="Xóa đề"
                          style={{ background: '#ef4444', color: 'white', border: 'none', padding: '6px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center' }}
                          onClick={() => deleteExam(ex.id)}
                        >
                          🗑️ Xóa
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
}

export function TeacherPanel({ token, me, refresh }) {
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [duration, setDuration] = useState(60);

  const [subjects, setSubjects] = useState([]);
  const [bankQuestions, setBankQuestions] = useState([]);
  const [selectedQs, setSelectedQs] = useState([]);
  const [randomCount, setRandomCount] = useState(5);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!token) return;
    axios.get(`${API}/exams/banks/list/subjects`, { headers: { Authorization: "Bearer " + token } })
      .then(r => setSubjects(Array.isArray(r.data) ? r.data : []))
      .catch(e => console.error("Lỗi tải môn học:", e));
  }, [token]);

  useEffect(() => {
    if (!subject || !token) {
      setBankQuestions([]);
      return;
    }
    axios.get(`${API}/exams/banks/subject/${subject}`, { headers: { Authorization: "Bearer " + token } })
      .then(r => setBankQuestions(Array.isArray(r.data) ? r.data : []))
      .catch(e => console.error("Lỗi tải câu hỏi:", e));
  }, [subject, token]);

  const handleSaveExam = async () => {
    if (!title.trim() || !subject || selectedQs.length === 0) {
      return alert("Vui lòng nhập đủ tên, môn và chọn câu hỏi!");
    }
    setIsSubmitting(true);
    try {
      const resExam = await axios.post(`${API}/exams`,
        { title, subject, created_by: me?.id, duration: Number(duration) },
        { headers: { Authorization: "Bearer " + token } }
      );
      const newExamId = resExam.data.id;
      const qsToAdd = bankQuestions.filter(q => selectedQs.includes(q.id));

      await axios.post(`${API}/exams/${newExamId}/questions-batch`,
        { questions: qsToAdd },
        { headers: { Authorization: "Bearer " + token } }
      );

      alert("✅ Tạo đề thi thành công!");
      if (refresh) refresh();
    } catch (e) {
      alert("❌ Lỗi khi lưu đề!");
    } finally { setIsSubmitting(false); }
  };

  return (
    <div className="card" style={{ padding: '20px', background: '#fff' }}>
      <h3 style={{ marginTop: 0 }}>Soạn đề thi mới</h3>

      <div style={{
        display: 'flex',
        gap: '12px',
        alignItems: 'center',
        marginBottom: '20px',
        background: '#f8fafc',
        padding: '15px',
        borderRadius: '10px'
      }}>
        {/* Tên đề thi */}
        <input
          className="login-input"
          style={{ flex: 2, margin: 0 }}
          placeholder="Tên đề thi"
          value={title}
          onChange={e => setTitle(e.target.value)}
        />

        {/* Chọn môn */}
        <select
          className="login-input"
          style={{ flex: 1, margin: 0 }}
          value={subject}
          onChange={e => setSubject(e.target.value)}
        >
          <option value="">-- Chọn môn --</option>
          {subjects.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        {/* THỜI GIAN LÀM BÀI ĐƯỢC CHÈN VÀO ĐÂY */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input
            type="number"
            className="login-input"
            style={{ width: '80px', margin: 0, textAlign: 'center' }}
            value={duration}
            onChange={e => setDuration(e.target.value)}
            min="1"
            title="Thời gian làm bài (phút)"
          />
          <span style={{ color: '#64748b', fontSize: '14px', fontWeight: '500', whiteSpace: 'nowrap' }}>
            phút
          </span>
        </div>

        {/* Nút Tạo đề thi */}
        <button
          className="btn-primary"
          style={{
            margin: 0,
            padding: '0 25px',
            height: '45px',
            whiteSpace: 'nowrap',
            flexShrink: 0
          }}
          onClick={handleSaveExam}
          disabled={isSubmitting}
        >
          {isSubmitting ? "⏳ Đang lưu..." : "🚀 Tạo đề thi"}
        </button>
      </div>

      {subject && (
        <div style={{ background: '#f9fafb', padding: '15px', borderRadius: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', background: '#fff', padding: '10px', borderRadius: '8px', border: '1px solid #eee' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <strong style={{ color: '#1e293b' }}>📚 Ngân hàng môn {subject}: {bankQuestions.length} câu</strong>
              {bankQuestions.length > 0 && (
                <button
                  className="btn-outline"
                  style={{ padding: '4px 10px', fontSize: '13px', borderRadius: '6px', border: '1px solid #10b981', color: '#10b981', background: '#ecfdf5', cursor: 'pointer', fontWeight: 'bold' }}
                  onClick={() => {
                    if (selectedQs.length === bankQuestions.length) {
                      setSelectedQs([]);
                    } else {
                      setSelectedQs(bankQuestions.map(q => q.id));
                    }
                  }}
                >
                  {selectedQs.length === bankQuestions.length ? "☒ Bỏ chọn tất cả" : "☑️ Chọn tất cả"}
                </button>
              )}
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span style={{ fontSize: '14px', color: '#64748b' }}>Lấy ngẫu nhiên:</span>
              <input
                type="number"
                value={randomCount}
                onChange={(e) => setRandomCount(parseInt(e.target.value) || 0)}
                style={{
                  width: '60px',
                  padding: '6px',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  textAlign: 'center',
                  fontSize: '14px'
                }}
                min="1"
                max={bankQuestions.length}
                placeholder="H"
              />
              <span style={{ fontSize: '14px', color: '#64748b', marginRight: '5px' }}>câu</span>

              <button
                className="btn-outline"
                style={{ padding: '6px 12px', background: '#f59e0b', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '14px', cursor: 'pointer' }}
                onClick={() => {
                  if (randomCount <= 0) return alert("Vui lòng nhập số câu muốn lấy (lớn hơn 0)!");
                  if (randomCount > bankQuestions.length) return alert(`Ngân hàng chỉ có ${bankQuestions.length} câu, không thể lấy ${randomCount} câu!`);

                  const shuffled = [...bankQuestions].sort(() => 0.5 - Math.random());
                  const pickedIds = shuffled.slice(0, randomCount).map(q => q.id);

                  setSelectedQs(pickedIds);
                  alert(`🎉 Đã chọn ngẫu nhiên ${randomCount} câu hỏi! Hãy kiểm tra danh sách bên dưới.`);
                }}
              >
                🎲 Xác nhận lấy
              </button>
            </div>
          </div>

          <div style={{ maxHeight: '350px', overflowY: 'auto', border: '1px solid #e2e8f0', background: '#fff', borderRadius: '8px', padding: '8px' }}>
            {bankQuestions.map((q) => (
              <div 
                key={q.id} 
                style={{ 
                  padding: '12px', 
                  borderBottom: '1px solid #f8fafc', 
                  display: 'flex', 
                  gap: '12px',
                  alignItems: 'center',
                  cursor: 'pointer',
                  borderRadius: '6px',
                  background: selectedQs.includes(q.id) ? '#f0fdf4' : '#ffffff',
                  transition: 'all 0.2s ease'
                }}
                onClick={() => setSelectedQs(prev => prev.includes(q.id) ? prev.filter(id => id !== q.id) : [...prev, q.id])}
                onMouseEnter={(e) => { if (!selectedQs.includes(q.id)) e.currentTarget.style.background = '#f8fafc'; }}
                onMouseLeave={(e) => { if (!selectedQs.includes(q.id)) e.currentTarget.style.background = '#ffffff'; }}
              >
                <input
                  type="checkbox"
                  checked={selectedQs.includes(q.id)}
                  onChange={() => {}}
                  style={{ cursor: 'pointer', width: '18px', height: '18px', accentColor: '#10b981', margin: 0, pointerEvents: 'none' }}
                />
                <span style={{ 
                  color: selectedQs.includes(q.id) ? '#065f46' : '#334155', 
                  fontWeight: selectedQs.includes(q.id) ? '600' : 'normal',
                  fontSize: '15px',
                  flex: 1,
                  userSelect: 'none'
                }}>
                  {q.text}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}

export function QuestionBankManager({ token }) {
  const [subjects, setSubjects] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState("");
  const [questions, setQuestions] = useState([]);

  const [newSub, setNewSub] = useState("");
  const [qText, setQText] = useState("");
  const [optTexts, setOptTexts] = useState(["", "", "", ""]);
  const [correctIdx, setCorrectIdx] = useState(0);

  const [editingId, setEditingId] = useState(null); 

  const loadSubjects = async () => {
    try {
      const r = await axios.get(`${API}/exams/banks/list/subjects`, { headers: { Authorization: "Bearer " + token } });
      setSubjects(r.data);
    } catch (e) { console.log(e); }
  };

  const loadQuestions = async (sub) => {
    if (!sub) return;
    try {
      const res = await axios.get(`${API}/exams/banks/subject/${sub}`, { 
        headers: { Authorization: "Bearer " + token } 
      });
      setQuestions(res.data); 
    } catch (e) {
      console.error("Lỗi tải câu hỏi:", e);
    }
  };

  useEffect(() => {
    if (selectedSubject) {
      loadQuestions(selectedSubject);
    } else {
      setQuestions([]); 
    }
  }, [selectedSubject]);
  
  useEffect(() => { loadSubjects(); }, []);
  useEffect(() => { loadQuestions(selectedSubject); }, [selectedSubject]);

  const addQuestion = async () => {
    const subToUse = newSub.trim() || selectedSubject;
    if (!subToUse) return alert("Vui lòng nhập hoặc chọn môn học!");
    if (!qText.trim()) return alert("Vui lòng nhập nội dung câu hỏi!");

    try {
      await axios.post(`${API}/exams/banks`, {
        subject: subToUse,
        text: qText,
        options: optTexts.map((t, i) => ({ text: t, code: String.fromCharCode(65 + i), is_correct: i === correctIdx }))
      }, { headers: { Authorization: "Bearer " + token } });

      setQText("");
      setOptTexts(["", "", "", ""]);
      setCorrectIdx(0);
      setNewSub("");

      if (!subjects.includes(subToUse)) {
        loadSubjects();
      }
      if (selectedSubject === subToUse) {
        loadQuestions(subToUse);
      } else {
        setSelectedSubject(subToUse);
      }
      alert("Đã thêm câu hỏi vào ngân hàng!");
    } catch (e) { alert("Lỗi khi thêm vào ngân hàng!"); }
  };

  const updateQuestion = async () => {
    try {
      const finalSub = newSub || selectedSubject;
      await axios.put(`${API}/exams/banks/${editingId}`, {
        subject: finalSub,
        text: qText,
        options: optTexts.map((t, i) => ({ text: t, code: String.fromCharCode(65 + i), is_correct: i === correctIdx }))
      }, { headers: { Authorization: "Bearer " + token } });

      alert("Cập nhật thành công!");
      setEditingId(null);
      setQText("");
      setOptTexts(["", "", "", ""]);
      setCorrectIdx(0);
      loadQuestions(finalSub);
    } catch (e) { alert("Lỗi khi cập nhật!"); }
  };

  const startEdit = (q) => {
    setEditingId(q.id);
    setSelectedSubject(q.subject);
    setQText(q.text);
    setOptTexts(q.options?.map(o => o.text) || ["", "", "", ""]);
    setCorrectIdx(q.options?.findIndex(o => o.is_correct) ?? 0);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const deleteQuestion = async (id) => {
    if (!window.confirm("Xóa câu hỏi này khỏi ngân hàng?")) return;
    try {
      await axios.delete(`${API}/exams/banks/${id}`, { headers: { Authorization: "Bearer " + token } });
      loadQuestions(selectedSubject);
    } catch (e) { alert("Lỗi khi xóa!"); }
  };

  const parseWordFile = async (file) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      let text = result.value;
      
      text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      
      const lines = text.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);
      
      const questions = [];
      let currentQ = null;
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        if (line.match(/^(Câu\s*\d+:|Question\s*\d+:|^\d+\.)/i) || 
            (currentQ === null && !line.match(/^[A-D][\.\)]/))) {
          if (currentQ !== null) questions.push(currentQ);
          
          const qText = line.replace(/^(Câu\s*\d+:|Question\s*\d+:|^\d+\.)\s*/i, '');
          currentQ = { text: qText, options: [] };
        }
        else if (currentQ && line.match(/^[A-D][\.\)]/)) {
          const code = line[0];
          let optionText = line.substring(2).trim();
          
          const isCorrect = /[\*]\s*$/.test(optionText) || 
                          /\(Đúng\)|\(Correct\)|\(đúng\)/.test(optionText);
          
          optionText = optionText
            .replace(/\*\s*$/, '')                    
            .replace(/\s*\(Đúng\)/, '')               
            .replace(/\s*\(Correct\)/, '')            
            .replace(/\s*\(đúng\)/, '')               
            .trim();
          
          if (optionText.length > 0) {
            currentQ.options.push({ code, text: optionText, is_correct: isCorrect });
          }
        }
      }
      
      if (currentQ !== null && currentQ.options.length > 0) {
        questions.push(currentQ);
      }
      
      const validQuestions = questions.filter(q => q.options.length >= 2);
      
      if (validQuestions.length === 0) {
        alert("❌ Không tìm thấy câu hỏi nào hợp lệ trong file!\n\nFormat mong đợi:\nCâu 1: Nội dung câu hỏi?\nA. Đáp án A\nB. Đáp án B\nC. Đáp án C\nD*. Đáp án D (đáp án đúng)");
        return null;
      }
      
      for (let q of validQuestions) {
        if (!q.options.some(opt => opt.is_correct)) {
          q.options[0].is_correct = true; 
        }
      }
      
      console.log("✅ Parse thành công:", validQuestions); 
      return validQuestions;
    } catch (e) {
      alert("❌ Lỗi khi đọc file: " + e.message);
      console.error(e);
      return null;
    }
  };

  const handleImportFromWord = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.match(/\.(docx|doc)$/i)) {
      alert("❌ Vui lòng chọn file Word (.docx hoặc .doc)");
      return;
    }

    const questions = await parseWordFile(file);
    if (!questions) return;

    const subToUse = newSub.trim() || selectedSubject;
    if (!subToUse) {
      alert("❌ Vui lòng chọn hoặc tạo môn học trước khi import!");
      return;
    }

    if (!window.confirm(`Sẽ import ${questions.length} câu hỏi vào môn ${subToUse}. Tiếp tục?`)) return;

    try {
      await axios.post(`${API}/exams/banks-batch`, {
        subject: subToUse,
        questions: questions
      }, { headers: { Authorization: "Bearer " + token } });

      alert(`✅ Import thành công ${questions.length} câu hỏi!`);
      setNewSub("");
      if (selectedSubject === subToUse) {
        loadQuestions(subToUse);
      } else {
        setSelectedSubject(subToUse);
      }
      e.target.value = ""; 
    } catch (e) {
      alert("❌ Lỗi khi import: " + (e.response?.data?.error || e.message));
    }
  };

  return (
    <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
      <div className="card" style={{ flex: 1, padding: '20px', background: '#fff', borderRadius: '12px' }}>
        <h3 style={{ marginTop: 0 }}>
          {editingId ? "📝 Chỉnh sửa câu hỏi" : "Thêm câu hỏi mới"}
        </h3>
        
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Môn học:</label>
          <div style={{ display: 'flex', gap: '10px' }}>
            <select 
              className="login-input" 
              style={{ flex: 1, margin: 0 }} 
              value={selectedSubject} 
              onChange={e => setSelectedSubject(e.target.value)}
            >
              <option value="">-- Chọn môn --</option>
              {subjects.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <input 
              className="login-input" 
              style={{ flex: 1, margin: 0 }} 
              placeholder="Hoặc tạo môn mới..." 
              value={newSub} 
              onChange={e => setNewSub(e.target.value)} 
            />
          </div>
        </div>

        <textarea 
          className="login-input" 
          placeholder="Nội dung câu hỏi" 
          value={qText} 
          onChange={e => setQText(e.target.value)} 
          style={{ width: '100%', height: '80px', padding: '10px' }} 
        />
        
        <div style={{ marginTop: '10px' }}>
          {optTexts.map((txt, i) => (
            <div key={i} style={{ display: 'flex', gap: '10px', marginTop: '8px', alignItems: 'center' }}>
              <input 
                type="radio" 
                name="bank_correct" 
                checked={correctIdx === i} 
                onChange={() => setCorrectIdx(i)} 
              />
              <input 
                className="login-input" 
                placeholder={`Đáp án ${String.fromCharCode(65 + i)}`} 
                value={txt} 
                onChange={e => { 
                  const n = [...optTexts]; 
                  n[i] = e.target.value; 
                  setOptTexts(n); 
                }} 
                style={{ margin: 0, flex: 1 }} 
              />
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
          <button 
            className="btn-primary" 
            style={{ flex: 2 }} 
            onClick={editingId ? updateQuestion : addQuestion}
          >
            {editingId ? "🆙 Cập nhật câu hỏi" : "Lưu vào Ngân hàng"}
          </button>

          {editingId && (
            <button 
              className="btn-outline" 
              style={{ flex: 1, background: '#64748b', color: '#fff', border: 'none' }} 
              onClick={() => {
                setEditingId(null);
                setQText("");
                setOptTexts(["", "", "", ""]);
                setCorrectIdx(0);
              }}
            >
              Hủy sửa
            </button>
          )}
        </div>

        <div style={{ marginTop: '25px', paddingTop: '20px', borderTop: '2px solid #f1f5f9' }}>
          <h4 style={{ margin: '0 0 15px 0', color: '#1e293b' }}>📄 Hoặc import từ file Word</h4>
          
          <div style={{ 
            padding: '20px', 
            background: '#f0f9ff', 
            borderRadius: '10px', 
            border: '2px dashed #3b82f6',
            textAlign: 'center'
          }}>
            <p style={{ margin: '0 0 10px 0', color: '#1e40af', fontSize: '14px' }}>
              📋 Chọn file Word (.docx) chứa danh sách câu hỏi
            </p>
            
            <input 
              type="file" 
              accept=".docx,.doc"
              onChange={handleImportFromWord}
              style={{ 
                display: 'block',
                width: '100%',
                padding: '10px',
                border: '1px solid #93c5fd',
                borderRadius: '6px',
                background: '#fff',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            />

            <div style={{ marginTop: '12px', fontSize: '12px', color: '#1e40af', textAlign: 'left', background: '#e0f2fe', padding: '10px', borderRadius: '6px' }}>
              <strong>📌 Format file Word:</strong>
              <pre style={{ margin: '8px 0 0 0', whiteSpace: 'pre-wrap', wordWrap: 'break-word', fontSize: '11px' }}>
{`Câu 1: Nội dung câu hỏi?
A. Đáp án A
B. Đáp án B
C. Đáp án C
D*. Đáp án D

Câu 2: Câu hỏi tiếp theo?
A. Tùy chọn 1
B. Tùy chọn 2
C*. Tùy chọn 3 (Đúng)
D. Tùy chọn 4`}
              </pre>
              <p style={{ margin: '8px 0 0 0' }}>✅ Đánh dấu đáp án đúng bằng <code style={{background: '#fff', padding: '2px 6px'}}>*</code> hoặc <code style={{background: '#fff', padding: '2px 6px'}}>(Đúng)</code></p>
            </div>
          </div>
        </div>
      </div>

      <div 
        className="card" 
        style={{ 
          flex: 1.2, 
          padding: '24px', 
          background: '#ffffff', 
          borderRadius: '16px', 
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)', 
          border: '1px solid #f1f5f9' 
        }}
      >
        <div style={{ paddingBottom: '16px', borderBottom: '2px solid #f1f5f9', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, color: '#1e293b', fontSize: '18px' }}>
            📋 Danh sách câu hỏi môn: <span style={{ color: '#3b82f6' }}>{selectedSubject || "..."}</span>
          </h3>
        </div>

        {selectedSubject && questions.length > 0 && (
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <button
              onClick={() => {
                const isAllSelected = questions.every(q => q.selected);
                setQuestions(questions.map(q => ({ ...q, selected: !isAllSelected })));
                setEditingId(null);
              }}
              style={{
                padding: '8px 14px',
                background: '#10b981',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 'bold'
              }}
            >
              {questions.every(q => q.selected) ? "☒ Bỏ chọn tất cả" : "☑️ Chọn tất cả"}
            </button>
            {questions.some(q => q.selected) && (
              <button
                onClick={async () => {
                  const selectedIds = questions.filter(q => q.selected).map(q => q.id);
                  try {
                    await Promise.all(selectedIds.map(id => axios.delete(`${API}/exams/banks/${id}`, { headers: { Authorization: "Bearer " + token } })));
                    alert("Đã xóa thành công!");
                    loadQuestions(selectedSubject);
                  } catch (e) {
                    alert("Lỗi khi xóa!");
                  }
                }}
                style={{
                  padding: '8px 14px',
                  background: '#ef4444',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 'bold'
                }}
              >
                🗑️ Xóa mục đã chọn ({questions.filter(q => q.selected).length})
              </button>
            )}
          </div>
        )}
        
        <div 
          style={{ 
            maxHeight: '600px', 
            overflowY: 'auto',
            background: '#f8fafc', 
            borderRadius: '12px', 
            padding: '12px',
            border: '1px solid #e2e8f0' 
          }}
        >
          {questions && questions.length > 0 ? (
            questions.map((q, index) => (
              <div 
                key={q.id || index} 
                style={{ 
                  padding: '16px', 
                  marginBottom: '12px', 
                  borderRadius: '10px',
                  border: editingId === q.id ? '2px solid #fbbf24' : '1px solid #e2e8f0', 
                  position: 'relative',
                  background: editingId === q.id ? '#fffbeb' : (q.selected ? '#f0fdf4' : '#ffffff'), 
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)', 
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onClick={() => {
                  const newQs = [...questions];
                  newQs[index].selected = !newQs[index].selected;
                  setQuestions(newQs);
                }}
                onMouseEnter={(e) => { if (!q.selected && editingId !== q.id) e.currentTarget.style.background = '#f8fafc'; }}
                onMouseLeave={(e) => { if (!q.selected && editingId !== q.id) e.currentTarget.style.background = '#ffffff'; }}
              >
                
                <div style={{ position: 'absolute', top: '12px', left: '12px' }}>
                  <input
                    type="checkbox"
                    checked={!!q.selected}
                    onChange={() => {}} 
                    style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: '#10b981', pointerEvents: 'none' }}
                  />
                </div>

                <div style={{ position: 'absolute', top: '8px', right: '10px', display: 'flex', gap: '5px' }}>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      startEdit(q);
                    }} 
                    style={{ border: 'none', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', cursor: 'pointer', fontSize: '14px', padding: '6px 10px', borderRadius: '6px', fontWeight: 'bold' }}
                    title="Sửa câu hỏi"
                  >
                    ✏️ Sửa
                  </button>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteQuestion(q.id);
                    }} 
                    style={{ border: 'none', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', cursor: 'pointer', fontSize: '14px', padding: '6px 10px', borderRadius: '6px', fontWeight: 'bold' }}
                    title="Xóa câu hỏi"
                  >
                    🗑️ Xóa
                  </button>
                </div>

                <p style={{ marginTop: '30px', marginBottom: '12px', paddingRight: '10px', color: '#334155', lineHeight: '1.5' }}>
                  <strong style={{ color: '#0f172a' }}>Câu {index + 1}:</strong> {q.text}
                </p>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '14px' }}>
                  {q.options?.map((opt, i) => (
                    <div 
                      key={i} 
                      style={{ 
                        padding: '8px 12px', 
                        background: opt.is_correct ? '#ecfdf5' : '#f1f5f9', 
                        color: opt.is_correct ? '#059669' : '#475569', 
                        borderRadius: '6px',
                        border: opt.is_correct ? '1px solid #10b981' : '1px solid transparent',
                        fontWeight: opt.is_correct ? 'bold' : 'normal'
                      }}
                    >
                      {opt.code}. {opt.text} {opt.is_correct && '✅'}
                    </div>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8' }}>
              <span style={{ fontSize: '40px', display: 'block', marginBottom: '10px' }}>📭</span>
              Chưa có câu hỏi nào. Vui lòng chọn môn học!
            </div>
          )}
        </div>
      </div>
    </div>
  );
}