import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import ytdl from '@distube/ytdl-core';
import { GetPlaylistData } from 'youtube-search-api';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import path from 'path';
import fs from 'fs';
import { promisify } from 'util';
import { pipeline } from 'stream';
import os from 'os';

// FFmpeg yolu ayarlama
const isWindows = process.platform === 'win32';
let ffmpegPath: string | null = null;

// Önce ffmpeg-installer'ı dene (Windows için daha güvenilir)
if (ffmpegInstaller && ffmpegInstaller.path) {
  ffmpegPath = ffmpegInstaller.path;
  console.log('FFmpeg yolu (ffmpeg-installer):', ffmpegPath);
} else if (ffmpegStatic) {
  // ffmpeg-static'i dene
  if (fs.existsSync(ffmpegStatic)) {
    ffmpegPath = ffmpegStatic;
    console.log('FFmpeg yolu (ffmpeg-static):', ffmpegPath);
  }
}

// Hala bulunamadıysa alternatif yolları dene
if (!ffmpegPath && isWindows) {
  const possiblePaths = [
    path.join(__dirname, '..', 'node_modules', 'ffmpeg-static', 'ffmpeg.exe'),
    path.join(process.cwd(), 'node_modules', 'ffmpeg-static', 'ffmpeg.exe'),
    path.join(__dirname, '..', 'node_modules', '@ffmpeg-installer', 'win32-x64', 'ffmpeg.exe'),
    path.join(process.cwd(), 'node_modules', '@ffmpeg-installer', 'win32-x64', 'ffmpeg.exe'),
    'ffmpeg' // Sistem PATH'inde varsa
  ];
  
  for (const testPath of possiblePaths) {
    try {
      if (fs.existsSync(testPath)) {
        ffmpegPath = testPath;
        console.log('FFmpeg yolu (alternatif):', ffmpegPath);
        break;
      }
    } catch (e) {
      // Yol kontrolünde hata olursa devam et
    }
  }
}

if (ffmpegPath) {
  ffmpeg.setFfmpegPath(ffmpegPath);
  console.log('FFmpeg başarıyla ayarlandı.');
} else {
  console.error('FFmpeg bulunamadı! Lütfen aşağıdaki adımları deneyin:');
  console.error('1. npm install --force komutunu çalıştırın');
  console.error('2. Sistem PATH\'ine ffmpeg ekleyin');
  console.error('3. ffmpeg.exe dosyasını manuel olarak indirip proje klasörüne koyun');
}

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const pipelineAsync = promisify(pipeline);

interface VideoInfo {
  id: string;
  title: string;
  author: string;
  duration: string;
  thumbnail: string;
}

app.get('/api/playlist/:playlistId', async (req, res) => {
  try {
    const { playlistId } = req.params;
    
    // URL'den playlist ID'sini çıkar
    let cleanPlaylistId = playlistId;
    if (playlistId.includes('youtube.com')) {
      const match = playlistId.match(/[&?]list=([^&]+)/);
      cleanPlaylistId = match ? match[1] : playlistId;
    }
    
    const playlistData = await GetPlaylistData(cleanPlaylistId);
    
    if (!playlistData || !playlistData.items) {
      throw new Error('Playlist verisi alınamadı');
    }
    
    const videos: VideoInfo[] = playlistData.items.map((item: any) => ({
      id: item.id,
      title: item.title || 'Başlıksız',
      author: item.channelTitle || 'Bilinmeyen',
      duration: formatDuration(item.length || 0),
      thumbnail: item.thumbnail?.url || ''
    }));

    res.json({
      title: playlistData.metadata?.title || 'YouTube Playlist',
      author: playlistData.metadata?.channelTitle || 'YouTube',
      videos
    });
  } catch (error) {
    console.error('Playlist fetch error:', error);
    res.status(500).json({ error: 'Playlist alınamadı. Lütfen geçerli bir playlist URL\'si girin.' });
  }
});

