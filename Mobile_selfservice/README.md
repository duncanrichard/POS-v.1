# POSphere Mobile Self Service

Aplikasi web mobile untuk pemesanan F&B langsung dari QR meja.

## Menjalankan lokal

1. Jalankan backend Laravel pada `http://127.0.0.1:8000`.
2. Pastikan `CUSTOMER_APP_URL=http://localhost:5190` ada di `.env` backend.
3. Jalankan `npm install` lalu `npm run dev` di folder ini.
4. Buka QR dari menu **Backoffice > Master Data > Data Meja**.

Alur pesanan: scan QR → pilih menu → buat pesanan → bayar melalui Midtrans Snap Sandbox → backend memverifikasi transaksi → tiket masuk Kitchen Display. Kasir menerima notifikasi sejak pesanan dibuat.

Isi kredensial Sandbox pada `.env` backend:

```env
MIDTRANS_SERVER_KEY=SB-Mid-server-...
MIDTRANS_CLIENT_KEY=SB-Mid-client-...
MIDTRANS_IS_PRODUCTION=false
MIDTRANS_LOCAL_SIMULATOR=true
```

Jika belum memiliki akun Midtrans, kosongkan kedua key dan aktifkan `MIDTRANS_LOCAL_SIMULATOR=true`. Mobile akan menampilkan simulator lokal dengan hasil sukses, pending, dan gagal. Mode ini hanya bekerja saat `APP_ENV=local` dan wajib dimatikan sebelum production.

Untuk menerima webhook, arahkan Payment Notification URL Midtrans ke `https://domain-backend/api/payments/midtrans/notification`. Saat lokal, callback Snap tetap diverifikasi melalui Status API; webhook publik dapat diuji memakai tunnel HTTPS.

Untuk produksi, isi `VITE_API_URL` dengan URL HTTPS backend dan `CUSTOMER_APP_URL` dengan domain aplikasi ini, lalu buat ulang QR atau buka kembali QR dinamis dari Backoffice.
