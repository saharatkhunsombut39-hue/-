/**
 * ระบบเฝ้าระวัง สอบสวน และควบคุมโรค — รพ.สต.บ้านคำยาง
 * Version 1.0.0 By Thanet
 *
 * ไฟล์นี้ทำหน้าที่เป็น API + ฐานข้อมูล (Google Sheets) เท่านั้น
 * หน้าเว็บ (PWA) อยู่ในโฟลเดอร์ site/ และโฮสต์ที่ GitHub Pages
 *
 * วิธีใช้: วางไฟล์นี้เป็น Code.gs (ไม่ต้องมีไฟล์ Index.html ในโปรเจกต์แล้ว)
 * จากนั้น Deploy > New deployment > Web app
 *   Execute as: Me  /  Who has access: Anyone
 * นำ URL ที่ลงท้ายด้วย /exec ไปใส่ในไฟล์ site/config.js
 * (ถ้าสคริปต์ผูกกับ Google Sheet อยู่แล้ว จะใช้ชีตนั้นเป็นฐานข้อมูล
 *  ถ้าไม่ผูก ระบบจะสร้างสเปรดชีตใหม่ให้อัตโนมัติ)
 */

const APP_NAME = 'รพ.สต.บ้านคำยาง';
const APP_SUB = 'ระบบเฝ้าระวัง สอบสวน และควบคุมโรค';
const VERSION = 'Version 1.0.0 By Thanet';
const TZ = 'Asia/Bangkok';
const ADMIN_ROLE = 'ผู้ดูแลระบบ';
const STAFF_ROLE = 'เจ้าหน้าที่';

const DISEASES = ['ไข้เลือดออก', 'อุจจาระร่วง', 'ไข้หวัดใหญ่', 'โควิด-19', 'มือ เท้า ปาก', 'ตาแดง', 'อีสุกอีใส', 'อาหารเป็นพิษ', 'ไอกรน', 'อื่นๆ'];

// ---------- โครงสร้างข้อมูล (แก้ไข/เพิ่มช่องได้ที่นี่) ----------
const SCHEMA = {
  Cases: {
    label: 'เคสโรคเฝ้าระวัง (506)', icon: '🩺',
    fields: [
      { k: 'name', l: 'ชื่อ-สกุล', t: 'text', req: true },
      { k: 'age', l: 'อายุ (ปี)', t: 'number' },
      { k: 'sex', l: 'เพศ', t: 'select', o: ['ชาย', 'หญิง'] },
      { k: 'village', l: 'หมู่ที่/หมู่บ้าน', t: 'text', req: true },
      { k: 'disease', l: 'โรค', t: 'select', o: DISEASES, req: true },
      { k: 'onsetDate', l: 'วันเริ่มป่วย', t: 'date', req: true },
      { k: 'reportDate', l: 'วันที่รายงาน', t: 'date' },
      { k: 'labResult', l: 'ผลแล็บ', t: 'select', o: ['ไม่ได้ตรวจ', 'รอผล', 'บวก', 'ลบ'] },
      { k: 'caseStatus', l: 'สถานะเคส', t: 'select', o: ['สงสัย', 'น่าจะเป็น', 'ยืนยัน', 'ตัดออก'] },
      { k: 'report506', l: 'รายงาน 506', t: 'select', o: ['ยังไม่รายงาน', 'รายงานแล้ว'] },
      { k: 'outcome', l: 'ผลการรักษา', t: 'select', o: ['กำลังรักษา', 'หาย', 'ส่งต่อ', 'เสียชีวิต'] },
      { k: 'note', l: 'หมายเหตุ', t: 'textarea' }
    ]
  },
  Signals: {
    label: 'สัญญาณรอคัดกรอง', icon: '📡',
    fields: [
      { k: 'date', l: 'วันที่พบสัญญาณ', t: 'date', req: true },
      { k: 'source', l: 'แหล่งที่มา', t: 'select', o: ['รายงานผู้ป่วย', 'ชุมชน/อสม.', 'โรงเรียน/ศพด.', 'โรงพยาบาล', 'สื่อ/โซเชียล', 'อื่นๆ'] },
      { k: 'village', l: 'หมู่ที่/พื้นที่', t: 'text' },
      { k: 'description', l: 'รายละเอียดสัญญาณ', t: 'textarea', req: true },
      { k: 'status', l: 'สถานะ', t: 'select', o: ['รอคัดกรอง', 'ตรวจสอบแล้ว-เป็นจริง', 'ตรวจสอบแล้ว-ไม่เป็นจริง'] },
      { k: 'responsible', l: 'ผู้รับผิดชอบ', t: 'text' }
    ]
  },
  Events: {
    label: 'เหตุการณ์/การระบาด', icon: '⚡',
    fields: [
      { k: 'eventName', l: 'ชื่อเหตุการณ์', t: 'text', req: true },
      { k: 'disease', l: 'โรค', t: 'select', o: DISEASES },
      { k: 'village', l: 'หมู่ที่/พื้นที่', t: 'text' },
      { k: 'startDate', l: 'วันที่เริ่มเหตุการณ์', t: 'date', req: true },
      { k: 'caseCount', l: 'จำนวนผู้ป่วย', t: 'number' },
      { k: 'status', l: 'สถานะ', t: 'select', o: ['รอคัดกรอง', 'รอยืนยัน', 'ยืนยัน', 'ควบคุมโรคแล้ว', 'ปิดเหตุการณ์'] },
      { k: 'investigationDue', l: 'กำหนดสอบสวนโรค', t: 'date' },
      { k: 'investigated', l: 'สอบสวนแล้ว', t: 'select', o: ['ยังไม่ได้สอบสวน', 'สอบสวนแล้ว'] },
      { k: 'note', l: 'มาตรการ/หมายเหตุ', t: 'textarea' }
    ]
  },
  Contacts: {
    label: 'ผู้สัมผัสโรค', icon: '👥',
    fields: [
      { k: 'contactName', l: 'ชื่อผู้สัมผัส', t: 'text', req: true },
      { k: 'caseName', l: 'สัมผัสกับเคส', t: 'text' },
      { k: 'village', l: 'หมู่ที่/หมู่บ้าน', t: 'text' },
      { k: 'phone', l: 'เบอร์โทร', t: 'text' },
      { k: 'contactDate', l: 'วันที่สัมผัสล่าสุด', t: 'date' },
      { k: 'symptomatic', l: 'อาการ', t: 'select', o: ['ไม่มีอาการ', 'มีอาการ'] },
      { k: 'lastFollow', l: 'ติดตามล่าสุดเมื่อ', t: 'date' },
      { k: 'followStatus', l: 'สถานะติดตาม', t: 'select', o: ['กำลังติดตาม', 'ปิดการติดตาม'] },
      { k: 'note', l: 'หมายเหตุ', t: 'textarea' }
    ]
  },
  Community: {
    label: 'แจ้งเหตุจากชุมชน', icon: '📣',
    fields: [
      { k: 'date', l: 'วันที่แจ้ง', t: 'date', req: true },
      { k: 'reporter', l: 'ผู้แจ้ง (อสม./ประชาชน)', t: 'text' },
      { k: 'village', l: 'หมู่ที่/หมู่บ้าน', t: 'text' },
      { k: 'detail', l: 'รายละเอียดเหตุ', t: 'textarea', req: true },
      { k: 'status', l: 'สถานะ', t: 'select', o: ['รอคัดกรอง', 'รับเรื่องแล้ว', 'ปิดเรื่อง'] }
    ]
  },
  Tasks: {
    label: 'ภารกิจภาคสนาม', icon: '🚑',
    fields: [
      { k: 'task', l: 'ภารกิจ', t: 'text', req: true },
      { k: 'village', l: 'หมู่ที่/พื้นที่', t: 'text' },
      { k: 'dueDate', l: 'วันที่ดำเนินการ', t: 'date', req: true },
      { k: 'assignee', l: 'ผู้รับผิดชอบ', t: 'text' },
      { k: 'status', l: 'สถานะ', t: 'select', o: ['รอดำเนินการ', 'กำลังดำเนินการ', 'เสร็จสิ้น'] },
      { k: 'note', l: 'หมายเหตุ', t: 'textarea' }
    ]
  }
};

