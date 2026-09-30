/* ===== Ảnh mẫu khách gửi kèm lịch hẹn =====

   Khách chụp móng rồi gửi lên lúc đặt; nhân viên cần xem trước khi bắt đầu
   nên ảnh phải phóng to được. Bấm vào ảnh để mở khung xem; bấm nền hoặc
   phím Esc để đóng, và có thể chuyển ảnh bằng hai nút. */

import { useEffect, useState } from 'react';
import { Icon } from './Icon';
import { safeImage } from '../lib/utils';

export function ReferenceImages({
  images, onRemove,
}: {
  images: { id: string; url: string }[];
  /** Không truyền vào thì không hiện nút xoá — dùng cho lịch không cho sửa ảnh. */
  onRemove?: (id: string) => void;
}) {
  const [open, setOpen] = useState<number | null>(null);

  /* Đóng khung xem khi bấm phím Esc. */
  useEffect(() => {
    if (open == null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(null);
      if (event.key === 'ArrowRight') setOpen((i) => (i == null ? null : (i + 1) % images.length));
      if (event.key === 'ArrowLeft') {
        setOpen((i) => (i == null ? null : (i - 1 + images.length) % images.length));
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, images.length]);

  if (images.length === 0) {
    return <p className="adm-field-note">Khách hàng không gửi ảnh mẫu.</p>;
  }

  const step = (delta: number) => setOpen((i) => (
    i == null ? null : (i + delta + images.length) % images.length
  ));

  return (
    <>
      <div className="adm-shots">
        {images.map((image, index) => (
          <figure key={image.id}>
            <button onClick={() => setOpen(index)} aria-label={`Xem ảnh mẫu ${index + 1}`}>
              <img src={safeImage(image.url)} alt={`Ảnh mẫu ${index + 1}`} loading="lazy" />
            </button>
            {onRemove && (
              <button className="adm-icon-btn adm-shots-del" aria-label="Bỏ ảnh này"
                onClick={() => onRemove(image.id)}>
                <Icon name="trash" />
              </button>
            )}
          </figure>
        ))}
      </div>

      {open != null && (
        <div className="adm-modal-backdrop" role="dialog" aria-modal="true"
          onClick={() => setOpen(null)}>
          <div className="adm-shot-view" onClick={(e) => e.stopPropagation()}>
            <img src={safeImage(images[open].url)} alt={`Ảnh mẫu ${open + 1}`} />
            <p>Ảnh mẫu {open + 1} / {images.length}</p>
            {images.length > 1 && (
              <>
                <button className="adm-icon-btn adm-shot-nav is-prev"
                  onClick={() => step(-1)} aria-label="Ảnh trước">
                  <Icon name="chevronDown" />
                </button>
                <button className="adm-icon-btn adm-shot-nav is-next"
                  onClick={() => step(1)} aria-label="Ảnh sau">
                  <Icon name="chevronDown" />
                </button>
              </>
            )}
            <button className="adm-icon-btn adm-shot-close" onClick={() => setOpen(null)}
              aria-label="Đóng">
              <Icon name="ban" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
