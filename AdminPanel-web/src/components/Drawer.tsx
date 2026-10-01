/* ===== Khung trượt từ bên phải =====

   Dùng cho kiểu "bấm vào dòng thì xem chi tiết mà vẫn giữ nguyên danh
   sách": danh sách ở lại bên trái bị làm mờ, khung chi tiết trượt ra từ
   mép phải. Đây là cách làm quen thuộc nên người dùng không phải học mới.

   Ba điều dễ làm hỏng và đã xử lý ở đây:
     - Bấm phím Esc phải đóng được.
     - Khi mở thì trang không được cuộn theo nền.
     - Khi khung mở thì nút đóng phải nhận được phím Tab trước, để người
       dùng bàn phím không bị rơi vào nội dung bị che. */

import { useEffect, useRef, type ReactNode } from 'react';
import { Icon } from './Icon';

export function Drawer({
  title, subtitle, onClose, children, footer, width = 520,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  /** Thanh nút cố định ở đáy khung; không truyền thì không có. */
  footer?: ReactNode;
  /** Bề rộng trên màn hình rộng. Hẹp hơn thì tự co theo màn hình. */
  width?: number;
}) {
  const closeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);

    /* Khoá cuộn nền, đồng thời bù lại bề rộng thanh cuộn để trang
       không bị nhảy sang trái khi khung mở. */
    const gap = window.innerWidth - document.documentElement.clientWidth;
    const body = document.body.style.overflow;
    const padding = document.body.style.paddingRight;
    document.body.style.overflow = 'hidden';
    if (gap > 0) document.body.style.paddingRight = `${gap}px`;
    closeRef.current?.focus();

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = body;
      document.body.style.paddingRight = padding;
    };
  }, [onClose]);

  return (
    <div className="adm-drawer-root">
      <div className="adm-drawer-mask" onClick={onClose} />
      <div
        className="adm-drawer"
        /* min() thay vì width cố định: trên máy tính bảng khung bám sát mép
           phải thay vì chiếm gần hết màn hình, còn trên điện thoại thì tràn
           hết chiều ngang — đúng như cách các ứng dụng di động hay làm. */
        style={{ width: `min(${width}px, 86vw)` }}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header className="adm-drawer-head">
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button className="adm-drawer-x" onClick={onClose} aria-label="Đóng" ref={closeRef}>
            <Icon name="ban" />
          </button>
        </header>

        <div className="adm-drawer-body">{children}</div>

        {footer && <footer className="adm-drawer-foot">{footer}</footer>}
      </div>
    </div>
  );
}
