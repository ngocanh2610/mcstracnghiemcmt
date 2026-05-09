import React, { useState, useEffect } from "react";
import axios from "axios";
import { API } from "../config";

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

export function ExamTake({ token, examId, me, onClose }) {
  const [data, setData] = useState(null);
  const [answers, setAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [flagged, setFlagged] = useState({});
  const [currentPage, setCurrentPage] = useState(0);
  const QUESTIONS_PER_PAGE = 10;

  useEffect(() => {
    axios.get(`${API}/exams/${examId}`, { headers: { Authorization: "Bearer " + token } })
      .then(r => { 
        const shuffle = (array) => [...array].sort(() => Math.random() - 0.5);
        let randomizedQuestions = shuffle(r.data.questions);
        randomizedQuestions = randomizedQuestions.map(q => ({
          ...q, options: shuffle(q.options)
        }));
        setData({ ...r.data, questions: randomizedQuestions }); 
        setTimeLeft(r.data.exam.duration * 60); 
      });
  }, [examId, token]);

  useEffect(() => {
    if (timeLeft === null || isSubmitting) return;
    if (timeLeft <= 0) { submit(true); return; }
    const timer = setInterval(() => setTimeLeft(p => p - 1), 1000);
    return () => clearInterval(timer);
  }, [timeLeft, isSubmitting]);

  // --- TÍNH NĂNG AUTO-SAVE (Mỗi 30 giây lưu 1 lần) ---
  useEffect(() => {
    // Không lưu nếu đang nộp bài, hoặc chưa load xong data, hoặc chưa làm câu nào
    if (isSubmitting || !data || Object.keys(answers).length === 0) return;
    
    const autosaveTimer = setInterval(() => {
      console.log("Đang lưu nháp tự động...");
      axios.post(`${API}/submissions/autosave`, {
        exam_id: examId,
        user_id: me.id,
        answers: answers,
        duration_seconds: (data.exam.duration * 60) - (timeLeft < 0 ? 0 : timeLeft)
      }, { headers: { Authorization: "Bearer " + token } })
      .then(() => console.log("✅ Lưu nháp thành công!"))
      .catch((err) => console.error("❌ Lỗi lưu nháp:", err));
    }, 30000); // 30 giây

    return () => clearInterval(autosaveTimer);
  }, [answers, timeLeft, isSubmitting, examId, me.id, data, token]);
  // ----------------------------------------------------

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
    if (window.confirm("Bạn có chắc muốn thoát? Kết quả làm bài hiện tại sẽ không được lưu!")) {
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
                    <button 
                      onClick={() => toggleFlag(q.id)}
                      style={{
                        background: flagged[q.id] ? '#fef08a' : '#f1f5f9',
                        border: '1px solid #e2e8f0',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        padding: '4px 8px',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        color: '#475569',
                        whiteSpace: 'nowrap'
                      }}
                      title="Đánh dấu câu này để xem lại sau"
                    >
                      {flagged[q.id] ? '🚩 Đã gắn cờ' : '🏳️ Gắn cờ'}
                    </button>
                  </div>
                  <div className="options-list">
                    {q.options.map(opt => (
                      <label key={opt.id} className="option-item">
                        <input 
                          type="radio" 
                          name={q.id} 
                          onChange={() => setAnswers({...answers, [q.id]: opt.code})} 
                          disabled={isSubmitting} 
                          checked={answers[q.id] === opt.code}
                        />
                        <span>{opt.text}</span>
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', padding: '15px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <button 
                className="btn-outline" 
                disabled={currentPage === 0} 
                onClick={() => { setCurrentPage(p => p - 1); window.scrollTo(0,0); }}
                style={{ padding: '8px 16px', background: currentPage === 0 ? '#e2e8f0' : '#fff' }}
              >
                ⬅ Trang trước
              </button>
              <span style={{ fontWeight: 'bold', color: '#475569' }}>Trang {currentPage + 1} / {totalPages}</span>
              <button 
                className="btn-outline" 
                disabled={currentPage === totalPages - 1} 
                onClick={() => { setCurrentPage(p => p + 1); window.scrollTo(0,0); }}
                style={{ padding: '8px 16px', background: currentPage === totalPages - 1 ? '#e2e8f0' : '#fff' }}
              >
                Trang sau ➡
              </button>
            </div>
          </div>
          <div className="exam-palette-panel">
            <h4 style={{margin: '0 0 15px 0', color: '#1e293b'}}>Tiến độ làm bài</h4>
            <div className="palette-grid">
              {data.questions.map((q, i) => {
                const isAnswered = !!answers[q.id]; 
                return (
                  <button
                    key={q.id}
                    className={`palette-box ${isAnswered ? 'answered' : ''}`}
                    onClick={() => scrollToQuestion(i)}
                    style={{
                      position: 'relative',
                      border: flagged[q.id] ? '2px solid #ef4444' : '',
                      background: flagged[q.id] && !isAnswered ? '#fee2e2' : ''
                    }}
                  >
                    {i + 1}
                    {flagged[q.id] && <span style={{ position: 'absolute', top: '-6px', right: '-6px', fontSize: '12px' }}>🚩</span>}
                  </button>
                );
              })}
            </div>
            <div style={{marginTop: '25px', borderTop: '1px solid #e5e7eb', paddingTop: '15px'}}>
              <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '15px', fontSize: '14px', color: '#64748b'}}>
                <span>Đã làm: <strong style={{color: '#10b981'}}>{Object.keys(answers).length}</strong></span>
                <span>Chưa làm: <strong>{data.questions.length - Object.keys(answers).length}</strong></span>
              </div>
              <button className="btn-primary" onClick={() => submit(false)} disabled={isSubmitting} style={{width:'100%', padding: '14px'}}>
                {isSubmitting ? "Đang xử lý..." : "Nộp bài ngay"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}