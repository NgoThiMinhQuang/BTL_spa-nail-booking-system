/* ===== Luồng trạng thái của một lịch hẹn =====

   Hiển thị vị trí hiện tại của lịch trong chuỗi:
   Đặt lịch → Xác nhận → Đang thực hiện → Hoàn thành.

   Lịch bị hủy hoặc khách không đến thì không đi theo chuỗi chính, vì vậy hiện
   một nhánh riêng cho hai trường hợp đó thay vì vẽ bốn bước rồi tắt dấu ở
   giữa — như vậy nhìn một lần là biết lịch đi đến đâu và dừng vì lý do gì. */

import { Icon } from './Icon';

const FLOW = [
  { key: 'PENDING', label: 'Đặt lịch' },
  { key: 'CONFIRMED', label: 'Xác nhận' },
  { key: 'PROCESSING', label: 'Đang thực hiện' },
  { key: 'COMPLETED', label: 'Hoàn thành' },
];

const STOP: Record<string, { key: string; label: string; hint: string }> = {
  CANCELLED: { key: 'CANCELLED', label: 'Đã hủy', hint: 'Lịch không còn được thực hiện.' },
  NO_SHOW: { key: 'NO_SHOW', label: 'Không đến', hint: 'Khách không đến lịch hẹn.' },
};

export function BookingStatusFlow({ status }: { status: string }) {
  const stop = STOP[status];

  if (stop) {
    /* Vị trí dừng: những bước đã đi qua trước khi lịch bị cắt ngang. */
    const reached = status === 'NO_SHOW' ? 2 : 2;
    return (
      <ol className="adm-flow is-stopped">
        {FLOW.slice(0, reached).map((step) => (
          <li key={step.key} className="is-done">
            <span className="adm-flow-dot"><Icon name="check" /></span>
            <span>{step.label}</span>
          </li>
        ))}
        <li className="is-stop">
          <span className="adm-flow-dot"><Icon name="ban" /></span>
          <span>
            {stop.label}
            <small>{stop.hint}</small>
          </span>
        </li>
      </ol>
    );
  }

  const current = FLOW.findIndex((step) => step.key === status);

  return (
    <ol className="adm-flow">
      {FLOW.map((step, index) => (
        <li key={step.key}
          className={index < current ? 'is-done' : index === current ? 'is-now' : ''}>
          <span className="adm-flow-dot">
            {index < current ? <Icon name="check" /> : <i>{index + 1}</i>}
          </span>
          <span>{step.label}</span>
        </li>
      ))}
    </ol>
  );
}
