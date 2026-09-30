-- =====================================================
-- 008 · SỬA LẠI TÊN DỊCH VỤ BỊ HỎNG KÝ TỰ
-- Dịch vụ "Nail Art Nghệ Thuật" trong một số database bị lưu thành
-- "Nail Art Ngh? Thu?t" (byte 0x3F đứng thay cho ệ và ậ). Ô chứa tên và
-- mô tả hiện lên bảng điều khiển, bảng lịch hẹn và đánh giá.
--
-- Các file migration trong DB/migrations đều là UTF-8 hợp lệ, nên lỗi này
-- do dữ liệu có sẵn từ trước, không phải do file. Migration này chỉ sửa
-- khi tên còn đúng dạng hỏng, chạy lại nhiều lần vẫn an toàn.
-- =====================================================

SET NAMES utf8mb4;

UPDATE services
   SET service_name = 'Nail Art Nghệ Thuật',
       description = 'Vẽ móng nghệ thuật'
 WHERE service_name = 'Nail Art Ngh? Thu?t'
    OR service_name LIKE 'Nail Art Ngh%Thu%t'
   AND service_name NOT LIKE 'Nail Art Nghệ%';

UPDATE services
   SET description = 'Vẽ móng nghệ thuật'
 WHERE service_name = 'Nail Art Nghệ Thuật'
   AND (description IS NULL OR description LIKE '%?%' OR description = '');
