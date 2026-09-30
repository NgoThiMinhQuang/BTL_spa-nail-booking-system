/* ===== Điều hướng của khu vực quản trị =====
   Bản rút gọn: chỉ chuyển trang, không có vòng lặp ngày như app nhân viên. */

import { useCallback } from 'react';
import { useApp, type ViewName } from '../store';

export function useNavigation() {
  const { dispatch } = useApp();

  const goView = useCallback(
    (view: ViewName) => dispatch({ type: 'view', view }),
    [dispatch],
  );

  return { goView };
}
