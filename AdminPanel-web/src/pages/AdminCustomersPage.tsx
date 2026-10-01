/* ===== Trang Khách hàng của quản trị =====

   Nguyên tắc nghiệp vụ ràng buộc bố cục trang này:
     - Chỉ có khách ĐÃ CÓ TÀI KHOẢN. Khách walk-in tại quầy không tự biến
       thành khách hàng.
     - Tổng chi tiêu chỉ cộng payment có PAID. Lịch chưa thanh toán không
       được tính vào, và số này lấy từ database chứ không đọc cột cache
       customer.total_spending.
     - Không xóa khách chỉ vì họ không còn dùng dịch vụ.
     - Trạng thái tài khoản (Active/Inactive) khác hẳn trạng thái lịch và
       trạng thái thanh toán — ba thứ này không trộn vào nhau.

   Bảng không có cột "Đánh giá" của khách: trong hệ thống review là khách
   đánh giá dịch vụ và nhân viên sau khi hoàn thành lịch, không phải cửa
   hàng đánh giá khách. */

import { useEffect, useMemo, useState } from 'react';
import { Icon } from '../components/Icon';
import { Avatar } from '../components/Avatar';
import { EmptyState, Panel, SectionHeading, StatTile } from '../components/Primitives';
import { useApp } from '../store';
import { fmtNum, formatVND, moneyShort } from '../lib/utils';

type SortKey = 'newest' | 'spend' | 'bookings' | 'noshow';

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'newest', label: 'Mới nhất' },
  { key: 'spend', label: 'Tổng chi tiêu cao nhất' },
  { key: 'bookings', label: 'Nhiều lịch nhất' },
  { key: 'noshow', label: 'No-show nhiều nhất' },
];

const SIZES = [10, 20, 50];