function formatDuration(seconds: number): string {
  if (!seconds) return '0:00';
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

app.post('/api/download', async (req, res) => {
  try {
    const { videoId, title } = req.body;
    
    if (!ytdl.validateID(videoId)) {
      return res.status(400).json({ error: 'Geçersiz video ID' });
    }

    const info = await ytdl.getInfo(videoId);
    const audioFormats = ytdl.filterFormats(info.formats, 'audioonly');
    
    if (audioFormats.length === 0) {
      return res.status(400).json({ error: 'Ses formatı bulunamadı' });
    }

    // Türkçe karakterleri dönüştür
    const turkishChars: {[key: string]: string} = {
      'ç': 'c', 'Ç': 'C', 'ğ': 'g', 'Ğ': 'G', 'ı': 'i', 'İ': 'I',
      'ö': 'o', 'Ö': 'O', 'ş': 's', 'Ş': 'S', 'ü': 'u', 'Ü': 'U'
    };
    
    let asciiTitle = title;
    for (const [tr, en] of Object.entries(turkishChars)) {
      asciiTitle = asciiTitle.replace(new RegExp(tr, 'g'), en);
    }
    
    // Önce Türkçe karakterleri değiştir, sonra diğer özel karakterleri temizle
    const sanitizedTitle = asciiTitle.replace(/[^a-zA-Z0-9\s-]/g, '').trim().substring(0, 80);
    const uniqueId = Date.now().toString(36); // Benzersiz ID
    const fileName = `${sanitizedTitle}_${uniqueId}.mp3`;
    
    // Geçici dosya için basit isim kullan
    const tempDir = os.tmpdir();
    const tempFileName = `temp_${uniqueId}.mp3`;
    const tempFilePath = path.join(tempDir, tempFileName);
    
    // Final hedef yol
    const desktopPath = path.join(os.homedir(), 'Desktop');
    const finalFilePath = path.join(desktopPath, fileName);

    const stream = ytdl(videoId, {
      quality: 'highestaudio',
      filter: 'audioonly'
    });

    await new Promise((resolve, reject) => {
      ffmpeg(stream)
        .audioBitrate(320)
        .toFormat('mp3')
        .on('error', (err: Error) => {
          console.error('FFmpeg error:', err);
          if (fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath);
          }
          reject(err);
        })
        .on('end', () => {
          console.log('Dönüştürme tamamlandı, dosya taşınıyor...');
          console.log('Temp dosya:', tempFilePath);
          console.log('Hedef dosya:', finalFilePath);
          
          // Dosya taşıma işlemini biraz geciktir (ffmpeg'in dosyayı kapatması için)
          setTimeout(() => {
            try {
              // Önce temp dosyanın varlığını kontrol et
              if (!fs.existsSync(tempFilePath)) {
                reject(new Error('Geçici dosya bulunamadı: ' + tempFilePath));
                return;
              }
              
              // Masaüstü klasörünün varlığını kontrol et
              if (!fs.existsSync(desktopPath)) {
                fs.mkdirSync(desktopPath, { recursive: true });
              }
              
              // Dosyayı taşımayı dene
              try {
                fs.renameSync(tempFilePath, finalFilePath);
                console.log('İndirme tamamlandı (rename):', fileName);
                resolve(true);
              } catch (renameErr) {
                // Farklı disk bölümleri arasında rename çalışmayabilir, copy/delete kullan
                const readStream = fs.createReadStream(tempFilePath);
                const writeStream = fs.createWriteStream(finalFilePath);
                
                readStream.on('error', (err) => {
                  console.error('Okuma hatası:', err);
                  reject(err);
                });
                
                writeStream.on('error', (err) => {
                  console.error('Yazma hatası:', err);
                  reject(err);
                });
                
                writeStream.on('finish', () => {
                  fs.unlinkSync(tempFilePath);
                  console.log('İndirme tamamlandı (stream copy):', fileName);
                  resolve(true);
                });
                
                readStream.pipe(writeStream);
              }
            } catch (err) {
              console.error('Dosya taşıma hatası:', err);
              reject(err);
            }
          }, 500); // 500ms bekle
        })
        .save(tempFilePath);
    });

    res.json({ 
      success: true, 
      fileName,
      path: finalFilePath 
    });

  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: 'İndirme başarısız oldu' });
  }
});

