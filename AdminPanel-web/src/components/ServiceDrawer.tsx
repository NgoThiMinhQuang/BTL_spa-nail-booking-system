/* ===== Khung dịch vụ trượt từ bên phải =====

   Giống trang Khách hàng: bấm vào dòng thì xem chi tiết mà vẫn giữ nguyên
   danh sách phía sau. Trong cùng một khung xem được đầy đủ thông tin
   (ảnh, giá, thời lượng, số liệu, nhân viên) và bấm Sửa để sửa ngay tại
   chỗ, không cần hộp thoại ở giữa màn hình. */

import { useEffect, useState } from 'react';
import { Drawer } from './Drawer';
import { Icon } from './Icon';
import { sendAdmin } from '../lib/admin-api';
import { fmtNum, fmtRating, formatVND, safeImage } from '../lib/utils';
import type { CategoryItem, ServiceItem } from '../store';

/** Ô số liệu nhỏ trong dải số. */
function MiniStat({ icon, value, label, tone }: {
  icon: 'services' | 'dollar' | 'star'; value: React.ReactNode; label: string;
  tone: 'rose' | 'gold' | 'sage';
}) {
  return (
    <div className={`adm-dstat is-${tone}`}>
      <Icon name={icon} />
      <strong>{value}</strong>
      <small>{label}</small>
    </div>
  );
}

/** Một dòng thông tin: biểu tượng, nhãn nhỏ, giá trị lớn. */
function Info({ icon, label, value }: {
  icon: 'dollar' | 'star' | 'services'; label: string; value: React.ReactNode;
}) {
  return (
    <div className="adm-di-row">
      <span className="adm-di-icon"><Icon name={icon} /></span>
      <span>
        <small>{label}</small>
        <strong>{value ?? 'Chưa cập nhật'}</strong>
      </span>
    </div>
  );
}

interface FormState {
  name: string; categoryId: string; price: string; duration: string;
  bufferTime: string; description: string; status: string; image: string;
}

const EMPTY_FORM: FormState = {
  name: '', categoryId: '', price: '', duration: '60',
  bufferTime: '0', description: '', status: 'ACTIVE', image: '',
};

function toForm(service: ServiceItem | null): FormState {
  if (!service) return EMPTY_FORM;
  return {
    name: service.name, categoryId: service.categoryId ?? '',
    price: String(service.price), duration: String(service.duration),
    bufferTime: String(service.bufferTime ?? 0),
    description: service.description ?? '', status: service.status,
    image: service.imageUrl ?? '',
  };
}

interface GalleryImage { id: string; imageUrl: string; sortOrder: number }

/* Bỏ host khỏi URL tuyệt đối để so sánh và lưu đường dẫn gọn trong DB. */
function toStoredPath(url: string): string {
  return url.replace(/^https?:\/\/[^/]+/i, '');
}

/* Thư viện nhiều ảnh của dịch vụ: ảnh chính nằm ở services.image (ô phía
   trên), các ảnh còn lại nằm ở service_images và hiện trong bộ sưu tập
   ở trang chi tiết dịch vụ trên app khách. */