export function AdminCustomersPage() {
  const { state, openCustomerDetail } = useApp();
  const { customers, customerStats } = state;

  const [term, setTerm] = useState('');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState<SortKey>('newest');
  const [size, setSize] = useState(10);
  const [page, setPage] = useState(1);

  const filtering = Boolean(term.trim() || status);

  /* Nút "Đặt lại" chỉ có tác dụng khi đang lọc, nên chỉ cho bấm lúc đó. */
  useEffect(() => { setPage(1); }, [term, status, sort, size]);

  const rows = useMemo(() => {
    const keyword = term.trim().toLowerCase();
    return customers
      .filter((customer) => {
        if (status && customer.status !== status) return false;
        if (!keyword) return true;
        return customer.name.toLowerCase().includes(keyword)
          || customer.phone.includes(keyword)
          || (customer.email ?? '').toLowerCase().includes(keyword);
      })
      .sort((a, b) => {
        if (sort === 'spend') return b.totalSpending - a.totalSpending
          || b.paidCount - a.paidCount;
        if (sort === 'bookings') return b.bookingCount - a.bookingCount;
        if (sort === 'noshow') return b.noShowCount - a.noShowCount
          || b.bookingCount - a.bookingCount;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [customers, term, status, sort]);

  const totalPages = Math.max(1, Math.ceil(rows.length / size));
  const shown = rows.slice((page - 1) * size, page * size);

  function reset() {
    setTerm('');
    setStatus('');
  }

  return (
    <>
      <div className="adm-tiles adm-tiles-4">
        <StatTile tone="rose" icon="customers" label="Tổng khách hàng"
          value={fmtNum(customerStats.total)} note="Khách hàng có tài khoản" />
        <StatTile tone="sage" icon="card" label="Tổng chi tiêu"
          value={moneyShort(customerStats.totalSpending)} note="Tổng giá trị đã thanh toán" />
        <StatTile tone="gold" icon="ban" label="Lượt vắng mặt"
          value={fmtNum(customerStats.noShowCount)} note="Tổng số lịch khách không đến" />
        <StatTile tone="lavender" icon="schedule" label="Lịch hoàn thành"
          value={fmtNum(customerStats.completedCount)} note="Dịch vụ đã hoàn thành" />
      </div>

      <Panel>
        <SectionHeading
          icon={<Icon name="customers" />}
          title="Danh sách khách hàng"
          subtitle={filtering || sort !== 'newest'
            ? `Hiển thị ${rows.length} trong tổng số ${customers.length} khách hàng`
            : `${rows.length} khách hàng`}
        />

        <div className="adm-tools adm-cs-tools">
          <div className="search">
            <span aria-hidden="true">⌕</span>
            <input
              aria-label="Tìm khách hàng"
              placeholder="Tìm theo tên, số điện thoại hoặc email…"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
            />
          </div>

          <select aria-label="Lọc trạng thái tài khoản" value={status}
            onChange={(e) => setStatus(e.target.value)}>
            <option value="">Tất cả trạng thái</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>

          <select aria-label="Sắp xếp" value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}>
            {SORTS.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
          </select>

          <button className="button secondary" disabled={!filtering} onClick={reset}>
            <Icon name="refresh" /> Đặt lại
          </button>
        </div>

        {rows.length === 0 ? (
          <EmptyState title="Không tìm thấy khách hàng"
            detail={filtering
              ? 'Không có khách nào khớp với điều kiện đang lọc.'
              : 'Chưa có khách hàng nào trong hệ thống.'}>
            {filtering && <button className="button secondary" onClick={reset}>Đặt lại bộ lọc</button>}
          </EmptyState>
        ) : (
          <>
            <div className="table-scroll">
              <table className="adm-table adm-table-customer">
                <thead>
                  <tr>
                    <th className="adm-cs-stt">STT</th>
                    <th>Khách hàng</th>
                    <th>Liên hệ</th>
                    <th className="adm-cs-num">Tổng lịch</th>
                    <th className="adm-cs-num">Hoàn thành</th>
                    <th className="adm-cs-num">Đã hủy</th>
                    <th className="adm-cs-num">No-show</th>
                    <th className="adm-cs-num">Tổng chi tiêu</th>
                    <th>Trạng thái</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((customer, index) => (
                    <tr key={customer.id} className="adm-cs-row"
                      onClick={() => openCustomerDetail(customer.id)}>
                      <td className="adm-cs-stt">{(page - 1) * size + index + 1}</td>

                      <td>
                        <span className="adm-cell-name">
                          <Avatar name={customer.name} url={customer.avatarUrl} size={32} />
                          <span style={{ minWidth: 0 }}>
                            <strong>{customer.name}</strong>
                            <small>{customer.code}</small>
                          </span>
                        </span>
                      </td>

                      <td>
                        <strong>{customer.phone}</strong>
                        <small>{customer.email ?? '—'}</small>
                      </td>

                      <td className="adm-cs-num">{fmtNum(customer.bookingCount)}</td>
                      <td className="adm-cs-num">{fmtNum(customer.completedCount)}</td>
                      <td className="adm-cs-num">{fmtNum(customer.cancelledCount)}</td>
                      <td className="adm-cs-num">
                        {customer.noShowCount > 0
                          ? <span className="badge cancelled"><i />{customer.noShowCount}</span>
                          : <span className="adm-none">0</span>}
                      </td>

                      <td className="adm-cs-num">
                        <strong>{formatVND(customer.totalSpending)}</strong>
                        {customer.paidCount > 0 && (
                          <small>{customer.paidCount} giao dịch đã trả</small>
                        )}
                      </td>

                      <td>
                        <span className={`badge ${customer.status === 'ACTIVE' ? 'completed' : 'cancelled'}`}>
                          <i />{customer.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                        </span>
                      </td>

                      <td>
                        {/* Menu chỉ có "Xem chi tiết": không cho xóa khách,
                            và không có nút thêm khách vì khách tự đăng ký. */}
                        <button className="adm-icon-btn" aria-label={`Xem chi tiết ${customer.name}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            openCustomerDetail(customer.id);
                          }}>
                          <Icon name="settings" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="adm-cs-foot">
              <span>
                {rows.length === 0
                  ? '0 khách hàng'
                  : `${(page - 1) * size + 1}–${Math.min(page * size, rows.length)} trong ${rows.length} khách hàng`}
              </span>

              <div className="adm-cs-pager">
                <select aria-label="Số dòng mỗi trang" value={size}
                  onChange={(e) => setSize(Number(e.target.value))}>
                  {SIZES.map((n) => <option key={n} value={n}>{n} / trang</option>)}
                </select>

                <button className="adm-icon-btn" disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)} aria-label="Trang trước">‹</button>

                {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                  <button key={n} className={n === page ? 'is-on' : ''}
                    onClick={() => setPage(n)} aria-current={n === page ? 'page' : undefined}>
                    {n}
                  </button>
                ))}

                <button className="adm-icon-btn" disabled={page === totalPages}
                  onClick={() => setPage((p) => p + 1)} aria-label="Trang sau">›</button>
              </div>
            </div>
          </>
        )}
      </Panel>
    </>
  );
}
