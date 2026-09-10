SET NAMES utf8mb4;

INSERT INTO users (full_name, phone, email, password, avatar, role, status) VALUES
('Nguyễn Thị Lan','0901000001','lan@nailhouse.vn','$2b$10$demo','https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=300&h=360&fit=crop','STAFF','ACTIVE'),
('Trần Thu Hà','0901000002','ha@nailhouse.vn','$2b$10$demo','https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&h=360&fit=crop','STAFF','ACTIVE'),
('Lê Thảo Vy','0901000003','vy@nailhouse.vn','$2b$10$demo','https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=300&h=360&fit=crop','STAFF','ACTIVE'),
('Phạm Minh Anh','0901000004','anh@nailhouse.vn','$2b$10$demo','https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=300&h=360&fit=crop','STAFF','ACTIVE'),
('Hoàng Kim Ngân','0901000005','ngan@nailhouse.vn','$2b$10$demo','https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=300&h=360&fit=crop','STAFF','ACTIVE')
ON DUPLICATE KEY UPDATE full_name=VALUES(full_name),email=VALUES(email),avatar=VALUES(avatar),role='STAFF',status='ACTIVE';

INSERT INTO staff (user_id,experience_year,specialty,rating)
SELECT user_id,5,'Chuyên viên Nail',4.9 FROM users WHERE phone='0901000001'
ON DUPLICATE KEY UPDATE experience_year=5,specialty='Chuyên viên Nail',rating=4.9;
INSERT INTO staff (user_id,experience_year,specialty,rating)
SELECT user_id,4,'Chuyên viên Spa',4.8 FROM users WHERE phone='0901000002'
ON DUPLICATE KEY UPDATE experience_year=4,specialty='Chuyên viên Spa',rating=4.8;
INSERT INTO staff (user_id,experience_year,specialty,rating)
SELECT user_id,2,'Chuyên viên Nail',4.7 FROM users WHERE phone='0901000003'
ON DUPLICATE KEY UPDATE experience_year=2,specialty='Chuyên viên Nail',rating=4.7;
INSERT INTO staff (user_id,experience_year,specialty,rating)
SELECT user_id,3,'Chuyên viên Gội đầu',4.8 FROM users WHERE phone='0901000004'
ON DUPLICATE KEY UPDATE experience_year=3,specialty='Chuyên viên Gội đầu',rating=4.8;
INSERT INTO staff (user_id,experience_year,specialty,rating)
SELECT user_id,2,'Chuyên viên Spa',4.6 FROM users WHERE phone='0901000005'
ON DUPLICATE KEY UPDATE experience_year=2,specialty='Chuyên viên Spa',rating=4.6;

INSERT IGNORE INTO staff_service (staff_id,service_id)
SELECT st.staff_id,s.service_id FROM staff st JOIN users u ON u.user_id=st.user_id CROSS JOIN services s
WHERE u.phone='0901000001' AND s.status='ACTIVE';
INSERT IGNORE INTO staff_service (staff_id,service_id)
SELECT st.staff_id,s.service_id FROM staff st JOIN users u ON u.user_id=st.user_id CROSS JOIN services s
WHERE u.phone IN ('0901000002','0901000005') AND s.category_id IN (1,3) AND s.status='ACTIVE';
INSERT IGNORE INTO staff_service (staff_id,service_id)
SELECT st.staff_id,s.service_id FROM staff st JOIN users u ON u.user_id=st.user_id CROSS JOIN services s
WHERE u.phone IN ('0901000003','0901000004') AND s.category_id IN (1,2) AND s.status='ACTIVE';

INSERT INTO staff_schedule (staff_id,work_date,start_time,end_time,status)
SELECT st.staff_id,DATE_ADD(CURRENT_DATE(), INTERVAL days.day_offset DAY),'09:00:00','18:00:00','AVAILABLE'
FROM staff st JOIN users u ON u.user_id=st.user_id
CROSS JOIN (
  SELECT 0 day_offset UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3
  UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7
  UNION ALL SELECT 8 UNION ALL SELECT 9 UNION ALL SELECT 10 UNION ALL SELECT 11
  UNION ALL SELECT 12 UNION ALL SELECT 13
) days
WHERE u.phone BETWEEN '0901000001' AND '0901000005'
AND NOT EXISTS (SELECT 1 FROM staff_schedule old WHERE old.staff_id=st.staff_id
  AND old.work_date=DATE_ADD(CURRENT_DATE(), INTERVAL days.day_offset DAY));
