import { useState } from 'react';
import { Icon } from '../../components/Icon';

const MOCK_REVIEWS = [
  {
    id: 1,
    customerName: 'Sarah Johnson',
    initials: 'SJ',
    avatarBg: '#FCE7F3',
    avatarColor: '#EC4899',
    serviceName: 'Sơn gel',
    date: '28 Th09, 2026',
    rating: 5,
    text: 'Emma thật tuyệt vời. Bộ móng gel của tôi giữ được gần ba tuần mà không bị mẻ chút nào. Tiệm rất sạch sẽ và thư giãn.',
    reply: 'Cảm ơn Sarah! Chúng tôi rất vui vì bạn thích nó. Hẹn gặp lại bạn lần sau.'
  },
  {
    id: 2,
    customerName: 'Isabella Lee',
    initials: 'IL',
    avatarBg: '#FCE7F3',
    avatarColor: '#EC4899',
    serviceName: 'Đắp bột',
    date: '26 Th09, 2026',
    rating: 4,
    text: 'Trải nghiệm tuyệt vời! Nhân viên rất thân thiện.',
    reply: null
  }
];

function Stars({ rating }: { rating: number }) {
  return (
    <div style={{ display: 'flex', gap: '2px' }}>
      {[1, 2, 3, 4, 5].map(i => (
        <span key={i} style={{ color: i <= rating ? '#F59E0B' : '#E2E8F0', fontSize: '16px' }}>★</span>
      ))}
    </div>
  );
}

export function AdminReviewsPage() {
  const [reviews] = useState(MOCK_REVIEWS);
  const [editingId, setEditingId] = useState<number | null>(1);

  return (
    <div style={{ paddingTop: '8px', paddingBottom: '32px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <h1 style={{ margin: '0 0 6px', fontSize: '26px', fontWeight: 700, color: '#0F172A' }}>
            Đánh giá & Phản hồi
          </h1>
          <p style={{ margin: 0, fontSize: '14px', color: '#64748B' }}>
            Đọc những gì khách hàng nói và phản hồi trực tiếp.
          </p>
        </div>
        
        {/* Summary Card */}
        <div style={{ background: '#FFFFFF', borderRadius: '16px', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.02)', border: '1px solid #F1F5F9' }}>
          <span style={{ fontSize: '28px', fontWeight: 700, color: '#0F172A' }}>4.0</span>
          <div>
            <Stars rating={4} />
            <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>6 đánh giá</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div style={{ display: 'flex', gap: '12px' }}>
          <select style={{ padding: '8px 32px 8px 16px', borderRadius: '8px', border: '1px solid #E2E8F0', background: '#FFFFFF', outline: 'none', color: '#334155', fontSize: '14px', appearance: 'none', backgroundImage: 'url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns=\\\'http://www.w3.org/2000/svg\\\' viewBox=\\\'0 0 24 24\\\' fill=\\\'none\\\' stroke=\\\'%2364748B\\\' stroke-width=\\\'2\\\' stroke-linecap=\\\'round\\\' stroke-linejoin=\\\'round\\\'%3e%3cpolyline points=\\\'6 9 12 15 18 9\\\'%3e%3c/polyline%3e%3c/svg%3e")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', backgroundSize: '16px' }}>
            <option>Tất cả đánh giá</option>
            <option>5 Sao</option>
            <option>4 Sao</option>
          </select>
          <select style={{ padding: '8px 32px 8px 16px', borderRadius: '8px', border: '1px solid #E2E8F0', background: '#FFFFFF', outline: 'none', color: '#334155', fontSize: '14px', appearance: 'none', backgroundImage: 'url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns=\\\'http://www.w3.org/2000/svg\\\' viewBox=\\\'0 0 24 24\\\' fill=\\\'none\\\' stroke=\\\'%2364748B\\\' stroke-width=\\\'2\\\' stroke-linecap=\\\'round\\\' stroke-linejoin=\\\'round\\\'%3e%3cpolyline points=\\\'6 9 12 15 18 9\\\'%3e%3c/polyline%3e%3c/svg%3e")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', backgroundSize: '16px' }}>
            <option>Tất cả dịch vụ</option>
            <option>Sơn gel</option>
          </select>
        </div>
        <span style={{ fontSize: '14px', color: '#64748B' }}>Đang hiển thị 6 trên 6</span>
      </div>

      {/* Review List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {reviews.map((r) => (
          <div key={r.id} style={{ background: '#FFFFFF', borderRadius: '20px', padding: '24px', boxShadow: '0 2px 10px rgba(0,0,0,0.02)', border: '1px solid #F1F5F9' }}>
            {/* Review Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: r.avatarBg, color: r.avatarColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: 600 }}>
                  {r.initials}
                </div>
                <div>
                  <div style={{ fontSize: '16px', fontWeight: 600, color: '#0F172A', marginBottom: '2px' }}>{r.customerName}</div>
                  <div style={{ fontSize: '13px', color: '#94A3B8' }}>{r.serviceName} · {r.date}</div>
                </div>
              </div>
              <Stars rating={r.rating} />
            </div>

            {/* Review Text */}
            <div style={{ fontSize: '14px', color: '#334155', lineHeight: 1.5, marginBottom: '20px' }}>
              {r.text}
            </div>

            {/* Existing Reply */}
            {r.reply && (
              <div style={{ marginBottom: editingId === r.id ? '16px' : '0' }}>
                <div style={{ background: '#FDF2F8', borderLeft: '4px solid #EC4899', padding: '16px', borderRadius: '0 12px 12px 0', marginBottom: editingId !== r.id ? '12px' : '0' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#EC4899', marginBottom: '8px' }}>Phản hồi từ Tiệm Nail</div>
                  <div style={{ fontSize: '14px', color: '#334155', lineHeight: 1.5 }}>{r.reply}</div>
                </div>
                {editingId !== r.id && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button onClick={() => setEditingId(r.id)} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #E2E8F0', background: '#FFFFFF', color: '#334155', fontWeight: 600, cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Icon name="edit" /> Sửa phản hồi
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Reply Input Form */}
            {editingId === r.id ? (
              <div>
                <textarea 
                  defaultValue={r.reply || ''}
                  placeholder="Nhập câu trả lời của bạn ở đây..."
                  style={{ width: '100%', height: '80px', padding: '16px', borderRadius: '12px', border: '1px solid #E2E8F0', background: '#F8FAFC', outline: 'none', color: '#334155', fontSize: '14px', resize: 'none', boxSizing: 'border-box', marginBottom: '16px', fontFamily: 'inherit' }}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                  <button onClick={() => setEditingId(null)} style={{ padding: '10px 20px', borderRadius: '24px', border: 'none', background: 'transparent', color: '#64748B', fontWeight: 600, cursor: 'pointer', fontSize: '14px' }}>
                    Hủy
                  </button>
                  <button onClick={() => setEditingId(null)} style={{ padding: '10px 20px', borderRadius: '24px', border: 'none', background: '#EC4899', color: '#FFFFFF', fontWeight: 600, cursor: 'pointer', fontSize: '14px' }}>
                    Gửi phản hồi
                  </button>
                </div>
              </div>
            ) : (
              !r.reply && (
                <button onClick={() => setEditingId(r.id)} style={{ padding: '8px 0', border: 'none', background: 'transparent', color: '#EC4899', fontWeight: 600, cursor: 'pointer', fontSize: '14px' }}>
                  Trả lời
                </button>
              )
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