// ตารางผู้ใช้งาน (เฉพาะผู้ดูแลระบบเห็นและแก้ไขได้)
SCHEMA.Users = {
  label: 'ผู้ใช้งานระบบ', icon: '🔐', adminOnly: true,
  virtual: [{ k: 'password', l: 'รหัสผ่าน (ผู้ใช้ใหม่ต้องตั้ง / เว้นว่างถ้าไม่เปลี่ยน)', t: 'password' }],
  fields: [
    { k: 'username', l: 'ชื่อผู้ใช้ (username)', t: 'text', req: true },
    { k: 'name', l: 'ชื่อ-สกุล', t: 'text' },
    { k: 'role', l: 'สิทธิ์', t: 'select', o: [STAFF_ROLE, ADMIN_ROLE] },
    { k: 'active', l: 'สถานะ', t: 'select', o: ['ใช้งาน', 'ระงับ'] },
    { k: 'loginId', l: 'รหัส Provider ID/ThaiD (ถ้าใช้ล็อกอินแบบนั้น)', t: 'text' },
    { k: 'passSalt', l: '', t: 'hidden' },
    { k: 'passHash', l: '', t: 'hidden' }
  ]
};

// ---------- API (เรียกจากหน้าเว็บที่โฮสต์ที่อื่น) ----------
// หน้าเว็บส่ง POST แบบ Content-Type: text/plain (ไม่ต้องทำ preflight) เป็น JSON {action, ...}
// ตอบกลับเป็น JSON {ok:true,data:...} หรือ {ok:false,error:"..."}
const ACTIONS = {
  getSchema:      function (p) { return getSchema(); },
  getLoginInfo:   function (p) { return getLoginInfo(); },
  oauthCallback:  function (p) { return handleCallback_({ code: p.code, state: p.state }); },
  loginPassword:  function (p) { return loginPassword(p.username, p.password); },
  checkSession:   function (p) { return checkSession(p.token); },
  logout:         function (p) { return logout(p.token); },
  getDashboard:   function (p) { return getDashboard(p.token); },
  listRows:       function (p) { return listRows(p.token, p.name); },
  saveRow:        function (p) { return saveRow(p.token, p.name, p.obj); },
  deleteRow:      function (p) { return deleteRow(p.token, p.name, p.id); },
  getChangeStamp: function (p) { return getChangeStamp(p.token); },
  changePassword: function (p) { return changePassword(p.token, p.oldPw, p.newPw); }
};

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const p = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const fn = ACTIONS[p.action];
    if (!fn) throw new Error('ไม่รู้จักคำสั่ง: ' + p.action);
    return json_({ ok: true, data: fn(p) });
  } catch (err) {
    return json_({ ok: false, error: String((err && err.message) || err) });
  }
}

