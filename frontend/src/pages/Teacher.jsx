import React, { useState, useEffect } from "react";
import axios from "axios";
import { API } from "../config";
import * as mammoth from "mammoth";
import * as XLSX from "xlsx";

// --- 1. COMPONENT THỐNG KÊ (Họ tên thực & Excel & CÓ NÚT CHẤM LẠI) ---
export function ExamStats({ token, examId, onClose }) {
  const [st, setSt] = useState(null);
  const [loading, setLoading] = useState(false);
  const [usersInfo, setUsersInfo] = useState({});

  const loadStats = async () => {
    try {
      const resStats = await axios.get(`${API}/results/exam/${examId}`, { headers: { Authorization: "Bearer " + token } });
      setSt(resStats.data);

      try {
        const authUsersRes = await axios.get(`${API}/auth/users`, { headers: { Authorization: "Bearer " + token } });
        const infoMap = {};
        if (authUsersRes.data && Array.isArray(authUsersRes.data)) {
          authUsersRes.data.forEach(u => {
            infoMap[u.id] = { username: u.username, fullName: u.full_name || u.username };
          });
        }
        setUsersInfo(infoMap);
      } catch (err) { console.error("Lỗi tải thông tin user:", err); }
    } catch (e) { console.error(e); }
  };

  useEffect(() => { loadStats(); }, [examId, token]);

  // ✅ LOGIC VÀ NÚT CHẤM LẠI ĐÃ ĐƯỢC GIỮ NGUYÊN VÀ ĐẢM BẢO HOẠT ĐỘNG
  const handleRegrade = async () => {
    if (!window.confirm("Hành động này sẽ tính lại điểm cho toàn bộ bài thi dựa trên đáp án mới nhất. Tiếp tục?")) return;
    setLoading(true);
    try {
      await axios.post(`${API}/submissions/regrade/${examId}`, {}, { headers: { Authorization: "Bearer " + token } });
      alert("✅ Đã gửi yêu cầu chấm lại hệ thống!");
      setTimeout(() => { loadStats(); setLoading(false); }, 2000);
    } catch { alert("Lỗi khi gửi yêu cầu chấm lại!"); setLoading(false); }
  };

  const handleExportExcel = () => {
    if (!st?.details?.length) return alert("Không có dữ liệu!");
    const dataToExport = st.details.map((d, index) => {
      const uInfo = usersInfo[d.user_id] || {};
      return {
        "STT": index + 1,
        "Họ và Tên": uInfo.fullName || `Thí sinh ${d.user_id.slice(0, 5)}`,
        "Số Câu Đúng": `${d.correct_count}/${d.total_questions}`,
        "Điểm Số": d.score,
        "Ngày Nộp": new Date(d.created_at).toLocaleString('vi-VN')
      };
    });
    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "ThongKeDiem");
    XLSX.writeFile(workbook, `KetQua_De_${examId.slice(0, 5)}.xlsx`);
  };

  if (!st) return <div style={{ padding: '20px', textAlign: 'center' }}>Đang tải...</div>;
  return (
    <div className="animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ margin: 0, fontSize: '20px' }}>📊 Thống kê kết quả đề thi (Đã test CI/CD)</h2>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn-primary" style={{ background: '#10b981' }} onClick={handleExportExcel}>📥 Xuất Excel</button>
          {/* ✅ NÚT CHẤM LẠI HIỂN THỊ RÕ RÀNG Ở ĐÂY */}
          <button className="btn-primary" style={{ background: '#f59e0b' }} onClick={handleRegrade} disabled={loading}>
            {loading ? "⌛ Đang chấm..." : "🔄 Chấm lại"}
          </button>
          <button className="btn-outline" onClick={onClose}>⬅ Quay lại</button>
        </div>
      </div>
      <table className="history-table" style={{ width: '100%' }}>
        <thead>
          <tr>
            <th>THÍ SINH</th>
            <th style={{ textAlign: 'center' }}>ĐÚNG</th>
            <th style={{ textAlign: 'center' }}>ĐIỂM</th>
            <th style={{ textAlign: 'right' }}>NGÀY NỘP</th>
          </tr>
        </thead>
        <tbody>
          {st.details.map(d => {
            const uInfo = usersInfo[d.user_id] || {};
            return (
              <tr key={d.id}>
                <td><strong>{uInfo.fullName}</strong></td>
                <td style={{ textAlign: 'center' }}>{d.correct_count}/{d.total_questions}</td>
                <td style={{ textAlign: 'center' }}><b style={{ color: '#4f46e5' }}>{d.score}đ</b></td>
                <td style={{ textAlign: 'right', color: '#94a3b8', fontSize: '12px' }}>{new Date(d.created_at).toLocaleString('vi-VN')}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// --- 2. CHỈNH SỬA CÂU HỎI TRONG ĐỀ (AUTO-SAVE) ---
export function ExamQuestionEditor({ token, examId, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchFullExam = () => {
    axios.get(`${API}/exams/internal/${examId}/answers`, { headers: { Authorization: "Bearer " + token } })
      .then(r => setData(r.data));
  };

  useEffect(() => { fetchFullExam(); }, [examId]);

  const handleUpdateText = async (url, text) => {
    try { await axios.put(url, { text }, { headers: { Authorization: "Bearer " + token } }); } catch { console.error("Lỗi tự động lưu!"); }
  };

  const updateCorrectAnswer = async (qId, code) => {
    setLoading(true);
    try {
      await axios.patch(`${API}/exams/questions/${qId}/correct-option`, { correctOptionCode: code }, { headers: { Authorization: "Bearer " + token } });
      fetchFullExam();
    } catch { alert("Lỗi khi sửa đáp án!"); } finally { setLoading(false); }
  };

  if (!data) return <div style={{ padding: '20px', textAlign: 'center' }}>Đang tải đề...</div>;

  return (
    <div className="animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
        <h3>📝 Sửa đề: {data.exam?.title}</h3>
        <button className="btn-outline" onClick={onClose}>Quay lại</button>
      </div>
      <div style={{ maxHeight: '70vh', overflowY: 'auto' }}>
        {data.questions.map((q, i) => (
          <div key={q.id} className="card" style={{ padding: '15px', marginBottom: '15px', borderLeft: '4px solid #4f46e5' }}>
            <textarea className="login-input" defaultValue={q.text} onBlur={(e) => handleUpdateText(`${API}/exams/questions/${q.id}`, e.target.value)} style={{ width: '100%', height: '50px' }} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {q.options.map(opt => (
                <div key={opt.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', background: opt.is_correct ? '#f0fdf4' : '#f8fafc', padding: '10px', borderRadius: '6px' }}>
                  <input type="radio" name={`q-${q.id}`} checked={opt.is_correct} onChange={() => updateCorrectAnswer(q.id, opt.code)} disabled={loading} />
                  <input className="login-input" style={{ border: 'none', background: 'transparent', margin: 0 }} defaultValue={opt.text} onBlur={(e) => handleUpdateText(`${API}/exams/options/${opt.id}`, e.target.value)} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- 3. QUẢN LÝ ĐỀ THI (KHÓA QUYỀN SỬA CHO ADMIN) ---
export function ExamManager({ token, me }) {
  const [exams, setExams] = useState([]);
  const [view, setView] = useState('list');
  const [id, setId] = useState(null);

  const load = () => axios.get(`${API}/exams`, { headers: { Authorization: "Bearer " + token } }).then(r => setExams(r.data));
  useEffect(() => { load(); }, [token]);

  // ✅ Kiểm tra quyền Admin
  const isAdmin = me.roles?.some(r => r.toLowerCase() === 'admin');

  return (
    <div className="card" style={{ padding: '20px' }}>
      {view === 'stats' ? <ExamStats token={token} examId={id} onClose={() => setView('list')} /> :
        view === 'edit' ? <ExamQuestionEditor token={token} examId={id} onClose={() => setView('list')} /> :
          <table className="history-table" style={{ width: '100%' }}>
            <thead><tr><th>TÊN ĐỀ</th><th>MÔN</th><th style={{ textAlign: 'center' }}>HÀNH ĐỘNG</th></tr></thead>
            <tbody>
              {exams.map(ex => (
                <tr key={ex.id}>
                  <td><strong>{ex.title}</strong></td><td>{ex.subject}</td>
                  <td style={{ textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: '5px', justifyContent: 'center' }}>
                      <button className="btn-primary" style={{ background: '#10b981', padding: '5px 10px' }} onClick={() => { setId(ex.id); setView('stats'); }}>📊 Thống kê</button>

                      {/* ✅ CHỈ GIÁO VIÊN MỚI THẤY NÚT SỬA */}
                      {!isAdmin && (
                        <button className="btn-primary" style={{ background: '#3b82f6', padding: '5px 10px' }} onClick={() => { setId(ex.id); setView('edit'); }}>✏️ Sửa câu</button>
                      )}

                      <button className="btn-primary" style={{ background: '#ef4444', padding: '5px 10px' }} onClick={async () => { if (window.confirm("Xóa đề?")) { await axios.delete(`${API}/exams/${ex.id}`, { headers: { Authorization: "Bearer " + token } }); load(); } }}>🗑️ Xóa</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
      }
    </div>
  );
}

// --- 4. TẠO ĐỀ THI (CÓ SETUP THỜI GIAN & CHỌN NGẪU NHIÊN) ---
export function TeacherPanel({ token, me, refresh }) {
  const [form, setForm] = useState({ title: "", subject: "", duration: 60 });
  const [subjects, setSubjects] = useState([]);
  const [bank, setBank] = useState([]);
  const [selected, setSelected] = useState([]);
  const [rand, setRand] = useState(5);

  useEffect(() => { axios.get(`${API}/exams/banks/list/subjects`, { headers: { Authorization: "Bearer " + token } }).then(r => setSubjects(r.data)); }, [token]);
  useEffect(() => { if (form.subject) axios.get(`${API}/exams/banks/subject/${form.subject}`, { headers: { Authorization: "Bearer " + token } }).then(r => setBank(r.data)); }, [form.subject]);

  const handleSave = async () => {
    if (!form.title || !form.subject || !selected.length) return alert("Thiếu thông tin hoặc chưa chọn câu hỏi!");
    try {
      const res = await axios.post(`${API}/exams`, { ...form, created_by: me.id }, { headers: { Authorization: "Bearer " + token } });
      const qs = bank.filter(q => selected.includes(q.id));
      await axios.post(`${API}/exams/${res.data.id}/questions-batch`, { questions: qs }, { headers: { Authorization: "Bearer " + token } });
      alert("Tạo đề thành công!"); refresh();
    } catch { alert("Lỗi khi lưu đề!"); }
  };

  return (
    <div className="card" style={{ padding: '20px' }}>
      <h3>🚀 Soạn đề thi mới (Test Auto Deploy CI/CD)</h3>
      <div style={{ display: 'flex', gap: '10px', marginBottom: '15px', alignItems: 'center' }}>
        <input className="login-input" style={{ flex: 2, margin: 0 }} placeholder="Tên đề thi" value={form.title || ""} onChange={e => setForm({ ...form, title: e.target.value })} />
        <select className="login-input" style={{ flex: 1, margin: 0 }} value={form.subject || ""} onChange={e => setForm({ ...form, subject: e.target.value })}>
          <option value="">-- Chọn môn --</option>
          {subjects.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        {/* ✅ Ô SETUP THỜI GIAN LÀM BÀI ĐÃ ĐƯỢC PHỤC HỒI TẠI ĐÂY */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <input type="number" className="login-input" style={{ width: '80px', margin: 0, textAlign: 'center' }} value={form.duration} onChange={e => setForm({ ...form, duration: e.target.value })} />
          <span style={{ fontSize: '13px', color: '#666', whiteSpace: 'nowrap' }}>phút</span>
        </div>

        <button className="btn-primary" style={{ margin: 0, whiteSpace: 'nowrap' }} onClick={handleSave}>Lưu đề</button>
      </div>

      {form.subject && (
        <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '10px' }}>
          <div style={{ marginBottom: '10px' }}>
            🎲 Lấy ngẫu nhiên <input type="number" style={{ width: '50px' }} value={rand} onChange={e => setRand(e.target.value)} /> câu
            <button className="btn-outline" onClick={() => setSelected(bank.sort(() => 0.5 - Math.random()).slice(0, rand).map(q => q.id))} style={{ marginLeft: '10px', padding: '5px 15px' }}>Thực hiện</button>
          </div>
          <div style={{ maxHeight: '300px', overflowY: 'auto', marginTop: '10px' }}>
            {bank.map(q => (
              <label key={q.id} style={{ display: 'block', padding: '8px', borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }}>
                <input type="checkbox" checked={selected.includes(q.id)} onChange={() => setSelected(prev => prev.includes(q.id) ? prev.filter(i => i !== q.id) : [...prev, q.id])} />
                <span style={{ marginLeft: '8px' }}>{q.text}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// --- 5. NGÂN HÀNG CÂU HỎI (FIX TRIỆT ĐỂ LỖI IMPORT WORD VÀ DÍNH CHỮ) ---
export function QuestionBankManager({ token }) {
  const [subjects, setSubjects] = useState([]);
  const [selectedSub, setSelectedSub] = useState("");
  const [questions, setQuestions] = useState([]);
  const [qText, setQText] = useState("");
  const [opts, setOpts] = useState(["", "", "", ""]);
  const [correct, setCorrect] = useState(0);
  const [newSub, setNewSub] = useState("");
  const [editId, setEditId] = useState(null);

  const loadQs = (s) => axios.get(`${API}/exams/banks/subject/${s}`, { headers: { Authorization: "Bearer " + token } }).then(r => setQuestions(r.data));
  const loadSubs = () => axios.get(`${API}/exams/banks/list/subjects`, { headers: { Authorization: "Bearer " + token } }).then(r => setSubjects(r.data));

  useEffect(() => { loadSubs(); }, []);
  useEffect(() => { if (selectedSub) loadQs(selectedSub); }, [selectedSub]);

  const parseWord = async (file) => {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    
    // Tách các đáp án bị dính trên cùng 1 dòng (ví dụ " A. " hoặc " B) ") xuống dòng mới
    let rawContent = result.value.replace(/\s+([A-D][\.\)]\s+)/g, '\n$1');

    const lines = rawContent.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const parsed = []; let current = null;

    lines.forEach(line => {
      // 1. Nhận diện tiêu đề câu hỏi
      if (line.match(/^(Câu\s*\d+:|Question\s*\d+:|^\d+\.)/i)) {
        if (current) parsed.push(current);
        let text = line.replace(/^(Câu\s*\d+:|Question\s*\d+:|^\d+\.)\s*/i, '');
        current = { text, options: [] };
      }
      // 2. Nhận diện các Option A, B, C, D
      else if (current && line.match(/^[A-D][\.\)]/)) {
        current.options.push({ code: line[0].toUpperCase(), text: line.substring(2).trim(), is_correct: false });
      }
      // 3. Nhận diện dòng "Đáp án: X" để set đúng
      else if (current && line.match(/^Đáp án:\s*([A-D])/i)) {
        const match = line.match(/^Đáp án:\s*([A-D])/i);
        const correctLetter = match[1].toUpperCase();
        current.options = current.options.map(o => ({ ...o, is_correct: o.code === correctLetter }));
      }
    });
    if (current) parsed.push(current);
    return parsed;
  };

  const handleImport = async (e) => {
    const sub = newSub || selectedSub;
    if (!sub || !e.target.files[0]) return alert("Vui lòng chọn môn và file!");
    const qs = await parseWord(e.target.files[0]);
    if (!qs.length) return alert("Không tìm thấy câu hỏi hợp lệ!");
    await axios.post(`${API}/exams/banks-batch`, { subject: sub, questions: qs }, { headers: { Authorization: "Bearer " + token } });
    alert("✅ Import thành công!"); loadQs(sub);
    e.target.value = "";
  };

  const startEdit = (q) => {
    setEditId(q.id); setQText(q.text);
    setOpts(q.options?.map(o => o.text) || ["", "", "", ""]);
    setCorrect(q.options?.findIndex(o => o.is_correct) ?? 0);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSave = async () => {
    const sub = newSub || selectedSub;
    if (!sub || !qText) return alert("Thiếu thông tin!");
    const payload = { subject: sub, text: qText, options: opts.map((t, i) => ({ text: t, code: String.fromCharCode(65 + i), is_correct: i === correct })) };
    try {
      if (editId) await axios.put(`${API}/exams/banks/${editId}`, payload, { headers: { Authorization: "Bearer " + token } });
      else await axios.post(`${API}/exams/banks`, payload, { headers: { Authorization: "Bearer " + token } });
      alert("Đã lưu!"); setEditId(null); setQText(""); setOpts(["", "", "", ""]); loadQs(sub);
    } catch { alert("Lỗi!"); }
  };

  return (
    <div style={{ display: 'flex', gap: '20px' }}>
      <div className="card" style={{ flex: 1, padding: '20px', background: '#fff', border: editId ? '2px solid #fbbf24' : '1px solid #eee' }}>
        <h3>{editId ? "📝 Sửa câu hỏi" : "➕ Thêm mới"}</h3>

        {/* Phần chọn môn và nhập môn mới */}
        <div style={{ display: 'flex', gap: '5px', marginBottom: '10px' }}>
          <select className="login-input" style={{ flex: 1, margin: 0 }} value={selectedSub} onChange={e => setSelectedSub(e.target.value)}>
            <option value="">-- Môn --</option>
            {subjects.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <input className="login-input" style={{ flex: 1, margin: 0 }} placeholder="Môn mới" value={newSub} onChange={e => setNewSub(e.target.value)} />
        </div>

        <textarea className="login-input" placeholder="Nội dung" value={qText} onChange={e => setQText(e.target.value)} style={{ height: '80px' }} />
        {opts.map((t, i) => (
          <div key={i} style={{ display: 'flex', gap: '5px', marginBottom: '5px', alignItems: 'center' }}>
            <input type="radio" checked={correct === i} onChange={() => setCorrect(i)} />
            <input className="login-input" style={{ margin: 0, flex: 1 }} value={t} onChange={e => { const n = [...opts]; n[i] = e.target.value; setOpts(n); }} />
          </div>
        ))}
        <button className="btn-primary" style={{ width: '100%', marginTop: '10px' }} onClick={handleSave}>💾 Lưu câu hỏi</button>
        {editId && <button className="btn-outline" style={{ width: '100%', marginTop: '5px' }} onClick={() => { setEditId(null); setQText(""); setOpts(["", "", "", ""]); }}>Hủy sửa</button>}

        <div style={{ marginTop: '20px', border: '1px dashed #3b82f6', padding: '15px', textAlign: 'center', borderRadius: '8px' }}>
          <p style={{ color: '#3b82f6', fontWeight: 'bold' }}>📄 Import Word (.docx)</p>
          <input type="file" accept=".docx" onChange={handleImport} />
        </div>
      </div>

      <div className="card" style={{ flex: 1.5, padding: '20px', maxHeight: '75vh', overflowY: 'auto' }}>
        <h3>Ngân hàng: {selectedSub}</h3>
        {questions.map((q, idx) => (
          <div key={q.id} style={{ marginBottom: '15px', padding: '15px', background: '#f8fafc', borderRadius: '10px', position: 'relative', border: '1px solid #eee' }}>
            <div style={{ position: 'absolute', top: '10px', right: '10px', display: 'flex', gap: '5px' }}>
              <button onClick={() => startEdit(q)} style={{ background: '#dbeafe', color: '#3b82f6', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer' }}>✏️</button>
              <button onClick={async () => { if (window.confirm("Xóa?")) { await axios.delete(`${API}/exams/banks/${q.id}`, { headers: { Authorization: "Bearer " + token } }); loadQs(selectedSub); } }} style={{ background: '#fee2e2', color: '#ef4444', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer' }}>🗑️</button>
            </div>
            <p><strong>Câu {idx + 1}:</strong> {q.text}</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px', fontSize: '13px' }}>
              {q.options?.map(o => <span key={o.id} style={{ color: o.is_correct ? '#10b981' : '#64748b', fontWeight: o.is_correct ? 'bold' : 'normal' }}>{o.code}. {o.text} {o.is_correct && '✅'}</span>)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}