app.post('/api/download-all', async (req, res) => {
  try {
    const { videos } = req.body;
    const results = [];
    const desktopPath = path.join(os.homedir(), 'Desktop');
    const playlistFolder = path.join(desktopPath, `Playlist_${Date.now()}`);
    
    if (!fs.existsSync(playlistFolder)) {
      fs.mkdirSync(playlistFolder, { recursive: true });
    }

    for (const video of videos) {
      try {
        const { videoId, title } = video;
        
        if (!ytdl.validateID(videoId)) {
          results.push({ videoId, success: false, error: 'Geçersiz ID' });
          continue;
        }

        // Türkçe karakterleri dönüştür
        const turkishChars: {[key: string]: string} = {
          'ç': 'c', 'Ç': 'C', 'ğ': 'g', 'Ğ': 'G', 'ı': 'i', 'İ': 'I',
          'ö': 'o', 'Ö': 'O', 'ş': 's', 'Ş': 'S', 'ü': 'u', 'Ü': 'U'
        };
        
        let asciiTitle = title;
        for (const [tr, en] of Object.entries(turkishChars)) {
          asciiTitle = asciiTitle.replace(new RegExp(tr, 'g'), en);
        }
        
        const sanitizedTitle = asciiTitle.replace(/[^a-zA-Z0-9\s-]/g, '').trim().substring(0, 80);
        const uniqueId = Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 5);
        const fileName = `${sanitizedTitle}_${uniqueId}.mp3`;
        
        // Geçici dosya
        const tempDir = os.tmpdir();
        const tempFileName = `temp_${uniqueId}.mp3`;
        const tempFilePath = path.join(tempDir, tempFileName);
        const finalFilePath = path.join(playlistFolder, fileName);

        const stream = ytdl(videoId, {
          quality: 'highestaudio',
          filter: 'audioonly'
        });

        await new Promise((resolve, reject) => {
          ffmpeg(stream)
            .audioBitrate(320)
            .toFormat('mp3')
            .on('error', (err) => {
              if (fs.existsSync(tempFilePath)) {
                fs.unlinkSync(tempFilePath);
              }
              reject(err);
            })
            .on('end', () => {
              setTimeout(() => {
                try {
                  if (!fs.existsSync(tempFilePath)) {
                    reject(new Error('Geçici dosya bulunamadı'));
                    return;
                  }
                  
                  if (!fs.existsSync(playlistFolder)) {
                    fs.mkdirSync(playlistFolder, { recursive: true });
                  }
                  
                  try {
                    fs.renameSync(tempFilePath, finalFilePath);
                    resolve(true);
                  } catch (moveErr) {
                    const readStream = fs.createReadStream(tempFilePath);
                    const writeStream = fs.createWriteStream(finalFilePath);
                    
                    readStream.on('error', reject);
                    writeStream.on('error', reject);
                    writeStream.on('finish', () => {
                      fs.unlinkSync(tempFilePath);
                      resolve(true);
                    });
                    
                    readStream.pipe(writeStream);
                  }
                } catch (err) {
                  reject(err);
                }
              }, 500);
            })
            .save(tempFilePath);
        });

        results.push({ videoId, success: true, fileName });
      } catch (error) {
        results.push({ videoId: video.videoId, success: false, error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }

    res.json({ 
      success: true, 
      folder: playlistFolder,
      results 
    });

  } catch (error) {
    console.error('Batch download error:', error);
    res.status(500).json({ error: 'Toplu indirme başarısız oldu' });
  }
});

app.listen(PORT, () => {
  console.log(`Server http://localhost:${PORT} adresinde çalışıyor`);
});