/* ===== Danh sách nhận xét của khách =====
   Dùng lại ở trang Đánh giá và ở cuối Dashboard. */

import { Avatar } from './Avatar';
import { EmptyState } from './Primitives';
import type { ReviewItem } from '../store';
import { fmtDate } from '../lib/utils';

export function ReviewPanel({ reviews }: { reviews: ReviewItem[] }) {
  if (reviews.length === 0) {
    return <EmptyState title="Chưa có đánh giá" detail="Nhận xét của khách sẽ hiện ở đây." />;
  }

  return (
    <div className="adm-review-list">
      {reviews.map((review) => (
        <article key={review.id} className="adm-review">
          <Avatar name={review.customerName} url={review.customerAvatarUrl} size={32} />
          <div className="adm-review-body">
            <div className="adm-review-head">
              <strong>{review.customerName}</strong>
              <span className="adm-stars">
                {[1, 2, 3, 4, 5].map((n) => (
                  <span key={n} className={n <= review.rating ? 'is-on' : ''}>★</span>
                ))}
              </span>
            </div>
            <p>{review.comment ?? 'Khách không để lại lời nhắn.'}</p>
            <small>
              {review.serviceName}
              {review.staffName ? ` · ${review.staffName}` : ''} · {fmtDate(review.createdAt)}
            </small>
          </div>
        </article>
      ))}
    </div>
  );
}
