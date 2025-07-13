import React, { useState } from 'react';
import axios from 'axios';
import './App.css';

interface Video {
  id: string;
  title: string;
  author: string;
  duration: string;
  thumbnail: string;
}

interface Playlist {
  title: string;
  author: string;
  videos: Video[];
}

function App() {
  const [playlistUrl, setPlaylistUrl] = useState('');
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState<string[]>([]);
  const [error, setError] = useState('');

  const extractPlaylistId = (url: string): string => {
    const match = url.match(/[&?]list=([^&]+)/);
    return match ? match[1] : url;
  };

  const fetchPlaylist = async () => {
    if (!playlistUrl) {
      setError('Lütfen bir playlist URL\'si girin');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      const playlistId = extractPlaylistId(playlistUrl);
      const response = await axios.get(`http://localhost:5000/api/playlist/${playlistId}`);
      setPlaylist(response.data);
    } catch (err) {
      setError('Playlist yüklenemedi. Lütfen URL\'yi kontrol edin.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const downloadVideo = async (video: Video) => {
    setDownloading(prev => [...prev, video.id]);
    
    try {
      await axios.post('http://localhost:5000/api/download', {
        videoId: video.id,
        title: video.title
      });
      alert(`${video.title} başarıyla indirildi!`);
    } catch (err) {
      alert(`${video.title} indirilemedi!`);
      console.error(err);
    } finally {
      setDownloading(prev => prev.filter(id => id !== video.id));
    }
  };

  const downloadAll = async () => {
    if (!playlist) return;
    
    setLoading(true);
    try {
      const response = await axios.post('http://localhost:5000/api/download-all', {
        videos: playlist.videos.map(v => ({ videoId: v.id, title: v.title }))
      });
      
      const successful = response.data.results.filter((r: any) => r.success).length;
      alert(`${successful}/${playlist.videos.length} video başarıyla indirildi!`);
    } catch (err) {
      alert('Toplu indirme başarısız oldu!');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="App">
      <header className="header">
        <h1>YouTube Playlist MP3 İndirici</h1>
        <p>YouTube playlist'lerindeki müzikleri MP3 olarak indirin</p>
      </header>

      <div className="input-section">
        <div className="input-group">
          <input
            type="text"
            placeholder="YouTube Playlist URL'sini yapıştırın..."
            value={playlistUrl}
            onChange={(e) => setPlaylistUrl(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && fetchPlaylist()}
          />
          <button onClick={fetchPlaylist} disabled={loading}>
            {loading ? 'Yükleniyor...' : 'Playlist\'i Getir'}
          </button>
        </div>
        {error && <div className="error">{error}</div>}
      </div>

      {playlist && (
        <div className="playlist-section">
          <div className="playlist-header">
            <h2>{playlist.title}</h2>
            <p>by {playlist.author}</p>
            <button className="download-all-btn" onClick={downloadAll} disabled={loading}>
              Tümünü İndir ({playlist.videos.length} video)
            </button>
          </div>

          <div className="video-grid">
            {playlist.videos.map((video) => (
              <div key={video.id} className="video-card">
                <img src={video.thumbnail} alt={video.title} />
                <div className="video-info">
                  <h3>{video.title}</h3>
                  <p className="author">{video.author}</p>
                  <p className="duration">{video.duration}</p>
                </div>
                <button
                  className="download-btn"
                  onClick={() => downloadVideo(video)}
                  disabled={downloading.includes(video.id)}
                >
                  {downloading.includes(video.id) ? 'İndiriliyor...' : 'MP3 İndir'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <footer className="footer">
        <p>YouTube Playlist MP3 İndirici © 2024</p>
      </footer>
    </div>
  );
}

export default App;