// เปิด URL /exec ในเบราว์เซอร์ เพื่อทดสอบว่า API ทำงาน
function doGet() {
  return json_({ ok: true, data: { app: APP_NAME, version: VERSION, message: 'API พร้อมใช้งาน' } });
}

function getSchema() {
  return { schema: SCHEMA, appName: APP_NAME, appSub: APP_SUB, version: VERSION };
}

// ---------- ฐานข้อมูล (Google Sheets) ----------
function getSS_() {
  let ss = SpreadsheetApp.getActiveSpreadsheet();
  if (ss) return ss;
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('SS_ID');
  if (id) return SpreadsheetApp.openById(id);
  ss = SpreadsheetApp.create('ฐานข้อมูล ' + APP_NAME + ' (ระบบเฝ้าระวังโรค)');
  props.setProperty('SS_ID', ss.getId());
  return ss;
}

function getSheet_(name) {
  const ss = getSS_();
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    const headers = ['ID', 'CreatedAt'].concat(SCHEMA[name].fields.map(f => f.k));
    sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold').setBackground('#e0f2f1');
    sh.getRange(2, 1, sh.getMaxRows() - 1, headers.length).setNumberFormat('@'); // เก็บเป็นข้อความ ป้องกันวันที่เพี้ยน
    sh.setFrozenRows(1);
    const def = ss.getSheetByName('Sheet1');
    if (def && ss.getSheets().length > 1 && def.getLastRow() === 0) ss.deleteSheet(def);
  }
  return sh;
}

function rows_(name) {
  const sh = getSheet_(name);
  const v = sh.getDataRange().getDisplayValues();
  if (v.length < 2) return [];
  const h = v[0];
  return v.slice(1).filter(r => r[0]).map(r => {
    const o = {};
    h.forEach((k, i) => (o[k] = r[i]));
    return o;
  });
}

function listRows(token, name) {
  auth_(token, SCHEMA[name] && SCHEMA[name].adminOnly);
  if (!SCHEMA[name]) throw new Error('ไม่พบตาราง');
  const out = rows_(name).reverse();
  if (name === 'Users') out.forEach(function (r) { r.passSalt = ''; r.passHash = ''; }); // ไม่ส่งแฮชรหัสผ่านไปที่หน้าเว็บ
  return out;
}

function saveRow(token, name, obj) {
  const res = saveRowCore_(token, name, obj);
  bump_();
  return res;
}

function saveRowCore_(token, name, obj) {
  auth_(token, SCHEMA[name] && SCHEMA[name].adminOnly);
  if (name === 'Users') {
    obj.username = String(obj.username || '').trim().toLowerCase();
    if (!obj.username) throw new Error('กรุณากรอกชื่อผู้ใช้');
    const all = rows_('Users');
    if (all.some(function (r) { return String(r.username).toLowerCase() === obj.username && r.ID !== obj.ID; })) throw new Error('ชื่อผู้ใช้นี้มีอยู่แล้ว');
    const old = obj.ID ? all.filter(function (r) { return r.ID === obj.ID; })[0] : null;
    if (obj.password) {
      if (String(obj.password).length < 6) throw new Error('รหัสผ่านต้องยาวอย่างน้อย 6 ตัวอักษร');
      obj.passSalt = rand_();
      obj.passHash = hashPw_(String(obj.password), obj.passSalt);
    } else if (old) {
      obj.passSalt = old.passSalt; obj.passHash = old.passHash; // ไม่เปลี่ยนรหัสผ่าน
    } else {
      throw new Error('กรุณาตั้งรหัสผ่านสำหรับผู้ใช้ใหม่');
    }
    delete obj.password;
  }
  if (!SCHEMA[name]) throw new Error('ไม่พบตาราง');
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sh = getSheet_(name);
    const keys = SCHEMA[name].fields.map(f => f.k);
    const fill = r => keys.map(k => (obj[k] == null ? '' : String(obj[k]).trim()));
    if (obj.ID) {
      const ids = sh.getRange(1, 1, sh.getLastRow(), 1).getValues().map(r => r[0]);
      const idx = ids.indexOf(obj.ID);
      if (idx < 1) throw new Error('ไม่พบข้อมูลที่ต้องการแก้ไข');
      sh.getRange(idx + 1, 3, 1, keys.length).setValues([fill()]);
    } else {
      const id = Utilities.getUuid().slice(0, 8);
      const now = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm:ss');
      const rowVals = [id, now].concat(fill());
      const next = sh.getLastRow() + 1;
      sh.getRange(next, 1, 1, rowVals.length).setNumberFormat('@').setValues([rowVals]);
    }
    return true;
  } finally {
    lock.releaseLock();
  }
}

