/* ===== Avatar: ảnh thật nếu URL hợp lệ, nếu không thì chữ cái đầu ===== */

import { initials, safeImage } from '../lib/utils';

export function Avatar({
  name, url, large = false,
}: { name: string; url: string | null | undefined; large?: boolean }) {
  const src = safeImage(url);
  const cls = `avatar${large ? ' large' : ''}`;
  if (src) {
    return <span className={cls}><img src={src} alt="" loading="lazy" /></span>;
  }
  return <span className={cls}>{initials(name)}</span>;
}
