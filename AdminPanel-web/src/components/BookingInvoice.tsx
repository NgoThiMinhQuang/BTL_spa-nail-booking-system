/* ===== Hóa đơn thanh toán (in ấn) =====
   Mọi số trên hóa đơn đều là dữ liệu thật của lịch: dịch vụ chính +
   add-on kèm snapshot giá, tổng, tiền đã thu và hình thức trả.
   Thông tin cửa hàng KHÔNG bịa: điền vào SHOP_INFO bên dưới (địa chỉ,
   hotline thật), để trống thì hóa đơn tự ẩn dòng đó. */

import { fmtDate, fmtTime, formatVND } from '../lib/utils';

/** Điền thông tin thật của cửa hàng vào đây để hiện lên hóa đơn. */
export const SHOP_INFO: { address: string; hotline: string } = {
  address: '',
  hotline: '',
};

export interface InvoiceData {
  code: string;
  startsAt: string;
  customerName: string;
  customerPhone: string;
  staffName: string | null;
  serviceName: string;
  duration: number;
  price: number;
  addons: { id: string; name: string; quantity: number; price: number }[];
  addonTotal: number;
  total: number;
  paidAmount: number | null;
  paymentText: string | null;
  methodText: string | null;
  paymentDate: string | null;
}

export function BookingInvoice({ data }: { data: InvoiceData }) {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const printedAt =
    `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} `
    + `${pad(now.getHours())}:${pad(now.getMinutes())}`;

  return (
    <div className="invoice-sheet">
      <div className="invoice-head">
        <div>
          <strong className="invoice-brand">NailHouse Studio</strong>
          <small>BEAUTY NAILS · BETTER YOU</small>
          {SHOP_INFO.address && <small>{SHOP_INFO.address}</small>}
          {SHOP_INFO.hotline && <small>Hotline: {SHOP_INFO.hotline}</small>}
        </div>
        <div className="invoice-title">
          <h2>HÓA ĐƠN THANH TOÁN</h2>
          <span>{data.code}</span>
        </div>
      </div>

      <dl className="invoice-meta">
        <div><dt>Khách hàng</dt><dd>{data.customerName} · {data.customerPhone}</dd></div>
        <div><dt>Ngày làm</dt><dd>{fmtDate(data.startsAt)} · {fmtTime(data.startsAt)}</dd></div>
        <div><dt>Nhân viên</dt><dd>{data.staffName ?? '—'}</dd></div>
        {data.paymentDate && (
          <div><dt>Ngày thu tiền</dt><dd>{fmtDate(data.paymentDate)} {fmtTime(data.paymentDate)}</dd></div>
        )}
      </dl>

      <table className="invoice-table">
        <thead>
          <tr><th className="adm-stt">STT</th><th>Dịch vụ</th><th>SL</th><th>Đơn giá</th><th>Thành tiền</th></tr>
        </thead>
        <tbody>
          <tr>
            <td className="adm-stt">1</td>
            <td>{data.serviceName}<small> · {data.duration} phút</small></td>
            <td>1</td>
            <td>{formatVND(data.price)}</td>
            <td>{formatVND(data.price)}</td>
          </tr>
          {data.addons.map((addon, index) => (
            <tr key={addon.id}>
              <td className="adm-stt">{index + 2}</td>
              <td>{addon.name}</td>
              <td>{addon.quantity}</td>
              <td>{formatVND(addon.price)}</td>
              <td>{formatVND(addon.price * addon.quantity)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <dl className="invoice-total">
        <div><dt>Tổng cộng</dt><dd>{formatVND(data.total)}</dd></div>
        <div>
          <dt>Đã thu{data.methodText ? ` (${data.methodText})` : ''}</dt>
          <dd>{formatVND(data.paidAmount ?? 0)}</dd>
        </div>
      </dl>

      <p className="invoice-foot">
        Cảm ơn quý khách đã tin tưởng NailHouse!
        <small> In lúc {printedAt}</small>
      </p>
    </div>
  );
}