function deleteRow(token, name, id) {
  const res = deleteRowCore_(token, name, id);
  bump_();
  return res;
}

function deleteRowCore_(token, name, id) {
  auth_(token, SCHEMA[name] && SCHEMA[name].adminOnly);
  if (!SCHEMA[name]) throw new Error('ไม่พบตาราง');
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sh = getSheet_(name);
    const ids = sh.getRange(1, 1, sh.getLastRow(), 1).getValues().map(r => r[0]);
    const idx = ids.indexOf(id);
    if (idx < 1) throw new Error('ไม่พบข้อมูล');
    sh.deleteRow(idx + 1);
    return true;
  } finally {
    lock.releaseLock();
  }
}

// ---------- แดชบอร์ด ----------
function daysAgo_(s, todayMs) {
  if (!s) return null;
  const d = new Date(s + 'T00:00:00+07:00').getTime();
  if (isNaN(d)) return null;
  return Math.floor((todayMs - d) / 86400000);
}

function getDashboard(token) {
  auth_(token);
  const today = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
  const todayMs = new Date(today + 'T00:00:00+07:00').getTime();

  const cases = rows_('Cases');
  const signals = rows_('Signals');
  const events = rows_('Events');
  const contacts = rows_('Contacts');
  const community = rows_('Community');
  const tasks = rows_('Tasks');

  const openEvents = events.filter(e => e.status !== 'ปิดเหตุการณ์' && e.status !== 'ควบคุมโรคแล้ว');
  const pendingSignals = signals.filter(s => s.status === 'รอคัดกรอง');
  const pendingEvents = events.filter(e => e.status === 'รอคัดกรอง' || e.status === 'รอยืนยัน');
  const sympContacts = contacts.filter(c => c.symptomatic === 'มีอาการ' && c.followStatus !== 'ปิดการติดตาม');
  const notFollowed = contacts.filter(c => c.followStatus !== 'ปิดการติดตาม' && c.lastFollow !== today);
  const tasksToday = tasks.filter(t => t.dueDate === today && t.status !== 'เสร็จสิ้น');
  const labPositive = cases.filter(c => c.labResult === 'บวก' && c.caseStatus !== 'ยืนยัน' && c.caseStatus !== 'ตัดออก');
  const pendingCommunity = community.filter(c => c.status === 'รอคัดกรอง');
  const notReported = cases.filter(c => c.report506 !== 'รายงานแล้ว' && c.caseStatus !== 'ตัดออก');
  const overdue = events.filter(e => e.investigated !== 'สอบสวนแล้ว' && e.investigationDue && e.investigationDue < today &&
    e.status !== 'ปิดเหตุการณ์');

  const todo = [
    { label: 'สัญญาณรอคัดกรอง', count: pendingSignals.length, page: 'Signals', filter: 'รอคัดกรอง', tone: 'red' },
    { label: 'เหตุการณ์รอคัดกรอง/ยืนยัน', count: pendingEvents.length, page: 'Events', filter: 'รอ', tone: 'amber' },
    { label: 'ผู้สัมผัสมีอาการ', count: sympContacts.length, page: 'Contacts', filter: 'มีอาการ', tone: 'red' },
    { label: 'ผู้สัมผัสที่ยังไม่ได้ติดตามวันนี้', count: notFollowed.length, page: 'Contacts', filter: 'กำลังติดตาม', tone: 'blue' },
    { label: 'ภารกิจภาคสนามวันนี้', count: tasksToday.length, page: 'Tasks', filter: '', tone: 'blue' },
    { label: 'ผลแล็บบวก — เสนอปรับเป็น "ยืนยัน"', count: labPositive.length, page: 'Cases', filter: 'บวก', tone: 'amber' },
    { label: 'เคสที่ยังไม่ได้รายงาน 506', count: notReported.length, page: 'Cases', filter: 'ยังไม่รายงาน', tone: 'amber' },
    { label: 'แจ้งเหตุจากชุมชนรอคัดกรอง', count: pendingCommunity.length, page: 'Community', filter: 'รอคัดกรอง', tone: 'red' }
  ];
  const todoTotal = todo.reduce((a, b) => a + b.count, 0);

  let level = 'ปกติ', levelTone = 'green', levelMsg = 'ไม่มีงานค้างเร่งด่วน';
  if (sympContacts.length || pendingEvents.length || overdue.length) {
    level = 'ต้องตอบสนอง'; levelTone = 'red';
    levelMsg = 'มีงานเร่งด่วนที่ต้องดำเนินการทันที';
  } else if (todoTotal > 0) {
    level = 'เฝ้าระวัง'; levelTone = 'amber';
    levelMsg = 'มีงานที่ต้องติดตามวันนี้ ' + todoTotal + ' รายการ';
  }

  // ผู้ป่วยรายสัปดาห์ (8 สัปดาห์ล่าสุด) ตามวันเริ่มป่วย
  const weekly = [];
  for (let i = 7; i >= 0; i--) weekly.push({ label: i === 0 ? 'สัปดาห์นี้' : i + ' สป.ก่อน', count: 0 });
  let last7 = 0;
  const byDisease = {}, byVillage = {};
  cases.forEach(c => {
    if (c.caseStatus === 'ตัดออก') return;
    const d = daysAgo_(c.onsetDate, todayMs);
    if (d == null || d < 0) return;
    const w = Math.floor(d / 7);
    if (w < 8) weekly[7 - w].count++;
    if (d < 7) last7++;
    if (d < 28) {
      byDisease[c.disease] = (byDisease[c.disease] || 0) + 1;
      const v = c.village || 'ไม่ระบุ';
      byVillage[v] = (byVillage[v] || 0) + 1;
    }
  });
  const toList = o => Object.keys(o).map(k => ({ name: k, count: o[k] })).sort((a, b) => b.count - a.count).slice(0, 6);

  // เตือนภัยไข้เลือดออก: หมู่บ้านเดียวกัน >= 2 ราย ภายใน 14 วัน
  const dv = {};
  cases.forEach(c => {
    if (c.disease !== 'ไข้เลือดออก' || c.caseStatus === 'ตัดออก') return;
    const d = daysAgo_(c.onsetDate, todayMs);
    if (d == null || d < 0 || d > 14) return;
    const v = c.village || 'ไม่ระบุ';
    dv[v] = (dv[v] || 0) + 1;
  });
  const dengue = Object.keys(dv).filter(v => dv[v] >= 2).map(v => ({ village: v, count: dv[v] }));

  return {
    today, level, levelTone, levelMsg, todo, todoTotal, weekly, byDisease: toList(byDisease), byVillage: toList(byVillage), dengue,
    kpis: [
      { label: 'ผู้ป่วย 7 วันล่าสุด', value: last7 },
      { label: 'สัญญาณรอคัดกรอง', value: pendingSignals.length },
      { label: 'เหตุการณ์ที่เปิดอยู่', value: openEvents.length },
      { label: 'เกินกำหนดสอบสวน', value: overdue.length },
      { label: 'ผู้สัมผัสที่กำลังติดตาม', value: contacts.filter(c => c.followStatus !== 'ปิดการติดตาม').length },
      { label: 'ภารกิจที่ค้างอยู่', value: tasks.filter(t => t.status !== 'เสร็จสิ้น').length }
    ]
  };
}

