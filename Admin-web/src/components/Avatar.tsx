/* ===== Avatar: ảnh thật nếu URL hợp lệ, nếu không thì chữ cái đầu ===== */

import { initials, safeImage } from '../lib/utils';

export function Avatar({
  name, url, large = false, size,
}: { name: string; url: string | null | undefined; large?: boolean; size?: number }) {
  const src = safeImage(url);
  const cls = `avatar${large ? ' large' : ''}`;
  const style = size ? { width: size, height: size, fontSize: Math.round(size * 0.4) } : undefined;
  if (src) {
    return <span className={cls} style={style}><img src={src} alt="" loading="lazy" /></span>;
  }
  return <span className={cls} style={style}>{initials(name)}</span>;
}
