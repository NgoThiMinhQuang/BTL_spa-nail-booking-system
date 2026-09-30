/* ===== Hộp thoại thêm / sửa dịch vụ =====
   Dùng chung cho nút "+ Thêm dịch vụ" ở đầu trang và cho menu ⋮ trên thẻ.
   Kiểm tra ở trình duyệt để báo lỗi ngay, server vẫn kiểm tra lại. */

import { useEffect, useState } from 'react';
import { Icon } from './Icon';
import { apiRequest } from '../store';
import { fmtNum, safeImage } from '../lib/utils';
import type { ServiceItem, ServiceStatus } from '../types';

const MAX_NAME = 150;
const MAX_DESCRIPTION = 2000;

const EMPTY = {
  name: '', description: '', image: '', price: '', duration: '', status: 'ACTIVE' as ServiceStatus, categoryId: '',
};

type Draft = typeof EMPTY;

const toDraft = (s: ServiceItem): Draft => ({
  name: s.name,
  description: s.description ?? '',
  image: s.image ?? '',
  price: String(s.price ?? ''),
  duration: String(s.duration ?? ''),
  status: s.status,
  categoryId: s.categoryId ? String(s.categoryId) : '',
});

function validate(draft: Draft): string {
  const name = draft.name.trim();
  if (name.length < 2) return 'Tên dịch vụ cần ít nhất 2 ký tự.';
  if (name.length > MAX_NAME) return `Tên dịch vụ tối đa ${MAX_NAME} ký tự.`;
  if (draft.description.trim().length > MAX_DESCRIPTION) return `Mô tả tối đa ${MAX_DESCRIPTION} ký tự.`;

  const price = Number(draft.price);
  if (draft.price.trim() === '' || !Number.isFinite(price) || price < 0) return 'Giá phải là số không nhỏ hơn 0.';

  const duration = Number(draft.duration);
  if (!Number.isInteger(duration) || duration < 5 || duration > 600) {
    return 'Thời lượng phải là số phút từ 5 đến 600.';
  }
  if (draft.image.trim() && !safeImage(draft.image.trim())) {
    return 'Ảnh phải là đường dẫn trong /uploads hoặc đường dẫn http(s).';
  }
  return '';
}

export function ServiceDialog({
  service, staffId, onClose, onSaved,
}: {
  /** null = thêm mới, có đối tượng = sửa dịch vụ đó. */
  service: ServiceItem | null;
  staffId: string;
  onClose: () => void;
  onSaved: (service: ServiceItem) => void;
}) {
  const [draft, setDraft] = useState<Draft>(() => (service ? toDraft(service) : EMPTY));
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const editing = Boolean(service);

  useEffect(() => {
    let alive = true;
    apiRequest<{ id: number; name: string }[]>('/api/staff/services/categories')
      .then((data) => { if (alive) setCategories(data); })
      /* Danh mục chỉ phục vụ ô chọn — hỏi lỗi thì để trống cũng dùng được. */
      .catch(() => { if (alive) setCategories([]); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
    setError('');
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;
    const invalid = validate(draft);
    if (invalid) { setError(invalid); return; }

    const body = {
      staffId,
      name: draft.name.trim(),
      description: draft.description.trim(),
      image: draft.image.trim(),
      price: Number(draft.price),
      duration: Number(draft.duration),
      status: draft.status,
      categoryId: draft.categoryId === '' ? null : Number(draft.categoryId),
    };

    setSaving(true);
    setError('');
    try {
      const data = await apiRequest<ServiceItem>(
        editing ? `/api/staff/services/${service!.id}` : '/api/staff/services',
        {
          method: editing ? 'PUT' : 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        },
      );
      onSaved({ ...data, name: body.name, description: body.description || null, image: body.image || null });
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const preview = safeImage(draft.image.trim());

  return (
    <div className="svc-dialog-backdrop" onClick={onClose}>
      <form
        className="svc-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="svc-dialog-title"
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
      >
        <div className="svc-dialog-head">
          <span className="svc-dialog-mark"><Icon name="services" /></span>
          <div>
            <h2 id="svc-dialog-title">{editing ? 'Sửa dịch vụ' : 'Thêm dịch vụ'}</h2>
            <p>{editing ? 'Cập nhật thông tin khách hàng nhìn thấy khi đặt lịch.' : 'Dịch vụ mới sẽ vào danh sách của bạn ngay.'}</p>
          </div>
        </div>

        <div className="svc-dialog-body">
          <label className="svc-field svc-field-wide">
            <span>Tên dịch vụ</span>
            <input
              value={draft.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="Ví dụ: Sơn gel cao cấp"
              maxLength={MAX_NAME}
              autoFocus
              required
            />
          </label>

          <label className="svc-field">
            <span>Giá (đồng)</span>
            <input
              value={draft.price}
              onChange={(e) => set('price', e.target.value)}
              inputMode="numeric"
              placeholder="200000"
              required
            />
          </label>

          <label className="svc-field">
            <span>Thời lượng (phút)</span>
            <input
              value={draft.duration}
              onChange={(e) => set('duration', e.target.value)}
              inputMode="numeric"
              placeholder="60"
              required
            />
          </label>

          <label className="svc-field">
            <span>Danh mục</span>
            <select value={draft.categoryId} onChange={(e) => set('categoryId', e.target.value)}>
              <option value="">Chưa phân loại</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>

          <label className="svc-field">
            <span>Trạng thái</span>
            <select
              value={draft.status}
              onChange={(e) => set('status', e.target.value as ServiceStatus)}
            >
              <option value="ACTIVE">Đang cung cấp</option>
              <option value="HIDDEN">Tạm ngưng</option>
            </select>
          </label>

          <label className="svc-field svc-field-wide">
            <span>Ảnh dịch vụ</span>
            <input
              value={draft.image}
              onChange={(e) => set('image', e.target.value)}
              placeholder="/uploads/services/son-gel.jpg hoặc https://…"
            />
          </label>

          {preview && (
            <div className="svc-preview">
              <img src={preview} alt="" />
              <span>Xem trước ảnh</span>
            </div>
          )}

          <label className="svc-field svc-field-wide">
            <span>Mô tả ngắn</span>
            <textarea
              value={draft.description}
              onChange={(e) => set('description', e.target.value)}
              rows={3}
              maxLength={MAX_DESCRIPTION}
              placeholder="Dịch vụ gồm những bước gì, dành cho ai…"
            />
            <small>{fmtNum(draft.description.trim().length)}/{fmtNum(MAX_DESCRIPTION)} ký tự</small>
          </label>
        </div>

        <p className="svc-dialog-error" role="alert">{error}</p>

        <div className="svc-dialog-foot">
          <button type="button" className="button secondary" onClick={onClose} disabled={saving}>
            Huỷ
          </button>
          <button type="submit" className="button" disabled={saving}>
            {saving ? 'Đang lưu…' : editing ? 'Lưu thay đổi' : 'Thêm dịch vụ'}
          </button>
        </div>
      </form>
    </div>
  );
}