// =====================================================================
//  การเข้าสู่ระบบ: Provider ID (กระทรวงสาธารณสุข) และ ThaiD (กรมการปกครอง)
// =====================================================================
// ตั้งค่าที่ Project Settings > Script properties (อย่าใส่ความลับในโค้ด)
//   ADMIN_IDS            รหัสผู้ดูแลระบบ คั่นด้วย , (ดูรหัสได้จากหน้า "ยังไม่ได้รับสิทธิ์" หลังล็อกอินครั้งแรก)
//   HEALTHID_CLIENT_ID, HEALTHID_SECRET, PROVIDER_CLIENT_ID, PROVIDER_SECRET   (ได้จากสำนักสุขภาพดิจิทัล สธ.)
//   HEALTHID_ENV         prd (ค่าเริ่มต้น) หรือ uat
//   THAID_CLIENT_ID, THAID_CLIENT_SECRET                                       (ได้จาก ThaiD/DOPA)
//   THAID_ENV            sbx (ค่าเริ่มต้น) หรือ prd
//   THAID_SCOPES         ค่าเริ่มต้น "openid pid name" (ขอได้เฉพาะ scope ที่ได้รับอนุมัติ)
//   REDIRECT_URI         (ต้องตั้งถ้าใช้ Provider ID/ThaiD) = URL หน้าเว็บที่ GitHub Pages เช่น https://ชื่อ.github.io/ชื่อrepo/
//                        ต้องตรงกับที่ลงทะเบียนไว้กับผู้ให้บริการทุกตัวอักษร
//   ไม่บังคับ: HEALTHID_BASE, PROVIDER_BASE, THAID_ISSUER
// รัน showRedirectUri() หนึ่งครั้ง เพื่อดู Redirect URI ที่ต้องแจ้งลงทะเบียนกับผู้ให้บริการ

const SESSION_TTL = 21600; // 6 ชั่วโมง (ค่าสูงสุดของ CacheService)

function showRedirectUri() { Logger.log(redirectUri_()); }

function prop_(k, d) { return PropertiesService.getScriptProperties().getProperty(k) || d || ''; }
function redirectUri_() { return prop_('REDIRECT_URI') || ScriptApp.getService().getUrl(); }
function rand_() { return (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, ''); }
function b64url_(bytes) { return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/, ''); }
function hex_(bytes) { return bytes.map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join(''); }

function pidHash_(pid) {
  // ไม่เก็บเลขบัตรประชาชน: ใช้รหัสย่อที่แฮชจากเลขบัตร + salt ของระบบนี้แทน
  let salt = prop_('PID_SALT');
  if (!salt) { salt = rand_(); PropertiesService.getScriptProperties().setProperty('PID_SALT', salt); }
  return hex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + ':' + pid, Utilities.Charset.UTF_8)).slice(0, 12).toUpperCase();
}

