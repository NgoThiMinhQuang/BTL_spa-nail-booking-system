/* ===== Trang Yêu cầu nghỉ =====
   Database chưa có bảng yêu cầu nghỉ riêng; nhân viên nghỉ được ghi bằng
   staff_schedule.status = 'OFF'. Trang này đọc đúng những dòng đó và làm rõ
   điều đó ở phần phụ đề để không ai hiểu nhầm là dữ liệu khác. */

import { useState } from 'react';
import { Icon } from '../components/Icon';
import { EmptyState, Panel, SectionHeading, StatTile } from '../components/Primitives';
import { useApp, today } from '../store';
import { fmtDay, weekdayShort } from '../lib/utils';

export function AdminLeavePage() {
  const { state } = useApp();
  const { leave } = state;

  const [scope, setScope] = useState<'upcoming' | 'all'>('upcoming');

  const day = today();
  const rows = leave
    .filter((item) => (scope === 'upcoming' ? item.workDate >= day : true))
    .sort((a, b) => a.workDate.localeCompare(b.workDate));

  const todayCount = leave.filter((item) => item.workDate === day).length;
  const affected = leave
    .filter((item) => item.workDate >= day)
    .reduce((sum, item) => sum + item.affectedBookings, 0);

  return (
    <>
      <div className="adm-tiles adm-tiles-4">
        <StatTile tone="rose" icon="pause" label="Nghỉ hôm nay" value={todayCount}
          note={todayCount > 0 ? 'cần bố trí người thay' : 'ai cũng đang làm'} />
        <StatTile tone="gold" icon="calendar" label="Nghỉ sắp tới" value={rows.length}
          note="từ hôm nay trở đi" />
        <StatTile tone="lavender" icon="schedule" label="Lịch bị ảnh hưởng" value={affected}
          note="khách đang chờ trong ca nghỉ" />
        <StatTile tone="sage" icon="adminStaff" label="Tổng số ngày nghỉ" value={leave.length}
          note="toàn bộ lịch sử" />
      </div>

      <Panel>
        <SectionHeading
          icon={<Icon name="pause" />}
          title="Yêu cầu nghỉ"
          subtitle="Nguồn: staff_schedule có trạng thái OFF — chưa có bảng yêu cầu riêng"
        >
          <div className="mode-tabs">
            <button className={scope === 'upcoming' ? 'active' : ''}
              onClick={() => setScope('upcoming')}>Sắp tới</button>
            <button className={scope === 'all' ? 'active' : ''}
              onClick={() => setScope('all')}>Tất cả</button>
          </div>
        </SectionHeading>

        {rows.length === 0 ? (
          <EmptyState
            title={scope === 'upcoming' ? 'Không có ai nghỉ sắp tới' : 'Chưa có ngày nghỉ nào'}
            detail="Nhân viên nghỉ sẽ hiện ở đây khi ca được xếp trạng thái OFF."
          />
        ) : (
          <div className="table-scroll">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Ngày</th><th>Thứ</th><th>Nhân viên</th>
                  <th>Chuyên môn</th><th>Lịch bị ảnh hưởng</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{fmtDay(item.workDate)}</strong>
                      {item.workDate === day && <small>Hôm nay</small>}
                    </td>
                    <td>{weekdayShort(item.workDate)}</td>
                    <td><strong>{item.staffName}</strong></td>
                    <td>{item.specialty ?? <span className="adm-none">—</span>}</td>
                    <td>
                      {item.affectedBookings > 0
                        ? <span className="badge cancelled"><i />{item.affectedBookings} lịch cần đổi</span>
                        : <span className="badge completed"><i />Không ảnh hưởng</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <p className="app-note">
        Muốn cho nhân viên nghỉ, vào trang <strong>Lịch làm việc</strong> và đổi trạng thái ca
        sang Nghỉ. Trang này chỉ đọc, chưa có nút duyệt/từ chối.
      </p>
    </>
  );
}
