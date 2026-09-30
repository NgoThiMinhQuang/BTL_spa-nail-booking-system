/* ===== Trang Lịch làm việc của quản trị =====
   Ma trận tuần: mỗi dòng một nhân viên, mỗi cột một ngày. Màu ô lấy từ bảng màu
   sage / hồng của theme.css nên khớp phần lịch cá nhân trong app nhân viên. */

import { Icon } from '../components/Icon';
import { Panel, SectionHeading } from '../components/Primitives';

type CellType = 'SHIFT' | 'TIME_OFF' | 'DAY_OFF';

interface ScheduleCell {
  type: CellType;
  shift?: string;
  lunch?: string;
  reason?: string;
}

const WEEK = [
  {
    name: 'Emma Wilson', code: 'NV-001',
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&q=80&w=100&h=100',
    schedule: [
      { type: 'SHIFT', shift: '08:00 – 17:00', lunch: '12:00 – 13:00' },
      { type: 'SHIFT', shift: '08:00 – 17:00', lunch: '12:00 – 13:00' },
      { type: 'SHIFT', shift: '08:00 – 17:00', lunch: '12:00 – 13:00' },
      { type: 'TIME_OFF', reason: 'Nghỉ ốm' },
      { type: 'SHIFT', shift: '08:00 – 17:00', lunch: '12:00 – 13:00' },
      { type: 'SHIFT', shift: '09:00 – 14:00' },
      { type: 'DAY_OFF' },
    ] as ScheduleCell[],
  },
  {
    name: 'Olivia Chen', code: 'NV-002',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=100&h=100',
    schedule: [
      { type: 'SHIFT', shift: '11:00 – 20:00', lunch: '15:00 – 16:00' },
      { type: 'SHIFT', shift: '11:00 – 20:00', lunch: '15:00 – 16:00' },
      { type: 'DAY_OFF' },
      { type: 'SHIFT', shift: '11:00 – 20:00', lunch: '15:00 – 16:00' },
      { type: 'SHIFT', shift: '11:00 – 20:00', lunch: '15:00 – 16:00' },
      { type: 'SHIFT', shift: '08:00 – 17:00', lunch: '12:00 – 13:00' },
      { type: 'SHIFT', shift: '09:00 – 14:00' },
    ] as ScheduleCell[],
  },
  {
    name: 'Mia Brooks', code: 'NV-003',
    avatar: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?auto=format&fit=crop&q=80&w=100&h=100',
    schedule: [
      { type: 'SHIFT', shift: '08:00 – 17:00', lunch: '12:00 – 13:00' },
      { type: 'DAY_OFF' },
      { type: 'SHIFT', shift: '08:00 – 17:00', lunch: '12:00 – 13:00' },
      { type: 'SHIFT', shift: '08:00 – 17:00', lunch: '12:00 – 13:00' },
      { type: 'SHIFT', shift: '08:00 – 17:00', lunch: '12:00 – 13:00' },
      { type: 'SHIFT', shift: '11:00 – 20:00', lunch: '15:00 – 16:00' },
      { type: 'DAY_OFF' },
    ] as ScheduleCell[],
  },
];

const DAYS = [
  { day: 'T2', date: '28' }, { day: 'T3', date: '29' }, { day: 'T4', date: '30' },
  { day: 'T5', date: '01' }, { day: 'T6', date: '02' }, { day: 'T7', date: '03' },
  { day: 'CN', date: '04' },
];

function Cell({ cell }: { cell: ScheduleCell }) {
  if (cell.type === 'DAY_OFF') return <div className="adm-cell is-off">Nghỉ</div>;

  if (cell.type === 'TIME_OFF') {
    return (
      <div className="adm-cell is-leave">
        <strong>Xin nghỉ</strong>
        <small>{cell.reason}</small>
      </div>
    );
  }

  return (
    <div className="adm-cell is-shift">
      <div>
        <strong>Ca làm</strong>
        <small>{cell.shift}</small>
      </div>
      {cell.lunch && (
        <div>
          <strong style={{ fontWeight: 400 }}>Nghỉ trưa</strong>
          <small>{cell.lunch}</small>
        </div>
      )}
    </div>
  );
}

export function AdminWorkSchedulePage() {
  const shifts = WEEK.reduce(
    (sum, w) => sum + w.schedule.filter((c) => c.type === 'SHIFT').length, 0);
  const leaves = WEEK.reduce(
    (sum, w) => sum + w.schedule.filter((c) => c.type === 'TIME_OFF').length, 0);

  return (
    <>
      <Panel>
        <SectionHeading
          icon={<Icon name="clock" />}
          title="Lịch làm việc trong tuần"
          subtitle="28 thg 9 – 4 thg 10, 2026"
        >
          <div className="adm-legend" style={{ margin: 0 }}>
            <span><i style={{ background: 'var(--nh-sage)' }} />Ca làm</span>
            <span><i style={{ background: '#D9CFD6' }} />Nghỉ trưa</span>
            <span><i style={{ background: 'var(--nh-primary-dark)' }} />Xin nghỉ</span>
          </div>
        </SectionHeading>

        <div className="adm-tools">
          <button className="button secondary">
            <Icon name="chevronDown" /> <span>Tất cả nhân viên</span>
          </button>
          <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--nh-muted)' }}>
            {shifts} ca làm · {leaves} ngày xin nghỉ
          </span>
        </div>

        <div className="table-scroll">
          <table className="adm-week">
            <thead>
              <tr>
                <th>Nhân viên</th>
                {DAYS.map((d) => (
                  <th key={d.day}>{d.day}<small>{d.date}</small></th>
                ))}
              </tr>
            </thead>
            <tbody>
              {WEEK.map((row) => (
                <tr key={row.code}>
                  <th scope="row">
                    <span className="adm-cell-name">
                      <img className="adm-thumb" src={row.avatar} alt="" loading="lazy"
                        style={{ borderRadius: '50%' }} />
                      <span style={{ minWidth: 0 }}>
                        <strong>{row.name}</strong>
                        <small>{row.code}</small>
                      </span>
                    </span>
                  </th>
                  {row.schedule.map((cell, i) => (
                    <td key={i}><Cell cell={cell} /></td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}