function providerCfg_() {
  const prd = prop_('HEALTHID_ENV', 'prd') !== 'uat';
  return {
    hidId: prop_('HEALTHID_CLIENT_ID'), hidSecret: prop_('HEALTHID_SECRET'),
    prvId: prop_('PROVIDER_CLIENT_ID'), prvSecret: prop_('PROVIDER_SECRET'),
    hidBase: prop_('HEALTHID_BASE', prd ? 'https://moph.id.th' : 'https://uat-moph.id.th'),
    prvBase: prop_('PROVIDER_BASE', prd ? 'https://provider.id.th' : 'https://uat-provider.id.th') // ตรวจ URL UAT ตามคู่มือที่ได้รับ
  };
}

function thaidCfg_() {
  const env = prop_('THAID_ENV', 'sbx');
  return {
    clientId: prop_('THAID_CLIENT_ID'), clientSecret: prop_('THAID_CLIENT_SECRET'),
    issuer: prop_('THAID_ISSUER', env === 'prd' ? 'https://imauth.bora.dopa.go.th' : 'https://imauthsbx.bora.dopa.go.th'),
    scopes: prop_('THAID_SCOPES', 'openid pid name')
  };
}

// สร้างลิงก์เข้าสู่ระบบ (state/PKCE เก็บใน cache 10 นาที)
function getLoginInfo() {
  const cache = CacheService.getScriptCache();
  const ru = redirectUri_();
  const out = { providerUrl: null, thaidUrl: null, thaidError: null };

  const pc = providerCfg_();
  if (pc.hidId && pc.hidSecret && pc.prvId && pc.prvSecret) {
    const state = rand_();
    cache.put('ST_' + state, JSON.stringify({ p: 'provider' }), 600);
    out.providerUrl = pc.hidBase + '/oauth/redirect?client_id=' + encodeURIComponent(pc.hidId) +
      '&redirect_uri=' + encodeURIComponent(ru) + '&response_type=code&state=' + state;
  }

  const tc = thaidCfg_();
  if (tc.clientId && tc.clientSecret) {
    try {
      const meta = thaidMeta_();
      const state = rand_(), nonce = rand_(), verifier = rand_() + rand_();
      const challenge = b64url_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, verifier, Utilities.Charset.UTF_8));
      cache.put('ST_' + state, JSON.stringify({ p: 'thaid', nonce: nonce, verifier: verifier }), 600);
      out.thaidUrl = meta.authorization_endpoint + '?response_type=code&client_id=' + encodeURIComponent(tc.clientId) +
        '&redirect_uri=' + encodeURIComponent(ru) + '&scope=' + encodeURIComponent(tc.scopes) +
        '&state=' + state + '&nonce=' + nonce + '&code_challenge=' + challenge + '&code_challenge_method=S256';
    } catch (err) { out.thaidError = String(err.message || err); }
  }
  return out;
}

// รับ callback จากผู้ให้บริการ -> ตรวจสอบ -> สร้างเซสชัน
function handleCallback_(p) {
  const cache = CacheService.getScriptCache();
  let st;
  if (p.state) {
    const raw = cache.get('ST_' + p.state);
    if (!raw) throw new Error('หมดเวลาหรือข้อมูลยืนยันไม่ถูกต้อง กรุณากดเข้าสู่ระบบใหม่อีกครั้ง');
    cache.remove('ST_' + p.state); // ใช้ได้ครั้งเดียว
    st = JSON.parse(raw);
  } else {
    st = { p: 'provider' }; // Health ID บางเวอร์ชันอาจไม่ส่ง state กลับ
  }
  const prof = st.p === 'thaid' ? thaidLogin_(p.code, st) : providerLogin_(p.code);
  const role = roleFor_(prof.loginId);
  if (!role) return { session: null, error: null, denied: { loginId: prof.loginId, name: prof.name } };
  const token = rand_();
  cache.put('S_' + token, JSON.stringify({ loginId: prof.loginId, name: prof.name, role: role, via: prof.via }), SESSION_TTL);
  return { session: { token: token, name: prof.name, role: role, via: prof.via }, error: null };
}

function roleFor_(loginId) {
  const admins = prop_('ADMIN_IDS').split(',').map(function (s) { return s.trim(); }).filter(String);
  if (admins.indexOf(loginId) >= 0) return ADMIN_ROLE;
  const u = rows_('Users').filter(function (r) { return r.loginId === loginId && r.active !== 'ระงับ'; })[0];
  if (!u) return null;
  return u.role === ADMIN_ROLE ? ADMIN_ROLE : STAFF_ROLE;
}

function postJson_(url, body) {
  const r = UrlFetchApp.fetch(url, { method: 'post', contentType: 'application/json', payload: JSON.stringify(body), muteHttpExceptions: true });
  let j = {};
  try { j = JSON.parse(r.getContentText()); } catch (e) {}
  if (r.getResponseCode() >= 400 && !j.message) j.message = 'HTTP ' + r.getResponseCode();
  return j;
}