function ServiceGallery({ serviceId, mainImage, onPickMain }: {
  serviceId: string;
  mainImage: string;
  /** Đặt một ảnh gallery làm ảnh chính (điền vào ô ảnh dịch vụ). */
  onPickMain: (path: string) => void;
}) {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [draft, setDraft] = useState('');
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    setError('');
    sendAdmin<GalleryImage[]>(`/catalog/services/${serviceId}/images`, 'GET')
      .then((result) => {
        if (cancelled) return;
        setLoaded(true);
        if (result.ok) setImages(result.data);
        else setError(result.message);
      });
    return () => { cancelled = true; };
  }, [serviceId]);

  async function addImage() {
    const text = draft.trim();
    if (!text) { setError('Dán đường dẫn ảnh trước khi thêm.'); return; }
    if (!/^https?:\/\//i.test(text) && !/^\/uploads\//.test(text)) {
      setError('Ảnh phải là đường dẫn http(s) hoặc bắt đầu bằng /uploads/.');
      return;
    }
    setWorking(true);
    setError('');
    const result = await sendAdmin<GalleryImage>(
      `/catalog/services/${serviceId}/images`, 'POST', { imageUrl: text });
    setWorking(false);
    if (!result.ok) { setError(result.message); return; }
    setImages((prev) => [...prev, result.data]);
    setDraft('');
  }

  async function deleteImage(image: GalleryImage) {
    if (!window.confirm('Xoá ảnh này khỏi thư viện dịch vụ?')) return;
    setWorking(true);
    const result = await sendAdmin(
      `/catalog/services/${serviceId}/images/${image.id}`, 'DELETE');
    setWorking(false);
    if (!result.ok) { setError(result.message); return; }
    setImages((prev) => prev.filter((item) => item.id !== image.id));
  }

  const mainPath = toStoredPath(mainImage.trim());

  return (
    <>
      {!loaded ? (
        <div className="adm-skel adm-skel-panel" />
      ) : images.length > 0 ? (
        <ul className="adm-gallery">
          {images.map((image) => {
            const isMain = mainPath !== '' && toStoredPath(image.imageUrl) === mainPath;
            return (
              <li key={image.id} className={isMain ? 'is-main' : ''}>
                <img src={safeImage(image.imageUrl)} alt="" loading="lazy" />
                {isMain && <em>Ảnh chính</em>}
                <div className="adm-gallery-actions">
                  {!isMain && (
                    <button type="button" disabled={working} title="Đặt làm ảnh chính"
                      onClick={() => onPickMain(toStoredPath(image.imageUrl))}>
                      <Icon name="star" />
                    </button>
                  )}
                  <button type="button" disabled={working} title="Xoá ảnh" aria-label="Xoá ảnh"
                    onClick={() => deleteImage(image)}>
                    <Icon name="trash" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="adm-field-note">
          Chưa có ảnh nào trong thư viện. Ảnh ở đây hiện trong bộ sưu tập
          ở trang chi tiết dịch vụ trên app khách.
        </p>
      )}
      <div className="adm-gallery-add">
        <input value={draft} onChange={(e) => setDraft(e.target.value)} disabled={working}
          placeholder="Dán link http(s) hoặc /uploads/… rồi bấm Thêm" />
        <button type="button" className="button secondary" disabled={working} onClick={addImage}>
          Thêm ảnh
        </button>
      </div>
      {error && <p className="adm-error">{error}</p>}
    </>
  );
}

/* Dải ảnh xem nhanh ở chế độ chi tiết. */
function ServiceGalleryStrip({ serviceId }: { serviceId: string }) {
  const [images, setImages] = useState<GalleryImage[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    sendAdmin<GalleryImage[]>(`/catalog/services/${serviceId}/images`, 'GET')
      .then((result) => {
        if (!cancelled && result.ok) setImages(result.data);
      });
    return () => { cancelled = true; };
  }, [serviceId]);

  if (!images || images.length === 0) return null;
  return (
    <section className="adm-dblock">
      <h4>Thư viện ảnh <em>{images.length} ảnh</em></h4>
      <div className="adm-gallery-strip">
        {images.map((image) => (
          <img key={image.id} src={safeImage(image.imageUrl)} alt="" loading="lazy" />
        ))}
      </div>
    </section>
  );
}

export function ServiceDrawer({ service, initialMode, categories, onClose, onChanged }: {
  /** null = thêm dịch vụ mới. */
  service: ServiceItem | null;
  initialMode: 'detail' | 'edit';
  categories: CategoryItem[];
  onClose: () => void;
  /** Gọi tải lại danh sách sau khi lưu / ẩn / mở / xoá. */
  onChanged: () => void;
}) {
  const [mode, setMode] = useState<'detail' | 'edit'>(service ? initialMode : 'edit');
  const [form, setForm] = useState<FormState>(() => toForm(service));
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');

  /* Mở dịch vụ khác thì quay về chế độ gọi ban đầu. */
  useEffect(() => {
    setMode(service ? initialMode : 'edit');
    setForm(toForm(service));
    setFeedback('');
  }, [service?.id, initialMode]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (key: keyof FormState) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => setForm((prev) => ({ ...prev, [key]: e.target.value }));

  function startEdit() {
    setForm(toForm(service));
    setFeedback('');
    setMode('edit');
  }

  async function submitService(e: React.FormEvent) {
    e.preventDefault();
    const image = form.image.trim();
    if (image && !/^https?:\/\//i.test(image) && !/^\/uploads\//.test(image)) {
      setFeedback('Ảnh phải là đường dẫn http(s) hoặc bắt đầu bằng /uploads/.');
      return;
    }
    setBusy(true);
    setFeedback('');
    const body = {
      name: form.name.trim(),
      categoryId: form.categoryId || null,
      price: Number(form.price),
      duration: Number(form.duration),
      bufferTime: Number(form.bufferTime) || 0,
      description: form.description.trim(),
      status: form.status,
      image: image || null,
    };
    const result = service
      ? await sendAdmin(`/catalog/services/${service.id}`, 'PUT', body)
      : await sendAdmin('/catalog/services', 'POST', body);
    setBusy(false);
    if (!result.ok) {
      setFeedback(result.message);
      return;
    }
    onChanged();
    if (service) setMode('detail');
    else onClose();
  }

  async function toggleStatus() {
    if (!service) return;
    const next = service.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    const result = await sendAdmin(`/catalog/services/${service.id}/status`, 'PATCH', { status: next });
    if (!result.ok) {
      setFeedback(result.message);
      return;
    }
    onChanged();
  }

  async function removeService() {
    if (!service) return;
    /* Backend chặn khi dịch vụ đã có lịch hoặc đang làm add-on (409) nên
       ở đây chỉ hỏi lại cho chắc, thông điệp lỗi hiện nguyên văn. */
    if (!window.confirm(`Xoá dịch vụ "${service.name}"? Dịch vụ đã có lịch hẹn thì không xoá được.`)) return;
    const result = await sendAdmin(`/catalog/services/${service.id}`, 'DELETE');
    if (!result.ok) {
      setFeedback(result.message);
      return;
    }
    onChanged();
    onClose();
  }

  /* ---- Chế độ thêm mới / sửa ---- */
  if (mode === 'edit' || !service) {
    const title = service ? `Sửa dịch vụ "${service.name}"` : 'Thêm dịch vụ mới';
    return (
      <Drawer
        title={title}
        subtitle={service ? `${service.category ?? 'Chưa phân loại'} · ${formatVND(service.price)} · ${service.duration} phút` : 'Điền thông tin rồi bấm Thêm dịch vụ'}
        onClose={onClose}
        width={560}
        footer={(
          <div className="adm-drawer-actions">
            <button className="button secondary" type="button" disabled={busy}
              onClick={() => { if (service) setMode('detail'); else onClose(); }}>
              Hủy
            </button>
            <button className="button" type="submit" form="service-edit-form" disabled={busy}>
              {busy ? 'Đang lưu…' : service ? 'Lưu thay đổi' : 'Thêm dịch vụ'}
            </button>
          </div>
        )}
      >
        {/* Dải thông tin tổng quan để khỏi phải quay ra xem. */}
        {service && (
          <div className="adm-form-note adm-service-summary">
            <span><strong>{fmtNum(service.staffCount)}</strong> nhân viên</span>
            <span><strong>{fmtNum(service.bookingCount)}</strong> lịch hẹn</span>
            <span><strong>{formatVND(service.revenue)}</strong> doanh thu</span>
            <span><strong>{service.reviewCount > 0 ? `${fmtRating(service.rating)}★` : '—'}</strong> đánh giá{service.reviewCount > 0 ? ` (${service.reviewCount})` : ''}</span>
          </div>
        )}
        <form id="service-edit-form" className="adm-form" onSubmit={submitService} style={{ marginTop: 0 }}>
          <label className="adm-field">
            <span>Tên dịch vụ</span>
            <input value={form.name} onChange={set('name')} disabled={busy}
              placeholder="Ví dụ: Sơn gel cao cấp" />
          </label>
          <label className="adm-field">
            <span>Ảnh dịch vụ</span>
            <div className="adm-image-row">
              {safeImage(form.image.trim())
                ? <img className="adm-image-preview" src={safeImage(form.image.trim())} alt="" />
                : <span className="adm-image-preview adm-thumb-blank"><Icon name="services" /></span>}
              <input value={form.image} onChange={set('image')} disabled={busy}
                placeholder="Dán link http(s) hoặc /uploads/…" />
              {form.image && (
                <button type="button" className="button secondary" disabled={busy}
                  onClick={() => setForm((prev) => ({ ...prev, image: '' }))}>
                  Xoá
                </button>
              )}
            </div>
            <small className="adm-field-note">Để trống giữ nguyên ảnh cũ. Chấp nhận link http(s) hoặc đường dẫn /uploads/.</small>
          </label>
          {service ? (
            <div className="adm-field">
              <span>Thư viện ảnh</span>
              <ServiceGallery serviceId={service.id} mainImage={form.image}
                onPickMain={(path) => setForm((prev) => ({ ...prev, image: path }))} />
              <small className="adm-field-note">
                Ô phía trên là ảnh chính (hiện ở danh sách). Bấm ngôi sao trên
                một ảnh để đặt nó làm ảnh chính, bấm thùng rác để xoá khỏi thư viện.
              </small>
            </div>
          ) : (
            <small className="adm-field-note">
              Lưu dịch vụ trước, rồi mở Sửa để thêm nhiều ảnh vào thư viện.
            </small>
          )}
          <div className="adm-form-row">
            <label className="adm-field">
              <span>Danh mục</span>
              <select value={form.categoryId} onChange={set('categoryId')} disabled={busy}>
                <option value="">— Chưa phân loại —</option>
                {categories.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
            </label>
            <label className="adm-field">
              <span>Trạng thái</span>
              <select value={form.status} onChange={set('status')} disabled={busy}>
                <option value="ACTIVE">Đang mở bán</option>
                <option value="INACTIVE">Tạm ẩn</option>
              </select>
            </label>
          </div>
          <div className="adm-form-row">
            <label className="adm-field">
              <span>Giá (đ)</span>
              <input value={form.price} onChange={set('price')} disabled={busy}
                inputMode="numeric" placeholder="Ví dụ: 200000" />
            </label>
            <label className="adm-field">
              <span>Thời lượng (phút)</span>
              <input value={form.duration} onChange={set('duration')} disabled={busy}
                inputMode="numeric" />
            </label>
          </div>
          <label className="adm-field">
            <span>Nghỉ sau dịch vụ (phút)</span>
            <input value={form.bufferTime} onChange={set('bufferTime')} disabled={busy}
              inputMode="numeric" />
          </label>
          <label className="adm-field">
            <span>Mô tả</span>
            <textarea value={form.description} onChange={set('description')} disabled={busy}
              rows={4} placeholder="Mô tả ngắn cho khách xem…" />
          </label>
          {feedback && <p className="adm-error">{feedback}</p>}
        </form>
      </Drawer>
    );
  }

  /* ---- Chế độ xem chi tiết ---- */
  return (
    <Drawer
      title={service.name}
      subtitle={`${service.category ?? 'Chưa phân loại'} · ${formatVND(service.price)} · ${service.duration} phút`}
      onClose={onClose}
      width={560}
      footer={(
        <div className="adm-drawer-actions" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
          <button className="button secondary" onClick={onClose}>Đóng</button>
          <button className="button secondary" onClick={startEdit}>Sửa</button>
          <button className="button secondary" onClick={toggleStatus}>
            {service.status === 'ACTIVE' ? 'Tạm ẩn' : 'Mở bán'}
          </button>
          <button className="button secondary" onClick={removeService}>Xoá</button>
        </div>
      )}
    >
      {/* Ảnh + tên + nhãn */}
      <div className="adm-dprofile">
        {safeImage(service.imageUrl)
          ? <img src={safeImage(service.imageUrl)} alt="" style={{ width: 58, height: 58, borderRadius: 12, objectFit: 'cover', flex: '0 0 58px' }} />
          : <span className="adm-thumb adm-thumb-blank" style={{ width: 58, height: 58, flex: '0 0 58px' }}><Icon name="services" /></span>}
        <div className="adm-dprofile-copy">
          <h3>{service.name}</h3>
          <p>{formatVND(service.price)}{service.bufferTime > 0 ? ` · nghỉ ${service.bufferTime}′ sau giờ làm` : ''}</p>
          <div className="adm-dprofile-tags">
            <span className={`badge ${service.status === 'ACTIVE' ? 'completed' : 'cancelled'}`}>
              <i />{service.status === 'ACTIVE' ? 'Đang mở' : 'Tạm ẩn'}
            </span>
            {service.category && <span className="adm-tag">{service.category}</span>}
          </div>
        </div>
      </div>

      {/* Dải số */}
      <div className="adm-dstats">
        <MiniStat tone="rose" icon="services" value={fmtNum(service.bookingCount)} label="Lịch hẹn" />
        <MiniStat tone="gold" icon="dollar" value={formatVND(service.revenue)} label="Doanh thu" />
        <MiniStat tone="sage" icon="star"
          value={service.reviewCount > 0 ? `${fmtRating(service.rating)}★` : '—'} label={`${service.reviewCount} đánh giá`} />
      </div>

      {/* Thông tin dịch vụ */}
      <section className="adm-dblock">
        <h4>Thông tin dịch vụ</h4>
        <div className="adm-dinfo">
          <Info icon="dollar" label="Giá mỗi buổi" value={formatVND(service.price)} />
          <Info icon="services" label="Thời lượng" value={`${service.duration} phút${service.bufferTime > 0 ? ` + ${service.bufferTime} phút nghỉ` : ''}`} />
          <Info icon="star" label="Nhân viên thực hiện" value={`${service.staffCount} người`} />
        </div>
      </section>

      {service.description && (
        <section className="adm-dblock">
          <h4>Mô tả</h4>
          <p className="adm-walkin-note">{service.description}</p>
        </section>
      )}

      <ServiceGalleryStrip serviceId={service.id} />

      {service.staffNames.length > 0 && (
        <section className="adm-dblock">
          <h4>Nhân viên thực hiện <em>{service.staffNames.length} người</em></h4>
          <p className="adm-field-note">{service.staffNames.join(', ')}</p>
        </section>
      )}

      {feedback && <p className="adm-error">{feedback}</p>}
    </Drawer>
  );
}
