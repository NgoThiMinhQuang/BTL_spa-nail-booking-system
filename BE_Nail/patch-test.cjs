const fs = require('fs');
const path = 'tests/business-rules.test.js';
let s = fs.readFileSync(path, 'utf8');
const block = `
/* Smoke controller: moi endpoint doc cua Admin + flow cham cong/nghi dot
   xuat phai tra 200/201, khong 500 kieu overview cu (sai alias SQL). */
describe('Smoke controller Admin va Staff', () => {
  before(async () => {
    await ensureReady();
    dbConfig._setPoolForTests(testPool);
  });

  const hostGet = (name) => (String(name).toLowerCase() === 'host' ? 'localhost:3000' : null);
  const adminReq = (query = {}) => ({ query, protocol: 'http', get: hostGet });

  test('tat ca endpoint doc tra 200', async () => {
    const admin = await import('../src/controllers/admin.controller.js');
    const reqCtl = await import('../src/controllers/request.controller.js');
    const attCtl = await import('../src/controllers/attendance.controller.js');
    const payCtl = await import('../src/controllers/payroll.controller.js');
    const week = dayPlus(1).slice(0, 10);
    const weekEnd = dayPlus(3).slice(0, 10);

    const calls = [
      [admin.getOverview, adminReq({ range: '7' })],
      [admin.listServices, adminReq()],
      [admin.listStaff, adminReq()],
      [admin.listCustomers, adminReq()],
      [admin.listSchedule, adminReq({ from: week, to: weekEnd })],
      [admin.listReviews, adminReq()],
      [admin.listPayments, adminReq()],
      [admin.getReports, adminReq()],
      [reqCtl.listLeaveRequests, adminReq()],
      [reqCtl.listScheduleRequests, adminReq()],
      [attCtl.listAttendanceAdmin, adminReq({ from: week, to: weekEnd })],
      [payCtl.listPayrolls, adminReq()],
      [payCtl.previewPayroll, adminReq({ staffId: '9001', month: '2020-01' })],
      [payCtl.suggestDeduction, adminReq({ staffId: '9001', month: '2020-01' })],
    ];
    for (const [fn, req] of calls) {
      const res = mockRes();
      await fn(req, res, strictNext);
      assert.equal(res.statusCode, 200, 'endpoint ' + fn.name + ' phai 200, nhan ' + res.statusCode);
    }
  });

  test('vong doi payroll DRAFT -> CONFIRMED -> PAID khoa so', async () => {
    const payCtl = await import('../src/controllers/payroll.controller.js');
    const adminUser = { userId: 9004 };
    const base = { staffId: 9001, month: '2020-03', bonus: 100000, deduction: 20000 };

    const draft = mockRes();
    await payCtl.upsertDraft({ body: base, user: adminUser }, draft, strictNext);
    assert.equal(draft.statusCode, 201);
    const pid = draft.body.data.id;
    assert.equal(draft.body.data.totalSalary, 100000 - 20000);

    const bad = mockRes();
    await payCtl.payPayroll({ params: { id: pid }, body: {}, user: adminUser }, bad, strictNext);
    assert.equal(bad.statusCode, 409);

    const confirmed = mockRes();
    await payCtl.confirmPayroll({ params: { id: pid }, body: {}, user: adminUser }, confirmed, strictNext);
    assert.equal(confirmed.statusCode, 200);

    const paid = mockRes();
    await payCtl.payPayroll(
      { params: { id: pid }, body: { paymentMethod: 'cash' }, user: adminUser }, paid, strictNext);
    assert.equal(paid.statusCode, 200);

    const locked = mockRes();
    await payCtl.upsertDraft({ body: base, user: adminUser }, locked, strictNext);
    assert.equal(locked.statusCode, 409);

    const detail = mockRes();
    await payCtl.getPayroll({ params: { id: pid } }, detail, strictNext);
    assert.equal(detail.statusCode, 200);
    assert.equal(detail.body.data.status, 'PAID');

    const connection = await connect();
    try {
      await connection.query('DELETE FROM payroll WHERE staff_id = 9001');
    } finally {
      await connection.end();
    }
  });

  test('cham cong check-in 2 lan thi 409, checkout xong moi het', async () => {
    const attCtl = await import('../src/controllers/attendance.controller.js');
    const user = { staffId: 9001, userId: 9002 };
    const in1 = mockRes();
    await attCtl.checkIn({ user }, in1, strictNext);
    assert.equal(in1.statusCode, 201);
    const in2 = mockRes();
    await attCtl.checkIn({ user }, in2, strictNext);
    assert.equal(in2.statusCode, 409);
    const out = mockRes();
    await attCtl.checkOut({ user }, out, strictNext);
    assert.equal(out.statusCode, 200);

    const connection = await connect();
    try {
      await connection.query(
        'DELETE FROM staff_attendance WHERE staff_id = 9001 AND work_date = CURDATE()');
    } finally {
      await connection.end();
    }
  });

  test('nghi dot xuat tu duyet va chan booking moi ngay', async () => {
    const reqCtl = await import('../src/controllers/request.controller.js');
    const { checkStaffAvailable } = await import('../src/lib/staff-availability.js');
    const now = new Date();
    const fmt = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
      + '-' + String(d.getDate()).padStart(2, '0') + ' ' + String(d.getHours()).padStart(2, '0')
      + ':' + String(d.getMinutes()).padStart(2, '0');
    const start = new Date(now.getTime() + 60 * 60000);
    const end = new Date(now.getTime() + 3 * 60 * 60000);
    const user = { staffId: 9001, userId: 9002, name: 'Nhan vien Test' };

    const created = mockRes();
    await reqCtl.createLeaveRequest(
      { body: { startDatetime: fmt(start), endDatetime: fmt(end), reason: 'Sot', leave_type: 'EMERGENCY' }, user },
      created, strictNext);
    assert.equal(created.statusCode, 201);
    assert.equal(created.body.data.status, 'APPROVED');

    const blocked = await checkStaffAvailable({
      staffId: 9001, serviceId: 1,
      startsAt: fmt(start), endsAt: fmt(end),
    });
    assert.equal(blocked.ok, false);

    const connection = await connect();
    try {
      await connection.query('DELETE FROM staff_leave_request WHERE staff_id = 9001');
    } finally {
      await connection.end();
    }
  });
});
`;
if (s.includes('Smoke controller Admin va Staff')) { console.log('already patched'); process.exit(0); }
fs.writeFileSync(path, s + block);
console.log('appended');