// ----- Provider ID: Health ID (OAuth) -> token Provider ID -> profile -----
function providerLogin_(code) {
  const c = providerCfg_();
  const t1 = postJson_(c.hidBase + '/api/v1/token', {
    grant_type: 'authorization_code', code: code, redirect_uri: redirectUri_(),
    client_id: c.hidId, client_secret: c.hidSecret
  });
  const hidToken = t1.data && t1.data.access_token;
  if (!hidToken) throw new Error('ขอ token จาก Health ID ไม่สำเร็จ' + (t1.message ? ': ' + t1.message : ''));

  const t2 = postJson_(c.prvBase + '/api/v1/services/token', {
    client_id: c.prvId, secret_key: c.prvSecret, token_by: 'Health ID', token: hidToken
  });
  const prvToken = t2.data && t2.data.access_token;
  if (!prvToken) throw new Error('ไม่พบ Provider ID ของผู้ใช้นี้ หรือขอ token ไม่สำเร็จ' + (t2.message ? ': ' + t2.message : ''));

  const r = UrlFetchApp.fetch(c.prvBase + '/api/v1/services/profile?position_type=1', {
    method: 'get', muteHttpExceptions: true,
    headers: { 'client-id': c.prvId, 'secret-key': c.prvSecret, Authorization: 'Bearer ' + prvToken }
  });
  let j = {};
  try { j = JSON.parse(r.getContentText()); } catch (e) {}
  const d = j.data || {};
  const pid = d.provider_id || d.account_id;
  if (!pid) throw new Error('อ่านข้อมูล Provider ID ไม่สำเร็จ' + (j.message ? ': ' + j.message : ''));
  const name = d.name_th || [d.title_th, d.firstname_th, d.lastname_th].filter(String).join(' ') || 'ผู้ใช้ Provider ID';
  return { loginId: 'PROVIDER-' + pid, name: name, via: 'Provider ID' };
}

// ----- ThaiD: OpenID Connect (Authorization Code + PKCE) -----
function thaidMeta_() {
  const tc = thaidCfg_(), cache = CacheService.getScriptCache();
  const key = 'TM_' + hex_(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, tc.issuer));
  const hit = cache.get(key);
  if (hit) return JSON.parse(hit);
  const r = UrlFetchApp.fetch(tc.issuer.replace(/\/$/, '') + '/.well-known/openid-configuration', { muteHttpExceptions: true });
  if (r.getResponseCode() !== 200) throw new Error('อ่านค่าตั้งต้นของ ThaiD ไม่สำเร็จ (HTTP ' + r.getResponseCode() + ')');
  const txt = r.getContentText();
  cache.put(key, txt, 21600);
  return JSON.parse(txt);
}

function jwtPayload_(jwt) {
  const parts = String(jwt).split('.');
  if (parts.length < 2) throw new Error('id_token ไม่ถูกต้อง');
  let s = parts[1];
  while (s.length % 4) s += '=';
  return JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(s)).getDataAsString('UTF-8'));
}

function thaidLogin_(code, st) {
  const tc = thaidCfg_(), meta = thaidMeta_();
  const form = { grant_type: 'authorization_code', code: code, redirect_uri: redirectUri_(), client_id: tc.clientId, code_verifier: st.verifier };
  const headers = {};
  const methods = meta.token_endpoint_auth_methods_supported || ['client_secret_basic'];
  if (methods.indexOf('client_secret_basic') >= 0) headers.Authorization = 'Basic ' + Utilities.base64Encode(tc.clientId + ':' + tc.clientSecret);
  else form.client_secret = tc.clientSecret;
  const r = UrlFetchApp.fetch(meta.token_endpoint, { method: 'post', payload: form, headers: headers, muteHttpExceptions: true });
  let j = {};
  try { j = JSON.parse(r.getContentText()); } catch (e) {}
  if (!j.id_token) throw new Error('ขอ token จาก ThaiD ไม่สำเร็จ' + (j.error_description ? ': ' + j.error_description : ''));

  // token ได้มาโดยตรงจาก token endpoint ผ่าน TLS พร้อมยืนยันตัวตนไคลเอนต์ จึงตรวจ claim ตามมาตรฐาน OIDC
  const c = jwtPayload_(j.id_token);
  const norm = function (u) { return String(u || '').replace(/\/$/, ''); };
  if (norm(c.iss) !== norm(meta.issuer || tc.issuer)) throw new Error('ผู้ออก token (iss) ไม่ถูกต้อง');
  if ([].concat(c.aud || []).indexOf(tc.clientId) < 0) throw new Error('token ไม่ได้ออกให้ระบบนี้ (aud)');
  if (!c.exp || c.exp * 1000 < Date.now()) throw new Error('token หมดอายุ');
  if (c.nonce !== st.nonce) throw new Error('nonce ไม่ตรงกัน');

  let pid = c.pid;
  let name = c.name || [c.given_name, c.family_name].filter(String).join(' ');
  if ((!pid || !name) && meta.userinfo_endpoint && j.access_token) {
    const u = UrlFetchApp.fetch(meta.userinfo_endpoint, { headers: { Authorization: 'Bearer ' + j.access_token }, muteHttpExceptions: true });
    try {
      const ui = JSON.parse(u.getContentText());
      pid = pid || ui.pid;
      name = name || ui.name || [ui.given_name, ui.family_name].filter(String).join(' ');
    } catch (e) {}
  }
  if (!pid) throw new Error('ThaiD ไม่ส่งเลขประจำตัวกลับมา (ตรวจ scope "pid" ที่ลงทะเบียนไว้)');
  return { loginId: 'THAID-' + pidHash_(pid), name: name || 'ผู้ใช้ ThaiD', via: 'ThaiD' };
}

