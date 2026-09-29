/* ===== Sao đánh giá: lớp phủ theo phần trăm để hiện nửa sao chính xác ===== */

export function Stars({ rating }: { rating: number }) {
  const value = Number(rating) || 0;
  if (value <= 0) return <span className="cust-stars-none">Chưa đánh giá</span>;
  const percent = Math.max(0, Math.min(100, (value / 5) * 100));
  return (
    <span className="cust-stars" role="img" aria-label={`${value.toFixed(1)} trên 5 sao`}>
      <span className="cust-stars-track">★★★★★</span>
      <span className="cust-stars-fill" style={{ width: `${percent}%` }}>★★★★★</span>
    </span>
  );
}
