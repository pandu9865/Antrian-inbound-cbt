# Inbound CBT APK Android

Project ini memakai Capacitor untuk membungkus aplikasi web Inbound CBT sebagai APK Android.

- App ID: `id.astronauts.inboundcbt`
- Source aplikasi: `https://antrian-inbound-cbt.vercel.app`
- Karena aplikasi memuat URL production tersebut, perubahan web yang sudah dideploy ke Vercel langsung terbaca saat APK dibuka.
- File APK debug untuk pengujian lokal: `dist/Inbound-CBT-v1.0-debug.apk`

## Build ulang di Windows

1. Install dependency: `npm.cmd install`
2. Sinkronkan native project: `npm.cmd run android:sync`
3. Pastikan Java 21 dan Android SDK API 36 tersedia, lalu jalankan `npm.cmd run android:build:debug`.
4. Hasil APK: `android/app/build/outputs/apk/debug/app-debug.apk`.

APK debug dapat di-install langsung dari Android setelah mengizinkan instalasi dari sumber tersebut. Untuk rilis internal permanen, buat keystore release dan sign APK menggunakan keystore yang sama untuk setiap update.
