/* ===== Trang Đánh giá =====
   Dữ liệu từ bảng review: phân bố sao và từng nhận xét kèm dịch vụ, nhân viên
   phục vụ. Điểm đếm trực tiếp từ dữ liệu nên không có chuyện hiện 5 sao khi
   chưa có đánh giá nào. */

import { useState } from 'react';
import { Icon } from '../components/Icon';
import { Panel, SectionHeading, StatTile } from '../components/Primitives';
import { ReviewPanel } from '../components/ReviewPanel';
import { useApp } from '../store';
import { fmtRating } from '../lib/utils';

const FILTERS = [
  { key: '', label: 'Tất cả' },
  { key: '5', label: '5 sao' },
  { key: '4', label: '4 sao' },
  { key: 'low', label: '3 sao trở xuống' },
];

export function AdminReviewsPage() {
  const { state } = useApp();
  const { reviews, reviewStats } = state;

  const [filter, setFilter] = useState('');

  const rows = reviews.filter((review) => {
    if (filter === 'low') return review.rating <= 3;
    if (filter === '') return true;
    return review.rating === Number(filter);
  });

  const total = reviewStats.total || 1;
  const bars = [
    { stars: 5, count: reviewStats.five },
    { stars: 4, count: reviewStats.four },
    { stars: 3, count: reviewStats.low },
  ];

  return (
    <>
      <div className="adm-tiles adm-tiles-4">
        <StatTile tone="gold" icon="star" label="Điểm trung bình"
          value={fmtRating(reviewStats.average)}
          note={`${reviewStats.total} đánh giá`} />
        <StatTile tone="sage" icon="check" label="Hài lòng"
          value={`${Math.round((reviewStats.five / total) * 100)}%`}
          note={`${reviewStats.five} đánh giá 5 sao`} />
        <StatTile tone="lavender" icon="sparkles" label="Khá tốt" value={reviewStats.four} note="4 sao" />
        <StatTile tone="rose" icon="ban" label="Cần cải thiện" value={reviewStats.low}
          note="3 sao trở xuống" />
      </div>

      <div className="adm-split-even">
        <Panel>
          <SectionHeading icon={<Icon name="star" />} title="Phân bố đánh giá" subtitle="Tất cả dịch vụ" />
          <div className="adm-tools" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 9 }}>
            {bars.map((bar) => (
              <div key={bar.stars} className="adm-bar-row"
                style={{ gridTemplateColumns: '46px minmax(0,1fr) 34px' }}>
                <span className="adm-bar-name">{bar.stars} sao</span>
                <span className="adm-bar-track">
                  <span className="adm-bar-fill is-gold"
                    style={{ width: `${(bar.count / total) * 100}%` }} />
                </span>
                <span className="adm-bar-value">{bar.count}</span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel>
          <SectionHeading
            icon={<Icon name="email" />}
            title="Nhận xét gần đây"
            subtitle={`${rows.length} đang hiện`}
          />
          <div className="adm-tools" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
            <div className="mode-tabs" style={{ flexWrap: 'wrap' }}>
              {FILTERS.map((item) => (
                <button key={item.key} className={filter === item.key ? 'active' : ''}
                  onClick={() => setFilter(item.key)}>{item.label}</button>
              ))}
            </div>
          </div>
          <ReviewPanel reviews={rows.slice(0, 12)} />
        </Panel>
      </div>
    </>
  );
}