// ----- เซสชัน -----
function auth_(token, needAdmin) {
  const raw = token ? CacheService.getScriptCache().get('S_' + token) : null;
  if (!raw) throw new Error('SESSION_EXPIRED');
  const s = JSON.parse(raw);
  if (needAdmin && s.role !== ADMIN_ROLE) throw new Error('เฉพาะผู้ดูแลระบบเท่านั้น');
  return s;
}

// ----- ล็อกอินด้วยชื่อผู้ใช้/รหัสผ่าน -----
// ผู้ดูแลคนแรก: ตั้ง Script properties  ADMIN_USERNAME (ค่าเริ่มต้น admin) และ ADMIN_PASSWORD
// จากนั้นล็อกอินแล้วเพิ่มผู้ใช้อื่นที่เมนู "ผู้ใช้งานระบบ"
function hashPw_(pw, salt) {
  let h = salt + ':' + pw;
  for (let i = 0; i < 1000; i++) h = hex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, h + salt, Utilities.Charset.UTF_8));
  return h;
}

function loginPassword(username, password) {
  const u = String(username || '').trim().toLowerCase();
  const pw = String(password || '');
  if (!u || !pw) throw new Error('กรุณากรอกชื่อผู้ใช้และรหัสผ่าน');
  const cache = CacheService.getScriptCache();
  const fk = 'FAIL_' + u.slice(0, 60);
  const fails = Number(cache.get(fk) || 0);
  if (fails >= 5) throw new Error('ลองผิดหลายครั้ง กรุณารอ 10 นาทีแล้วลองใหม่');

  let prof = null;
  const adminU = prop_('ADMIN_USERNAME', 'admin').toLowerCase(), adminP = prop_('ADMIN_PASSWORD');
  if (adminP && u === adminU && pw === adminP) {
    prof = { name: 'ผู้ดูแลระบบ', role: ADMIN_ROLE };
  } else {
    const r = rows_('Users').filter(function (x) { return String(x.username).toLowerCase() === u && x.active !== 'ระงับ'; })[0];
    if (r && r.passSalt && r.passHash === hashPw_(pw, r.passSalt)) {
      prof = { name: r.name || r.username, role: r.role === ADMIN_ROLE ? ADMIN_ROLE : STAFF_ROLE };
    }
  }
  if (!prof) {
    cache.put(fk, String(fails + 1), 600);
    throw new Error('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
  }
  cache.remove(fk);
  const token = rand_();
  cache.put('S_' + token, JSON.stringify({ loginId: 'USER-' + u, name: prof.name, role: prof.role, via: 'รหัสผ่าน' }), SESSION_TTL);
  return { token: token, name: prof.name, role: prof.role, via: 'รหัสผ่าน' };
}

function changePassword(token, oldPw, newPw) {
  const s = auth_(token);
  if (String(newPw || '').length < 6) throw new Error('รหัสผ่านใหม่ต้องยาวอย่างน้อย 6 ตัวอักษร');
  if (s.loginId.indexOf('USER-') !== 0) throw new Error('บัญชีนี้ไม่ได้ใช้รหัสผ่านของระบบ');
  const uname = s.loginId.slice(5);
  const r = rows_('Users').filter(function (x) { return String(x.username).toLowerCase() === uname; })[0];
  if (!r) throw new Error('ผู้ดูแลหลักเปลี่ยนรหัสได้ที่ Script property ADMIN_PASSWORD');
  if (r.passHash !== hashPw_(String(oldPw || ''), r.passSalt)) throw new Error('รหัสผ่านเดิมไม่ถูกต้อง');
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sh = getSheet_('Users');
    const keys = SCHEMA.Users.fields.map(function (f) { return f.k; });
    const ids = sh.getRange(1, 1, sh.getLastRow(), 1).getValues().map(function (x) { return x[0]; });
    const idx = ids.indexOf(r.ID);
    if (idx < 1) throw new Error('ไม่พบผู้ใช้');
    const salt = rand_();
    sh.getRange(idx + 1, 3 + keys.indexOf('passSalt')).setValue(salt);
    sh.getRange(idx + 1, 3 + keys.indexOf('passHash')).setValue(hashPw_(String(newPw), salt));
  } finally {
    lock.releaseLock();
  }
  return true;
}

// ----- อัปเดตแบบเรียลไทม์ (polling) -----
// ทุกครั้งที่มีการบันทึก/ลบ จะเปลี่ยนตัวนับ แล้วหน้าเว็บที่เปิดอยู่จะตรวจพบและโหลดข้อมูลใหม่เอง
function bump_() {
  const v = String(Date.now());
  try { CacheService.getScriptCache().put('CHG', v, 21600); } catch (e) {}
  PropertiesService.getScriptProperties().setProperty('CHG', v);
}

function getChangeStamp(token) {
  auth_(token);
  return CacheService.getScriptCache().get('CHG') || prop_('CHG') || '0';
}

function checkSession(token) {
  try { const s = auth_(token); return { name: s.name, role: s.role, via: s.via }; } catch (e) { return null; }
}

function logout(token) {
  if (token) CacheService.getScriptCache().remove('S_' + token);
  return true;
}
