import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { API } from "../config";

// --- 1. COMPONENT DASHBOARD & TÌM KIẾM (MỚI THÊM) ---
export function StudentDashboard({ token, exams, onTakeExam }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [attemptedCount, setAttemptedCount] = useState(0);

  // Tính số đề đã làm từ lịch sử thi
  useEffect(() => {
    axios.get(`${API}/submissions/my`, { headers: { Authorization: "Bearer " + token } })
      .then(r => {
        // Dùng Set để đếm số lượng đề thi duy nhất đã từng làm
        const uniqueExams = new Set(r.data.map(sub => sub.exam_id));
        setAttemptedCount(uniqueExams.size);
      })
      .catch(err => console.error("Lỗi lấy thống kê:", err));
  }, [token]);

  // Lọc đề thi theo từ khóa (Tìm theo tên hoặc môn học)
  const filteredExams = exams.filter(e => {
    const keyword = searchQuery.toLowerCase();
    const matchTitle = e.title && e.title.toLowerCase().includes(keyword);
    const matchSubject = e.subject && e.subject.toLowerCase().includes(keyword); 
    return matchTitle || matchSubject;
  });

  return (
    <div className="dashboard-container">
      {/* KHỐI THỐNG KÊ */}
      <div style={{ display: 'flex', gap: '20px', marginBottom: '30px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '250px', padding: '20px', background: '#eff6ff', borderRadius: '12px', border: '1px solid #bfdbfe', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h4 style={{ margin: '0 0 5px 0', color: '#1e3a8a' }}>Tổng số đề thi</h4>
            <p style={{ margin: 0, fontSize: '14px', color: '#3b82f6' }}>Hiện có trên hệ thống</p>
          </div>
          <span style={{ fontSize: '32px', fontWeight: 'bold', color: '#1d4ed8' }}>{exams.length}</span>
        </div>

        <div style={{ flex: 1, minWidth: '250px', padding: '20px', background: '#f0fdf4', borderRadius: '12px', border: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h4 style={{ margin: '0 0 5px 0', color: '#14532d' }}>Số đề đã thử sức</h4>
            <p style={{ margin: 0, fontSize: '14px', color: '#22c55e' }}>Đã hoàn thành ít nhất 1 lần</p>
          </div>
          <span style={{ fontSize: '32px', fontWeight: 'bold', color: '#15803d' }}>{attemptedCount}</span>
        </div>
      </div>

      {/* KHỐI TÌM KIẾM */}
      <div style={{ marginBottom: '20px' }}>
        <input 
          type="text" 
          placeholder="🔍 Nhập tên đề thi hoặc môn học để tìm kiếm..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ width: '100%', padding: '12px 20px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '16px', outline: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
        />
      </div>

      {/* DANH SÁCH ĐỀ THI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
        {filteredExams.length > 0 ? (
          filteredExams.map(exam => (
            <div key={exam.id} style={{ padding: '20px', background: 'white', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', border: '1px solid #f3f4f6', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <span style={{ display: 'inline-block', padding: '4px 8px', background: '#e0e7ff', color: '#4f46e5', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', marginBottom: '10px' }}>
                  {exam.subject || "Thi trắc nghiệm"}
                </span>
                <h3 style={{ margin: '0 0 10px 0', fontSize: '18px', color: '#111827' }}>{exam.title}</h3>
                <p style={{ margin: '0 0 20px 0', fontSize: '14px', color: '#6b7280' }}>⏱ Thời gian: {exam.duration} phút</p>
              </div>
              <button 
                onClick={() => onTakeExam(exam.id)}
                style={{ width: '100%', padding: '10px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', transition: 'background 0.2s' }}
                onMouseOver={(e) => e.target.style.background = '#2563eb'}
                onMouseOut={(e) => e.target.style.background = '#3b82f6'}
              >
                📝 Bắt đầu làm bài
              </button>
            </div>
          ))
        ) : (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px', color: '#6b7280', background: '#f9fafb', borderRadius: '8px' }}>
            Không tìm thấy đề thi nào phù hợp với từ khóa "{searchQuery}"
          </div>
        )}
      </div>
    </div>
  );
}

// --- 2. COMPONENT LỊCH SỬ THI ---
export function StudentHistory({ token, exams }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reviewId, setReviewId] = useState(null);

  useEffect(() => {
    axios.get(`${API}/submissions/my`, { headers: { Authorization: "Bearer " + token } })
      .then(async r => {
        const full = await Promise.all(r.data.map(async s => {
          try {
            const sc = await axios.get(`${API}/results/submission/${s.id}`, { headers: { Authorization: "Bearer " + token } });
            return { ...s, score: sc.data.score };
          } catch { return { ...s, score: null }; }
        }));
        setHistory(full); setLoading(false);
      });
  }, [token]);

  return (
    <div className="exam-box">
      <h3>Lịch sử thi</h3>
      {loading ? <p>Đang tải lịch sử...</p> : (
        <table className="history-table">
          <thead><tr><th>Đề thi</th><th>Ngày làm</th><th>Điểm</th><th>Hành động</th></tr></thead>
          <tbody>
            {history.map(h => (
              <tr key={h.id}>
                <td>{exams.find(e => e.id === h.exam_id)?.title || "Đề thi đã xóa"}</td>
                <td>{new Date(h.created_at).toLocaleString()}</td>
                <td style={{fontWeight:'bold', color: h.score === null ? '#d97706' : '#16a34a'}}>{h.score !== null ? `${h.score}đ` : "Đang chấm..."}</td>
                <td>
                  {h.score !== null && (
                    <button className="btn-outline" style={{padding: '4px 10px', fontSize: '13px'}} onClick={() => setReviewId(h.id)}>
                      👁️ Xem bài làm
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {reviewId && <ExamReview token={token} submissionId={reviewId} onClose={() => setReviewId(null)} />}
    </div>
  );
}

// --- 3. COMPONENT XEM LẠI BÀI ĐÃ LÀM ---
export function ExamReview({ token, submissionId, onClose }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    axios.get(`${API}/submissions/review/${submissionId}`, { headers: { Authorization: "Bearer " + token } })
      .then(r => setData(r.data))
      .catch(() => { alert("Lỗi tải chi tiết bài làm!"); onClose(); });
  }, [submissionId, token]);

  if (!data) return <div className="exam-take-overlay">Đang tải dữ liệu bài làm...</div>;

  return (
    <div className="exam-take-overlay">
      <div className="exam-box" style={{width: '90%', maxWidth: '800px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: '0'}}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems: 'center', padding: '20px', borderBottom: '1px solid #e5e7eb', background: '#f9fafb', borderRadius: '8px 8px 0 0'}}>
          <h3 style={{margin: 0, color: '#1f2937'}}>Chi tiết bài làm: {data.title}</h3>
          <button className="btn-logout" onClick={onClose}>Đóng</button>
        </div>
        <div style={{padding: '20px', overflowY: 'auto'}}>
          {data.review.map((q, i) => (
            <div key={q.id} className="question-card" style={{borderLeft: `5px solid ${q.isCorrect ? '#10b981' : '#ef4444'}`, marginBottom: '20px', padding: '15px', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.1)'}}>
              <p style={{fontSize: '16px', marginBottom: '15px'}}>
                <strong>Câu {i+1}:</strong> {q.text} 
                <span style={{marginLeft: '10px', fontSize: '14px', fontWeight: 'bold', color: q.isCorrect ? '#10b981' : '#ef4444'}}>
                  {q.isCorrect ? "✅ Đúng" : "❌ Sai"}
                </span>
              </p>
              <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
                {q.options.map(opt => {
                  let bg = "#f9fafb";
                  let border = "1px solid #e5e7eb";
                  let fw = "normal";

                  if (opt.code === q.correctChoice) {
                    bg = "#d1fae5"; border = "1px solid #10b981"; fw = "bold";
                  } else if (opt.code === q.studentChoice && !q.isCorrect) {
                    bg = "#fee2e2"; border = "1px solid #ef4444";
                  }

                  return (
                    <div key={opt.code} style={{padding: '12px', background: bg, borderRadius: '6px', border: border, fontWeight: fw, display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
                      <span>{opt.code}. {opt.text}</span>
                      {opt.code === q.studentChoice && (
                        <span style={{fontSize: '12px', background: '#3b82f6', color: 'white', padding: '2px 8px', borderRadius: '12px', fontWeight: 'normal'}}>Lựa chọn của bạn</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// --- 4. COMPONENT PHÒNG THI (CHÍNH) ---
export function ExamTake({ token, examId, me, onClose }) {
  const [data, setData] = useState(null);
  const [answers, setAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [flagged, setFlagged] = useState({});
  const [currentPage, setCurrentPage] = useState(0);
  const QUESTIONS_PER_PAGE = 10;

  // Sử dụng useRef để lưu giá trị mới nhất mà không gây re-render liên tục cho useEffect lưu nháp
  const latestAnswers = useRef(answers);
  const latestTimeLeft = useRef(timeLeft);

  useEffect(() => {
    latestAnswers.current = answers;
    latestTimeLeft.current = timeLeft;
  }, [answers, timeLeft]);

  // A. TẢI ĐỀ THI VÀ TỰ ĐỘNG PHỤC HỒI BẢN NHÁP CŨ (NẾU CÓ)
  useEffect(() => {
    axios.get(`${API}/exams/${examId}`, { headers: { Authorization: "Bearer " + token } })
      .then(async r => { 
        const shuffle = (array) => [...array].sort(() => Math.random() - 0.5);
        let randomizedQuestions = shuffle(r.data.questions);
        randomizedQuestions = randomizedQuestions.map(q => ({
          ...q, options: shuffle(q.options)
        }));
        setData({ ...r.data, questions: randomizedQuestions }); 
        
        const totalDuration = r.data.exam.duration * 60; // Tính theo giây

        // Kiểm tra xem có bản nháp nào từ Backend gửi lên không
        try {
          const draftRes = await axios.get(`${API}/submissions/draft/${examId}/${me.id}`, { headers: { Authorization: "Bearer " + token } });
          if (draftRes.data) {
            const savedAnswers = typeof draftRes.data.answers === 'string' ? JSON.parse(draftRes.data.answers) : draftRes.data.answers;
            setAnswers(savedAnswers || {});
            // Khôi phục thời gian còn lại
            const timeRemaining = totalDuration - (draftRes.data.duration_seconds || 0);
            setTimeLeft(timeRemaining > 0 ? timeRemaining : 0);
            console.log("📥 Đã khôi phục bài làm từ bản nháp.");
          } else {
            // Đảm bảo reset trạng thái về trắng tinh nếu bắt đầu lượt mới
            setAnswers({});
            setTimeLeft(totalDuration); 
            console.log("🆕 Không có nháp, bắt đầu lượt làm mới.");
          }
        } catch {
          // Nếu API lỗi, cũng cho học sinh làm mới từ đầu cho an toàn
          setAnswers({});
          setTimeLeft(totalDuration);
        }
      });
  }, [examId, token, me.id]);

  // B. ĐỒNG HỒ ĐẾM NGƯỢC
  useEffect(() => {
    if (timeLeft === null || isSubmitting) return;
    if (timeLeft <= 0) { submit(true); return; }
    const timer = setInterval(() => setTimeLeft(p => p - 1), 1000);
    return () => clearInterval(timer);
  }, [timeLeft, isSubmitting]);

  // C. TỰ ĐỘNG LƯU NHÁP SAU MỖI 30 GIÂY
  useEffect(() => {
    if (isSubmitting || !data) return;
    
    const autosaveTimer = setInterval(() => {
      const currentAns = latestAnswers.current;
      const currentRemaining = latestTimeLeft.current;

      if (Object.keys(currentAns).length === 0) return;

      console.log("⏳ Đang tự động lưu nháp...");
      axios.post(`${API}/submissions/autosave`, {
        exam_id: examId,
        user_id: me.id,
        answers: currentAns,
        duration_seconds: (data.exam.duration * 60) - (currentRemaining < 0 ? 0 : currentRemaining)
      }, { headers: { Authorization: "Bearer " + token } })
      .then(() => console.log("✅ Lưu nháp thành công!"))
      .catch((err) => console.error("❌ Lỗi lưu nháp:", err));
    }, 30000);

    return () => clearInterval(autosaveTimer);
  }, [isSubmitting, examId, me.id, data, token]);

  // D. HÀM NỘP BÀI
  const submit = async (isAuto = false) => {
    const unansweredCount = data.questions.length - Object.keys(answers).length;
    if (!isAuto && unansweredCount > 0) {
      if (!window.confirm(`Bạn còn ${unansweredCount} câu chưa làm. Bạn có chắc chắn muốn nộp bài không?`)) {
        return;
      }
    }
    
    if (isSubmitting) return; setIsSubmitting(true);
    try {
      await axios.post(`${API}/submissions`, {
        exam_id: examId, user_id: me.id, answers,
        duration_seconds: (data.exam.duration * 60) - (timeLeft < 0 ? 0 : timeLeft)
      }, { headers: { Authorization: "Bearer " + token } });
      if (!isAuto) alert("Nộp bài thành công!");
      setTimeout(() => onClose(true), 1500);
    } catch { alert("Lỗi nộp bài!"); setIsSubmitting(false); }
  };

  const scrollToQuestion = (index) => {
    const page = Math.floor(index / QUESTIONS_PER_PAGE);
    setCurrentPage(page);
    setTimeout(() => {
      const element = document.getElementById(`question-${index}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  };

  const handleExit = () => {
    if (window.confirm("Bạn có chắc muốn thoát? Mọi tiến trình chưa nộp bài sẽ dựa trên bản nháp cuối cùng!")) {
      onClose(false);
    }
  };

  const toggleFlag = (qId) => {
    setFlagged(prev => ({ ...prev, [qId]: !prev[qId] }));
  };

  if (!data) return <div className="exam-take-overlay"><div style={{padding: '50px', textAlign: 'center'}}>Đang tải đề thi...</div></div>;

  const totalPages = Math.ceil(data.questions.length / QUESTIONS_PER_PAGE);
  const currentQuestions = data.questions.slice(currentPage * QUESTIONS_PER_PAGE, (currentPage + 1) * QUESTIONS_PER_PAGE);

  return (
    <div className="exam-take-overlay">
      <div className="exam-container-wide">
        <div className="exam-take-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
              <button className="btn-outline" onClick={handleExit} style={{ padding: '6px 12px', fontSize: '14px', border: 'none', background: '#fee2e2', color: '#ef4444' }}>
                ⬅ Thoát
              </button>
              <h3 style={{ margin: 0 }}>{data.exam.title}</h3>
            </div>
            <div className={`timer ${timeLeft < 60 ? 'warning' : ''}`}>
                ⏳ {Math.floor(timeLeft/60)}:{(timeLeft%60).toString().padStart(2, '0')}
            </div>
        </div>
        <div className="exam-layout-split">
          <div className="exam-questions-list">
            {currentQuestions.map((q, localIndex) => {
              const i = currentPage * QUESTIONS_PER_PAGE + localIndex;
              return (
                <div key={q.id} id={`question-${i}`} className="question-card" style={{ borderLeft: flagged[q.id] ? '5px solid #ef4444' : '5px solid transparent', background: flagged[q.id] ? '#fef2f2' : '#fff' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <p style={{ margin: '0 0 15px 0' }}><strong>Câu {i+1}:</strong> {q.text}</p>
                    <button onClick={() => toggleFlag(q.id)} style={{ background: flagged[q.id] ? '#fef08a' : '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '4px 8px', fontSize: '12px' }}>
                      {flagged[q.id] ? '🚩 Đã gắn cờ' : '🏳️ Gắn cờ'}
                    </button>
                  </div>
                  <div className="options-list">
                    {q.options.map(opt => (
                      <label key={opt.id} className="option-item">
                        <input type="radio" name={q.id} onChange={() => setAnswers({...answers, [q.id]: opt.code})} checked={answers[q.id] === opt.code} />
                        <span>{opt.text}</span>
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px' }}>
              <button className="btn-outline" disabled={currentPage === 0} onClick={() => { setCurrentPage(p => p - 1); window.scrollTo(0,0); }}>⬅ Trang trước</button>
              <span>Trang {currentPage + 1} / {totalPages}</span>
              <button className="btn-outline" disabled={currentPage === totalPages - 1} onClick={() => { setCurrentPage(p => p + 1); window.scrollTo(0,0); }}>Trang sau ➡</button>
            </div>
          </div>
          <div className="exam-palette-panel">
            <h4>Tiến độ</h4>
            <div className="palette-grid">
              {data.questions.map((q, i) => (
                <button key={q.id} className={`palette-box ${answers[q.id] ? 'answered' : ''}`} onClick={() => scrollToQuestion(i)} style={{ border: flagged[q.id] ? '2px solid #ef4444' : '' }}>
                  {i + 1}
                </button>
              ))}
            </div>
            <div style={{marginTop: '25px'}}>
              <button className="btn-primary" onClick={() => submit(false)} disabled={isSubmitting} style={{width:'100%'}}>
                {isSubmitting ? "Đang xử lý..." : "Nộp bài ngay"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}