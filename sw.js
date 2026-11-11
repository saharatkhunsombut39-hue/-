// Service worker: เก็บตัวหน้าเว็บ (app shell) ไว้ให้เปิดได้เร็วและเปิดหน้าแรกได้แม้ออฟไลน์
// ข้อมูลจริงมาจาก API เสมอ ไม่ถูกเก็บในแคช (เพื่อความถูกต้องและความเป็นส่วนตัวของข้อมูลผู้ป่วย)
// เมื่อแก้ไฟล์หน้าเว็บ ให้เปลี่ยนเลขเวอร์ชันของ CACHE ด้านล่าง
const CACHE = 'bankhamyang-v1';
const SHELL = [
  './', 'index.html', 'config.js', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (keys) { return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); })); })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // API (script.google.com) และฟอนต์ไปที่เครือข่ายตามปกติ

  // network-first: ได้ไฟล์ล่าสุดเสมอเมื่อออนไลน์ ถ้าออฟไลน์ค่อยใช้ที่เก็บไว้
  e.respondWith(
    fetch(req)
      .then(function (res) {
        if (res.ok && !url.search) { // ไม่เก็บ URL ที่มี ?code= (callback ของการล็อกอิน)
          const copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      })
      .catch(function () {
        return caches.match(req, { ignoreSearch: true }).then(function (m) { return m || caches.match('./'); });
      })
  );
});
