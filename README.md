<img width="1277" height="654" alt="image" src="https://github.com/user-attachments/assets/61dac16a-e4e9-4409-8ae2-b6daf76511a1" /># YouTube Playlist Downloader

YouTube playlistlerini MP3 formatında indirmenizi sağlayan bir web uygulaması.

## Windows Kurulum

### 1. Gereksinimler
- Node.js (v14 veya üzeri)
- npm veya yarn

### 2. Kurulum Adımları

```bash
# Projeyi klonlayın veya indirin
cd youtube-downloader

# Server bağımlılıklarını yükleyin
cd server
npm install --force

# Client bağımlılıklarını yükleyin
cd ../client
npm install
```

### 3. FFmpeg Sorunu Çözümü

Windows'ta FFmpeg hatası alıyorsanız, aşağıdaki çözümlerden birini deneyin:

#### Çözüm 1: Otomatik (Önerilen)
Kod artık `@ffmpeg-installer/ffmpeg` paketini kullanıyor. Bu paket Windows için otomatik olarak doğru ffmpeg binary'sini indirir.

```bash
cd server
npm install --force
```

#### Çözüm 2: Manuel FFmpeg Kurulumu
1. [FFmpeg'i buradan indirin](https://www.gyan.dev/ffmpeg/builds/)
2. ZIP dosyasını açın
3. `ffmpeg.exe` dosyasını bulun
4. Bu dosyayı sistem PATH'inize ekleyin veya `server` klasörüne kopyalayın

#### Çözüm 3: Chocolatey ile Kurulum
```bash
# Chocolatey yüklüyse
choco install ffmpeg
```

### 4. Uygulamayı Başlatma

İki terminal penceresi açın:

**Terminal 1 - Server:**
```bash
cd server
npm run dev
```

**Terminal 2 - Client:**
```bash
cd client
npm start
```

Uygulama `http://localhost:3000` adresinde çalışacaktır.

## Sorun Giderme

### FFmpeg ENOENT Hatası
Bu hata ffmpeg.exe dosyasının bulunamadığını gösterir. Çözüm:

1. Server klasöründe `node_modules` klasörünü silin
2. `npm cache clean --force` komutunu çalıştırın
3. `npm install --force` ile paketleri yeniden yükleyin
4. Server'ı yeniden başlatın

### OneDrive/Özel Karakterli Yol Sorunu
Proje yolu Türkçe karakter veya boşluk içeriyorsa:
1. Projeyi `C:\projects\youtube-downloader` gibi basit bir yola taşıyın
2. Yolu değiştirdikten sonra `npm install` komutunu tekrar çalıştırın

## Özellikler
- YouTube playlist URL'si ile tüm videoları listeleme
- Tek video indirme
- Tüm playlistı toplu indirme
- MP3 formatında yüksek kaliteli ses (320kbps)
- İndirilen dosyalar masaüstüne kaydedilir
