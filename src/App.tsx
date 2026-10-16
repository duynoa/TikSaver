import React, { useState, useEffect, useRef } from 'react';
import {
  Download,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Repeat,
  Copy,
  Check,
  Trash2,
  ExternalLink,
  Sparkles,
  Layers,
  History as HistoryIcon,
  HelpCircle,
  Film,
  Music,
  Image as ImageIcon,
  Share2,
  Heart,
  MessageCircle,
  Eye,
  AlertCircle,
  RefreshCw,
  FolderDown,
  Globe,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { ParsedMedia, HistoryItem, BatchResultItem } from './types';

export default function App() {
  const [lang, setLang] = useState<'vi' | 'en'>('vi');
  const [activeTab, setActiveTab] = useState<'single' | 'batch' | 'history' | 'guide'>('single');
  const [urlInput, setUrlInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsedData, setParsedData] = useState<ParsedMedia | null>(null);
  const [copiedCaption, setCopiedCaption] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [downloadingFormat, setDownloadingFormat] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'video' | 'photos'>('video');

  // Video player controls
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoop, setIsLoop] = useState(true);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Audio player
  const [audioPlaying, setAudioPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Batch Mode
  const [batchInput, setBatchInput] = useState('');
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchResults, setBatchResults] = useState<BatchResultItem[]>([]);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null);

  // Download History
  const [history, setHistory] = useState<HistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem('tikdouyin_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Save history on change
  useEffect(() => {
    try {
      localStorage.setItem('tikdouyin_history', JSON.stringify(history));
    } catch (e) {
      console.warn('Failed to save history to localStorage', e);
    }
  }, [history]);

  // Handle URL detection pill
  const detectedPlatform = React.useMemo(() => {
    const text = urlInput.toLowerCase();
    if (text.includes('douyin.com') || text.includes('iesdouyin') || urlInput.includes('抖音')) {
      return 'douyin';
    }
    if (text.includes('tiktok.com') || text.includes('tiktokcdn')) {
      return 'tiktok';
    }
    return null;
  }, [urlInput]);

  // Format large numbers (e.g. 1.2M, 45.6K)
  const formatNumber = (num?: number): string => {
    if (num === undefined || num === null) return '0';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toLocaleString();
  };

  // Helper to add item to history
  const addToHistory = (item: ParsedMedia) => {
    setHistory((prev) => {
      const filtered = prev.filter((h) => h.id !== item.id);
      const newHistoryItem: HistoryItem = {
        id: item.id,
        platform: item.platform,
        title: item.title,
        cover: item.cover,
        videoUrl: item.videoUrl,
        hdVideoUrl: item.hdVideoUrl,
        musicUrl: item.musicUrl,
        downloadedAt: Date.now(),
        authorName: item.author.nickname || item.author.unique_id || 'Creator',
      };
      return [newHistoryItem, ...filtered].slice(0, 30); // keep last 30
    });
  };

  // Parse Single Video URL
  const handleParse = async (urlToParse?: string) => {
    const target = (urlToParse !== undefined ? urlToParse : urlInput).trim();
    if (!target) {
      setError(lang === 'vi' ? 'Vui lòng nhập hoặc dán liên kết video TikTok hoặc Douyin!' : 'Please enter or paste a TikTok or Douyin video link!');
      return;
    }

    setLoading(true);
    setError(null);
    setParsedData(null);
    setIsPlaying(false);
    setAudioPlaying(false);

    try {
      const res = await fetch('/api/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: target }),
      });

      const data = await res.json();
      if (res.ok && data.success && data.data) {
        setParsedData(data.data);
        if (data.data.images && data.data.images.length > 0 && !data.data.videoUrl) {
          setViewMode('photos');
        } else {
          setViewMode('video');
        }
        addToHistory(data.data);
      } else {
        setError(data.error || (lang === 'vi' ? 'Không thể tải video này. Vui lòng kiểm tra lại liên kết!' : 'Unable to parse this video. Please check the link!'));
      }
    } catch (err: unknown) {
      setError(lang === 'vi' ? 'Lỗi kết nối máy chủ. Vui lòng thử lại sau!' : 'Server connection error. Please try again!');
    } finally {
      setLoading(false);
    }
  };

  // Quick paste from clipboard
  const handlePaste = async () => {
    try {
      const clipText = await navigator.clipboard.readText();
      if (clipText) {
        setUrlInput(clipText);
        handleParse(clipText);
      }
    } catch {
      setError(lang === 'vi' ? 'Không thể truy cập Clipboard. Hãy dán trực tiếp bằng Ctrl+V hoặc nhấn giữ trên màn hình.' : 'Could not access clipboard. Please paste manually using Ctrl+V.');
    }
  };

  // Direct trigger download with safe file naming
  const triggerDownload = (url: string, filename: string, formatKey: string) => {
    setDownloadingFormat(formatKey);
    const downloadUrl = `/api/download?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(filename)}&platform=${parsedData?.platform || 'tiktok'}`;
    
    // Create an invisible link element to trigger browser download
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(() => {
      setDownloadingFormat(null);
    }, 2500);
  };

  // Copy caption
  const copyCaption = () => {
    if (!parsedData?.title) return;
    navigator.clipboard.writeText(parsedData.title);
    setCopiedCaption(true);
    setTimeout(() => setCopiedCaption(false), 2000);
  };

  // Copy direct stream link
  const copyDirectLink = () => {
    const stream = parsedData?.hdVideoUrl || parsedData?.videoUrl;
    if (!stream) return;
    const downloadUrl = `${window.location.origin}/api/download?url=${encodeURIComponent(stream)}&filename=${encodeURIComponent((parsedData.title || 'video').substring(0, 30))}.mp4`;
    navigator.clipboard.writeText(downloadUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // Toggle Video Play/Pause
  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play();
      setIsPlaying(true);
    }
  };

  // Toggle Audio Play/Pause
  const toggleAudio = () => {
    if (!audioRef.current) return;
    if (audioPlaying) {
      audioRef.current.pause();
      setAudioPlaying(false);
    } else {
      audioRef.current.play();
      setAudioPlaying(true);
    }
  };

  // Batch processing
  const handleBatchProcess = async () => {
    const rawLines = batchInput
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (rawLines.length === 0) {
      alert(lang === 'vi' ? 'Vui lòng nhập ít nhất 1 liên kết vào danh sách!' : 'Please enter at least 1 URL!');
      return;
    }

    setBatchLoading(true);
    setBatchResults([]);
    setBatchProgress({ current: 0, total: Math.min(rawLines.length, 10) });

    try {
      const res = await fetch('/api/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls: rawLines }),
      });

      const data = await res.json();
      if (res.ok && data.results) {
        setBatchResults(data.results);
        // Add successful batch items to history
        data.results.forEach((r: BatchResultItem) => {
          if (r.success && r.data) {
            addToHistory(r.data);
          }
        });
      } else {
        alert(data.error || 'Có lỗi xảy ra khi xử lý danh sách.');
      }
    } catch {
      alert(lang === 'vi' ? 'Lỗi kết nối máy chủ khi xử lý hàng loạt.' : 'Server connection error during batch processing.');
    } finally {
      setBatchLoading(false);
      setBatchProgress(null);
    }
  };

  // Load sample demo video
  const loadSample = (type: 'demo_tiktok' | 'demo_douyin' | 'demo_slide') => {
    setUrlInput(type);
    handleParse(type);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-pink-500 selection:text-white">
      {/* Background ambient lighting effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-10%] left-[20%] w-[500px] h-[500px] bg-cyan-500/10 rounded-full blur-[120px] animate-pulse-glow" />
        <div className="absolute top-[20%] right-[15%] w-[600px] h-[600px] bg-pink-500/10 rounded-full blur-[140px] animate-pulse-glow" style={{ animationDelay: '3s' }} />
        <div className="absolute bottom-[-10%] left-[30%] w-[600px] h-[400px] bg-indigo-500/10 rounded-full blur-[140px]" />
      </div>

      {/* Header Navigation */}
      <header className="relative z-10 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md sticky top-0 px-4 lg:px-8 py-3.5 transition-all">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => { setActiveTab('single'); }}>
            <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-400 via-pink-500 to-rose-500 p-[1.5px] shadow-lg shadow-pink-500/20">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <Download className="w-5 h-5 text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-pink-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg lg:text-xl tracking-tight bg-gradient-to-r from-cyan-300 via-white to-pink-400 bg-clip-text text-transparent">
                  TikDouyin HD
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-pink-500/20 text-pink-400 border border-pink-500/30">
                  NO WATERMARK
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                {lang === 'vi' ? 'Tải Video TikTok & Douyin MP4 Chuẩn Gốc' : 'Fast TikTok & Douyin MP4 Downloader'}
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-1.5 bg-slate-900/90 border border-slate-800 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('single')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                activeTab === 'single'
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Download className="w-3.5 h-3.5" />
              <span>{lang === 'vi' ? 'Tải Nhanh' : 'Single'}</span>
            </button>
            <button
              onClick={() => setActiveTab('batch')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                activeTab === 'batch'
                  ? 'bg-gradient-to-r from-pink-500 to-rose-600 text-white shadow-md shadow-pink-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{lang === 'vi' ? 'Tải Hàng Loạt' : 'Batch'}</span>
              <span className="sm:hidden">Batch</span>
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                activeTab === 'history'
                  ? 'bg-slate-800 text-cyan-400 border border-cyan-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <HistoryIcon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{lang === 'vi' ? 'Lịch Sử' : 'History'}</span>
              {history.length > 0 && (
                <span className="w-4 h-4 rounded-full bg-pink-500 text-white text-[10px] flex items-center justify-center font-bold">
                  {history.length > 9 ? '9+' : history.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('guide')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                activeTab === 'guide'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span className="hidden md:inline">{lang === 'vi' ? 'Hướng Dẫn' : 'Guide'}</span>
            </button>
          </div>

          {/* Language Switch */}
          <button
            onClick={() => setLang(lang === 'vi' ? 'en' : 'vi')}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-800 bg-slate-900/60 hover:bg-slate-800 text-xs text-slate-300 transition"
            title="Đổi ngôn ngữ / Switch language"
          >
            <Globe className="w-3.5 h-3.5 text-cyan-400" />
            <span className="font-semibold">{lang === 'vi' ? 'VI' : 'EN'}</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="relative z-10 flex-1 max-w-7xl w-full mx-auto px-4 lg:px-8 py-8 flex flex-col gap-8">
        {/* TAB 1: SINGLE DOWNLOADER */}
        {activeTab === 'single' && (
          <div className="flex flex-col gap-8">
            {/* Hero Banner */}
            <div className="text-center max-w-3xl mx-auto flex flex-col items-center gap-3 pt-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900/90 border border-slate-800 text-xs text-slate-300 shadow-sm">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                <span className="text-cyan-400 font-semibold">Tự động xóa watermark & logo</span>
                <span className="text-slate-500">•</span>
                <span>Hỗ trợ TikTok & Douyin 抖音</span>
              </div>

              <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white leading-tight">
                {lang === 'vi' ? (
                  <>
                    Tải Video <span className="bg-gradient-to-r from-cyan-400 via-teal-300 to-cyan-500 bg-clip-text text-transparent">TikTok</span> &{' '}
                    <span className="bg-gradient-to-r from-pink-500 via-rose-400 to-red-500 bg-clip-text text-transparent">Douyin</span> Không Logo
                  </>
                ) : (
                  <>
                    Download <span className="text-cyan-400">TikTok</span> & <span className="text-pink-500">Douyin</span> Videos No Watermark
                  </>
                )}
              </h1>

              <p className="text-slate-400 text-sm sm:text-base max-w-2xl">
                {lang === 'vi'
                  ? 'Lưu video chuẩn MP4 chất lượng cao Full HD / 2K, trích xuất nhạc nền MP3, và tải trọn bộ album ảnh không dính logo mờ hay ID tác giả.'
                  : 'Save high definition MP4 videos, extract MP3 audio tracks, and download slideshow photo albums with original resolution and zero watermarks.'}
              </p>

              {/* Supported Badges */}
              <div className="flex flex-wrap items-center justify-center gap-2 pt-1 text-xs text-slate-400">
                <span className="px-2.5 py-1 rounded-md bg-slate-900 border border-slate-800/80 flex items-center gap-1.5">
                  <Film className="w-3.5 h-3.5 text-cyan-400" /> MP4 High-Definition
                </span>
                <span className="px-2.5 py-1 rounded-md bg-slate-900 border border-slate-800/80 flex items-center gap-1.5">
                  <Music className="w-3.5 h-3.5 text-pink-400" /> Tách Âm Thanh MP3
                </span>
                <span className="px-2.5 py-1 rounded-md bg-slate-900 border border-slate-800/80 flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5 text-amber-400" /> Tải Album Ảnh Gốc
                </span>
                <span className="px-2.5 py-1 rounded-md bg-slate-900 border border-slate-800/80 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" /> 100% Miễn Phí
                </span>
              </div>
            </div>

            {/* Input Search Box Card */}
            <div className="max-w-3xl w-full mx-auto">
              <div className="relative group rounded-2xl p-[1.5px] bg-gradient-to-r from-cyan-500/40 via-pink-500/40 to-blue-500/40 focus-within:from-cyan-400 focus-within:via-pink-500 focus-within:to-blue-400 shadow-2xl shadow-cyan-500/10 transition-all">
                <div className="bg-slate-900/95 backdrop-blur-xl rounded-[15px] p-2.5 sm:p-3.5 flex flex-col gap-2.5">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 relative flex items-center">
                      <input
                        type="text"
                        value={urlInput}
                        onChange={(e) => {
                          setUrlInput(e.target.value);
                          if (error) setError(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleParse();
                        }}
                        placeholder={
                          lang === 'vi'
                            ? 'Dán liên kết TikTok hoặc Douyin vào đây (hỗ trợ v.douyin.com, vt.tiktok.com...)'
                            : 'Paste TikTok or Douyin link here (supports shortlinks, share text...)'
                        }
                        className="w-full bg-slate-950/80 border border-slate-800/80 rounded-xl px-4 py-3.5 text-sm sm:text-base text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/50 pr-24 transition-all"
                      />

                      {/* Clear & Paste button inside input */}
                      <div className="absolute right-2 flex items-center gap-1.5">
                        {urlInput && (
                          <button
                            onClick={() => {
                              setUrlInput('');
                              setError(null);
                            }}
                            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition"
                            title="Xóa"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={handlePaste}
                          type="button"
                          className="px-2.5 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-1 transition"
                          title="Dán từ Clipboard"
                        >
                          <Copy className="w-3.5 h-3.5 text-cyan-400" />
                          <span className="hidden sm:inline">Dán</span>
                        </button>
                      </div>
                    </div>

                    {/* Submit Button */}
                    <button
                      onClick={() => handleParse()}
                      disabled={loading || !urlInput.trim()}
                      className="px-5 sm:px-7 py-3.5 rounded-xl font-bold text-sm sm:text-base text-white bg-gradient-to-r from-cyan-500 via-teal-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-cyan-500/25 flex items-center justify-center gap-2 transition-all transform active:scale-[0.98] shrink-0"
                    >
                      {loading ? (
                        <>
                          <RefreshCw className="w-5 h-5 animate-spin" />
                          <span className="hidden sm:inline">{lang === 'vi' ? 'Đang phân tích...' : 'Parsing...'}</span>
                        </>
                      ) : (
                        <>
                          <Download className="w-5 h-5" />
                          <span>{lang === 'vi' ? 'Tải Ngay' : 'Download'}</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Auto-detect pill */}
                  {detectedPlatform && (
                    <div className="flex items-center justify-between text-xs px-2 pt-1">
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        {detectedPlatform === 'douyin' ? (
                          <span className="text-pink-400 font-medium">
                            🇨🇳 Đã nhận diện liên kết <strong>Douyin (抖音)</strong>
                          </span>
                        ) : (
                          <span className="text-cyan-400 font-medium">
                            🎵 Đã nhận diện liên kết <strong>TikTok Video</strong>
                          </span>
                        )}
                      </div>
                      <span className="text-slate-500 text-[11px]">Sẵn sàng lọc watermark</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Sample demo links */}
              <div className="mt-3.5 flex flex-wrap items-center justify-center gap-2 text-xs">
                <span className="text-slate-500 font-medium mr-1">
                  {lang === 'vi' ? 'Thử link mẫu:' : 'Try sample links:'}
                </span>
                <button
                  onClick={() => {
                    setUrlInput('https://v.douyin.com/YO3X4d1_8bQ/');
                    handleParse('https://v.douyin.com/YO3X4d1_8bQ/');
                  }}
                  className="px-3 py-1 rounded-full bg-slate-900 border border-pink-500/40 hover:border-pink-400 hover:bg-slate-800 text-pink-300 hover:text-white transition flex items-center gap-1.5 font-medium"
                >
                  <span>🇨🇳 Douyin (Link của bạn: YO3X4d1_8bQ)</span>
                </button>
                <button
                  onClick={() => loadSample('demo_tiktok')}
                  className="px-3 py-1 rounded-full bg-slate-900 border border-slate-800 hover:border-cyan-500/50 hover:bg-slate-800 text-slate-300 hover:text-cyan-300 transition flex items-center gap-1.5"
                >
                  <span>🎵 TikTok (Vịnh Hạ Long 4K)</span>
                </button>
                <button
                  onClick={() => loadSample('demo_douyin')}
                  className="px-3 py-1 rounded-full bg-slate-900 border border-slate-800 hover:border-pink-500/50 hover:bg-slate-800 text-slate-300 hover:text-pink-300 transition flex items-center gap-1.5"
                >
                  <span>🇨🇳 Douyin (Trùng Khánh 4K)</span>
                </button>
                <button
                  onClick={() => loadSample('demo_slide')}
                  className="px-3 py-1 rounded-full bg-slate-900 border border-slate-800 hover:border-amber-500/50 hover:bg-slate-800 text-slate-300 hover:text-amber-300 transition flex items-center gap-1.5"
                >
                  <span>🌸 TikTok Album Ảnh</span>
                </button>
              </div>

              {/* Error message alert */}
              {error && (
                <div className="mt-4 p-4 rounded-xl bg-red-950/40 border border-red-800/80 text-red-200 text-sm flex flex-col gap-2.5 animate-fadeIn">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-semibold text-red-300">{error}</p>
                      <p className="text-xs text-red-400/80 mt-1">
                        {lang === 'vi'
                          ? 'Gợi ý: Kiểm tra xem video có đang để ở chế độ công khai không, hoặc bấm thử các liên kết mẫu bên dưới để kiểm tra công cụ.'
                          : 'Tip: Ensure the video is public, or try the sample links below to test the tool.'}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-red-900/40">
                    <span className="text-[11px] text-red-300 font-medium">
                      {lang === 'vi' ? 'Thử ngay mẫu hoạt động:' : 'Try verified samples:'}
                    </span>
                    <button
                      onClick={() => loadSample('demo_tiktok')}
                      className="px-2.5 py-1 rounded-lg bg-red-900/40 hover:bg-red-800/60 border border-red-700/60 text-xs text-red-200 hover:text-white transition"
                    >
                      🎵 TikTok Mẫu
                    </button>
                    <button
                      onClick={() => loadSample('demo_douyin')}
                      className="px-2.5 py-1 rounded-lg bg-red-900/40 hover:bg-red-800/60 border border-red-700/60 text-xs text-red-200 hover:text-white transition"
                    >
                      🇨🇳 Douyin Mẫu
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* RESULTS CARD SECTION */}
            {parsedData && (
              <div className="max-w-5xl w-full mx-auto rounded-3xl bg-slate-900/90 border border-slate-800 p-5 sm:p-7 shadow-2xl backdrop-blur-xl animate-fadeIn">
                {/* Status Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 pb-5 border-b border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                      <Check className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-base sm:text-lg flex items-center gap-2">
                        {lang === 'vi' ? 'Video Đã Sẵn Sàng Để Tải Về' : 'Video Ready For Download'}
                        <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-semibold">
                          No Watermark MP4
                        </span>
                      </h3>
                      <p className="text-xs text-slate-400">
                        Nguồn: {parsedData.platform === 'douyin' ? 'Douyin (抖音 Trung Quốc)' : 'TikTok Global'} • Định dạng: MP4 High Definition
                      </p>
                    </div>
                  </div>

                  {/* Platform Tag */}
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider ${
                        parsedData.platform === 'douyin'
                          ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white'
                          : 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white'
                      }`}
                    >
                      {parsedData.platform === 'douyin' ? '🇨🇳 Douyin 抖音' : '🎵 TikTok'}
                    </span>
                  </div>
                </div>

                {/* Main Content Grid: Preview vs Downloads */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-6">
                  {/* Left Column: Media Player (5 cols) */}
                  <div className="lg:col-span-5 flex flex-col gap-3">
                    {/* Media Type Switcher (if photos exist) */}
                    {parsedData.images && parsedData.images.length > 0 && (
                      <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
                        <button
                          onClick={() => setViewMode('video')}
                          className={`flex-1 py-1.5 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition ${
                            viewMode === 'video' ? 'bg-cyan-500 text-white shadow' : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          <Film className="w-3.5 h-3.5" /> Video Preview
                        </button>
                        <button
                          onClick={() => setViewMode('photos')}
                          className={`flex-1 py-1.5 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition ${
                            viewMode === 'photos' ? 'bg-pink-500 text-white shadow' : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          <ImageIcon className="w-3.5 h-3.5" /> Album Ảnh ({parsedData.images.length})
                        </button>
                      </div>
                    )}

                    {/* Video Player Box */}
                    {viewMode === 'video' ? (
                      <div className="relative rounded-2xl overflow-hidden bg-black border border-slate-800 shadow-xl aspect-[9/16] max-h-[520px] mx-auto w-full flex items-center justify-center group">
                        <video
                          ref={videoRef}
                          src={parsedData.hdVideoUrl || parsedData.videoUrl}
                          poster={parsedData.cover}
                          loop={isLoop}
                          muted={isMuted}
                          playsInline
                          onClick={togglePlay}
                          onPlay={() => setIsPlaying(true)}
                          onPause={() => setIsPlaying(false)}
                          className="w-full h-full object-contain cursor-pointer"
                        />

                        {/* Play/Pause Overlay Button */}
                        {!isPlaying && (
                          <button
                            onClick={togglePlay}
                            className="absolute inset-0 m-auto w-16 h-16 rounded-full bg-slate-900/80 backdrop-blur-md border border-white/20 text-white flex items-center justify-center shadow-2xl hover:scale-110 transition-transform group-hover:bg-cyan-500"
                            title="Phát video"
                          >
                            <Play className="w-7 h-7 fill-white translate-x-0.5" />
                          </button>
                        )}

                        {/* Bottom Custom Overlay Controls */}
                        <div className="absolute bottom-0 inset-x-0 p-3 bg-gradient-to-t from-black/90 via-black/40 to-transparent flex items-center justify-between text-white text-xs opacity-90 group-hover:opacity-100 transition-opacity">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={togglePlay}
                              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition"
                            >
                              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-white" />}
                            </button>
                            <button
                              onClick={() => {
                                if (videoRef.current) {
                                  videoRef.current.muted = !isMuted;
                                  setIsMuted(!isMuted);
                                }
                              }}
                              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition"
                            >
                              {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
                            </button>
                            <button
                              onClick={() => setIsLoop(!isLoop)}
                              className={`p-1.5 rounded-lg transition ${isLoop ? 'bg-cyan-500 text-white' : 'bg-white/10 hover:bg-white/20 text-slate-300'}`}
                              title={isLoop ? 'Tự động phát lại: Bật' : 'Tự động phát lại: Tắt'}
                            >
                              <Repeat className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded bg-black/60 font-mono text-[10px] text-cyan-300 border border-cyan-500/30">
                              HD NO WATERMARK
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* Photos Album Gallery Mode */
                      <div className="flex flex-col gap-3">
                        <div className="grid grid-cols-2 gap-2 max-h-[480px] overflow-y-auto pr-1">
                          {parsedData.images?.map((imgUrl, idx) => (
                            <div key={idx} className="relative rounded-xl overflow-hidden bg-slate-950 border border-slate-800 aspect-square group">
                              <img src={imgUrl} alt={`Slide ${idx + 1}`} className="w-full h-full object-cover" />
                              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                <button
                                  onClick={() =>
                                    triggerDownload(
                                      imgUrl,
                                      `[TikTok_Slide_${idx + 1}]_${parsedData.id}.jpg`,
                                      `photo_${idx}`
                                    )
                                  }
                                  className="p-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-white text-xs font-bold flex items-center gap-1 shadow-lg"
                                >
                                  <Download className="w-3.5 h-3.5" /> Tải ảnh
                                </button>
                              </div>
                              <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-black/70 text-[10px] font-bold text-white">
                                #{idx + 1}
                              </span>
                            </div>
                          ))}
                        </div>

                        {/* Bulk download all photos button */}
                        {parsedData.images && (
                          <button
                            onClick={() => {
                              parsedData.images?.forEach((imgUrl, i) => {
                                setTimeout(() => {
                                  triggerDownload(imgUrl, `[Photo_${i + 1}]_${parsedData.id}.jpg`, `bulk_${i}`);
                                }, i * 400);
                              });
                            }}
                            className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-cyan-400 flex items-center justify-center gap-2 border border-cyan-500/30 transition"
                          >
                            <FolderDown className="w-4 h-4" />
                            {lang === 'vi' ? `Tải Tất Cả ${parsedData.images.length} Ảnh Về Máy` : `Download All ${parsedData.images.length} Photos`}
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Right Column: Video Details & Download Center (7 cols) */}
                  <div className="lg:col-span-7 flex flex-col justify-between gap-5">
                    <div className="flex flex-col gap-4">
                      {/* Author Info */}
                      <div className="flex items-center gap-3 bg-slate-950/70 border border-slate-800/80 p-3.5 rounded-2xl">
                        <img
                          src={parsedData.author.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=150'}
                          alt={parsedData.author.nickname}
                          className="w-12 h-12 rounded-full object-cover ring-2 ring-pink-500/40 p-0.5 shrink-0"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=150';
                          }}
                        />
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-white text-sm sm:text-base truncate">
                            {parsedData.author.nickname || 'Unknown Creator'}
                          </h4>
                          <p className="text-xs text-slate-400 truncate">
                            @{parsedData.author.unique_id || 'creator'}
                          </p>
                        </div>
                        <a
                          href={parsedData.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition flex items-center gap-1 text-xs"
                          title="Xem liên kết gốc"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Gốc</span>
                        </a>
                      </div>

                      {/* Video Title & Caption Box */}
                      <div className="bg-slate-950/70 border border-slate-800/80 p-4 rounded-2xl flex flex-col gap-2">
                        <div className="flex items-center justify-between text-xs text-slate-400">
                          <span className="font-semibold uppercase tracking-wider text-[11px] text-cyan-400">
                            Tiêu Đề & Nội Dung Caption
                          </span>
                          <button
                            onClick={copyCaption}
                            className="flex items-center gap-1 text-slate-400 hover:text-cyan-300 transition"
                          >
                            {copiedCaption ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                            <span>{copiedCaption ? (lang === 'vi' ? 'Đã chép' : 'Copied') : (lang === 'vi' ? 'Sao chép' : 'Copy')}</span>
                          </button>
                        </div>
                        <p className="text-sm text-slate-200 line-clamp-4 leading-relaxed select-text font-normal">
                          {parsedData.title || (lang === 'vi' ? 'Không có chú thích' : 'No description')}
                        </p>
                      </div>

                      {/* Engagement Metrics Stats */}
                      <div className="grid grid-cols-4 gap-2">
                        <div className="bg-slate-950/60 border border-slate-800/70 p-2.5 rounded-xl text-center">
                          <div className="flex items-center justify-center text-cyan-400 mb-1">
                            <Eye className="w-3.5 h-3.5" />
                          </div>
                          <span className="block font-bold text-xs sm:text-sm text-white">
                            {formatNumber(parsedData.stats.plays)}
                          </span>
                          <span className="text-[10px] text-slate-500 uppercase">Lượt xem</span>
                        </div>
                        <div className="bg-slate-950/60 border border-slate-800/70 p-2.5 rounded-xl text-center">
                          <div className="flex items-center justify-center text-pink-400 mb-1">
                            <Heart className="w-3.5 h-3.5" />
                          </div>
                          <span className="block font-bold text-xs sm:text-sm text-white">
                            {formatNumber(parsedData.stats.likes)}
                          </span>
                          <span className="text-[10px] text-slate-500 uppercase">Thích</span>
                        </div>
                        <div className="bg-slate-950/60 border border-slate-800/70 p-2.5 rounded-xl text-center">
                          <div className="flex items-center justify-center text-amber-400 mb-1">
                            <MessageCircle className="w-3.5 h-3.5" />
                          </div>
                          <span className="block font-bold text-xs sm:text-sm text-white">
                            {formatNumber(parsedData.stats.comments)}
                          </span>
                          <span className="text-[10px] text-slate-500 uppercase">Bình luận</span>
                        </div>
                        <div className="bg-slate-950/60 border border-slate-800/70 p-2.5 rounded-xl text-center">
                          <div className="flex items-center justify-center text-emerald-400 mb-1">
                            <Share2 className="w-3.5 h-3.5" />
                          </div>
                          <span className="block font-bold text-xs sm:text-sm text-white">
                            {formatNumber(parsedData.stats.shares)}
                          </span>
                          <span className="text-[10px] text-slate-500 uppercase">Chia sẻ</span>
                        </div>
                      </div>

                      {/* Music Audio Bar (if available) */}
                      {parsedData.musicUrl && (
                        <div className="bg-slate-950/60 border border-slate-800/80 p-3 rounded-2xl flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-pink-500/20 text-pink-400 flex items-center justify-center shrink-0">
                              <Music className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-white truncate">
                                {parsedData.musicTitle || 'Âm thanh gốc'}
                              </p>
                              <p className="text-[11px] text-slate-400 truncate">
                                {parsedData.musicAuthor || parsedData.author.nickname}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <audio ref={audioRef} src={parsedData.musicUrl} onEnded={() => setAudioPlaying(false)} />
                            <button
                              onClick={toggleAudio}
                              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 flex items-center gap-1.5 transition"
                              title="Nghe thử âm thanh"
                            >
                              {audioPlaying ? <Pause className="w-3.5 h-3.5 text-pink-400" /> : <Play className="w-3.5 h-3.5" />}
                              <span className="hidden sm:inline">{audioPlaying ? 'Dừng' : 'Nghe thử'}</span>
                            </button>
                            <button
                              onClick={() =>
                                triggerDownload(
                                  parsedData.musicUrl!,
                                  `[Audio]_${(parsedData.musicTitle || 'sound').substring(0, 30)}.mp3`,
                                  'audio'
                                )
                              }
                              className="px-3 py-1.5 rounded-lg bg-pink-600 hover:bg-pink-500 text-xs font-bold text-white flex items-center gap-1.5 transition shadow"
                              title="Tải tệp âm thanh MP3"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>Tải MP3</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* DOWNLOAD ACTION BUTTONS CENTER */}
                    <div className="flex flex-col gap-2.5 pt-2 border-t border-slate-800/80">
                      <div className="flex items-center justify-between text-xs text-slate-400 pb-1">
                        <span className="font-semibold text-white flex items-center gap-1.5">
                          <Download className="w-4 h-4 text-cyan-400" />
                          {lang === 'vi' ? 'Tùy chọn tải về định dạng MP4 & Audio:' : 'Download Options:'}
                        </span>
                        {downloadingFormat && (
                          <span className="text-xs text-emerald-400 font-semibold animate-pulse">
                            ⏳ Đang bắt đầu tải tệp về máy...
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {/* Primary Button: MP4 No Watermark HD */}
                        <button
                          onClick={() =>
                            triggerDownload(
                              parsedData.hdVideoUrl || parsedData.videoUrl,
                              `[NoWatermark]_${(parsedData.title || 'video').substring(0, 30)}.mp4`,
                              'mp4_hd'
                            )
                          }
                          disabled={downloadingFormat === 'mp4_hd'}
                          className="py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-[0.98] transition group"
                        >
                          <Download className="w-4 h-4 group-hover:translate-y-0.5 transition-transform" />
                          <span>{lang === 'vi' ? 'Tải MP4 Không Watermark' : 'Download MP4 No Watermark'}</span>
                        </button>

                        {/* Button 2: MP4 Full HD Super Clean */}
                        <button
                          onClick={() =>
                            triggerDownload(
                              parsedData.hdVideoUrl || parsedData.videoUrl,
                              `[FullHD]_${(parsedData.title || 'video').substring(0, 30)}.mp4`,
                              'mp4_fullhd'
                            )
                          }
                          disabled={downloadingFormat === 'mp4_fullhd'}
                          className="py-3.5 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20 active:scale-[0.98] transition group"
                        >
                          <Sparkles className="w-4 h-4 group-hover:rotate-12 transition-transform" />
                          <span>{lang === 'vi' ? 'Tải MP4 Full HD (Siêu Nét)' : 'Download MP4 Full HD'}</span>
                        </button>

                        {/* Button 3: Extract Audio MP3 */}
                        {parsedData.musicUrl && (
                          <button
                            onClick={() =>
                              triggerDownload(
                                parsedData.musicUrl!,
                                `[Music]_${(parsedData.title || 'audio').substring(0, 30)}.mp3`,
                                'mp3'
                              )
                            }
                            className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-pink-400 hover:text-pink-300 font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition"
                          >
                            <Music className="w-4 h-4" />
                            <span>{lang === 'vi' ? 'Tải Âm Thanh MP3' : 'Extract MP3 Audio'}</span>
                          </button>
                        )}

                        {/* Button 4: Download Cover Image */}
                        {parsedData.cover && (
                          <button
                            onClick={() =>
                              triggerDownload(
                                parsedData.cover,
                                `[Cover]_${parsedData.id}.jpg`,
                                'cover'
                              )
                            }
                            className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-amber-400 hover:text-amber-300 font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition"
                          >
                            <ImageIcon className="w-4 h-4" />
                            <span>{lang === 'vi' ? 'Tải Ảnh Bìa (Cover HD)' : 'Download HD Cover'}</span>
                          </button>
                        )}

                        {/* Button 5: Original Watermarked Video (Optional) */}
                        {parsedData.wmVideoUrl && (
                          <button
                            onClick={() =>
                              triggerDownload(
                                parsedData.wmVideoUrl!,
                                `[Original_Watermark]_${parsedData.id}.mp4`,
                                'wm'
                              )
                            }
                            className="py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 text-xs flex items-center justify-center gap-2 transition"
                          >
                            <Film className="w-3.5 h-3.5" />
                            <span>{lang === 'vi' ? 'Tải Bản Gốc (Có Logo)' : 'Download With Watermark'}</span>
                          </button>
                        )}

                        {/* Button 6: Copy Direct Link */}
                        <button
                          onClick={copyDirectLink}
                          className="py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-cyan-300 text-xs flex items-center justify-center gap-2 transition"
                        >
                          {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedLink ? (lang === 'vi' ? 'Đã sao chép link!' : 'Link copied!') : (lang === 'vi' ? 'Sao chép link tải' : 'Copy download link')}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: BATCH DOWNLOADER */}
        {activeTab === 'batch' && (
          <div className="max-w-4xl w-full mx-auto flex flex-col gap-6">
            <div className="text-center max-w-2xl mx-auto flex flex-col gap-2">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
                {lang === 'vi' ? 'Tải Hàng Loạt Video TikTok & Douyin' : 'Batch TikTok & Douyin Downloader'}
              </h2>
              <p className="text-slate-400 text-xs sm:text-sm">
                {lang === 'vi'
                  ? 'Dán nhiều liên kết cùng lúc (mỗi dòng một liên kết, tối đa 10 video). Hệ thống sẽ tự động lọc watermark cho tất cả!'
                  : 'Paste multiple links (one per line, up to 10 URLs). All watermark-free videos will be parsed concurrently!'}
              </p>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col gap-4">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-semibold text-slate-300">
                  {lang === 'vi' ? 'Danh sách liên kết (mỗi dòng 1 URL):' : 'URL List (one per line):'}
                </span>
                <button
                  onClick={() =>
                    setBatchInput(
                      `https://www.tiktok.com/@vietnam_traveler/video/7311927451725401375\nhttps://v.douyin.com/iRoCyberpunk/\nhttps://www.tiktok.com/@sakura_art/video/7200000000000000000`
                    )
                  }
                  className="text-xs text-cyan-400 hover:text-cyan-300 underline"
                >
                  {lang === 'vi' ? 'Nạp danh sách mẫu' : 'Load sample URLs'}
                </button>
              </div>

              <textarea
                value={batchInput}
                onChange={(e) => setBatchInput(e.target.value)}
                rows={5}
                placeholder={
                  lang === 'vi'
                    ? 'https://vt.tiktok.com/ZSxxxx/\nhttps://v.douyin.com/iRoxxxx/\nhttps://www.tiktok.com/@user/video/...'
                    : 'https://vt.tiktok.com/ZSxxxx/\nhttps://v.douyin.com/iRoxxxx/\n...'
                }
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-pink-500 font-mono"
              />

              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-slate-500">
                  {batchInput.split('\n').filter((l) => l.trim().length > 0).length} / 10 liên kết
                </span>

                <button
                  onClick={handleBatchProcess}
                  disabled={batchLoading || !batchInput.trim()}
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-400 hover:to-rose-500 disabled:opacity-50 text-white font-bold text-sm flex items-center gap-2 shadow-lg shadow-pink-500/20 transition active:scale-[0.98]"
                >
                  {batchLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>{lang === 'vi' ? 'Đang xử lý hàng loạt...' : 'Processing batch...'}</span>
                    </>
                  ) : (
                    <>
                      <Layers className="w-4 h-4" />
                      <span>{lang === 'vi' ? 'Bắt Đầu Phân Tích' : 'Start Batch Process'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Batch Progress */}
            {batchProgress && (
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col gap-2 animate-fadeIn">
                <div className="flex items-center justify-between text-xs text-slate-300 font-medium">
                  <span>{lang === 'vi' ? 'Đang phân tích danh sách...' : 'Analyzing batch list...'}</span>
                  <span className="text-cyan-400">{batchProgress.total} video</span>
                </div>
                <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
                  <div className="bg-gradient-to-r from-cyan-400 to-pink-500 h-full w-full animate-pulse" />
                </div>
              </div>
            )}

            {/* Batch Results Grid */}
            {batchResults.length > 0 && (
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-white text-base">
                    {lang === 'vi' ? 'Kết quả xử lý:' : 'Batch Results:'} ({batchResults.filter((b) => b.success).length}/{batchResults.length})
                  </h3>
                  {batchResults.some((b) => b.success) && (
                    <button
                      onClick={() => {
                        batchResults.forEach((b, idx) => {
                          if (b.success && b.data) {
                            setTimeout(() => {
                              triggerDownload(
                                b.data?.hdVideoUrl || b.data?.videoUrl || '',
                                `[Batch_${idx + 1}]_${(b.data?.title || 'video').substring(0, 25)}.mp4`,
                                `batch_${idx}`
                              );
                            }, idx * 600);
                          }
                        });
                      }}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow"
                    >
                      <FolderDown className="w-4 h-4" />
                      {lang === 'vi' ? 'Tải Toàn Bộ Video Thành Công' : 'Download All Success MP4s'}
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {batchResults.map((item, idx) => (
                    <div
                      key={idx}
                      className={`p-4 rounded-2xl border transition-all ${
                        item.success
                          ? 'bg-slate-900/90 border-slate-800'
                          : 'bg-red-950/20 border-red-900/40 text-red-300'
                      }`}
                    >
                      {item.success && item.data ? (
                        <div className="flex items-center gap-3">
                          <img
                            src={item.data.cover}
                            alt=""
                            className="w-16 h-20 rounded-xl object-cover bg-slate-950 shrink-0 border border-slate-800"
                          />
                          <div className="flex-1 min-w-0 flex flex-col justify-between h-20">
                            <div>
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
                                  item.data.platform === 'douyin' ? 'bg-pink-500/20 text-pink-400' : 'bg-cyan-500/20 text-cyan-400'
                                }`}
                              >
                                {item.data.platform}
                              </span>
                              <h5 className="font-semibold text-white text-xs truncate mt-1">
                                {item.data.title || 'Video'}
                              </h5>
                              <p className="text-[11px] text-slate-400 truncate">
                                @{item.data.author.unique_id}
                              </p>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                onClick={() =>
                                  triggerDownload(
                                    item.data?.hdVideoUrl || item.data?.videoUrl || '',
                                    `[Batch_${idx + 1}]_${item.data?.id}.mp4`,
                                    `b_${idx}`
                                  )
                                }
                                className="px-3 py-1 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-white text-xs font-bold flex items-center gap-1 shadow"
                              >
                                <Download className="w-3 h-3" /> Tải MP4
                              </button>
                              {item.data.musicUrl && (
                                <button
                                  onClick={() =>
                                    triggerDownload(
                                      item.data?.musicUrl || '',
                                      `[Music_${idx + 1}].mp3`,
                                      `bm_${idx}`
                                    )
                                  }
                                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-pink-400 text-xs font-semibold"
                                >
                                  MP3
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs font-semibold truncate">{item.raw}</p>
                            <p className="text-[11px] text-red-400">{item.error || 'Thất bại'}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: DOWNLOAD HISTORY */}
        {activeTab === 'history' && (
          <div className="max-w-4xl w-full mx-auto flex flex-col gap-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-2xl font-extrabold text-white flex items-center gap-2">
                  <HistoryIcon className="w-6 h-6 text-cyan-400" />
                  {lang === 'vi' ? 'Lịch Sử Video Đã Tải' : 'Download History'}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {lang === 'vi'
                    ? 'Lưu trữ các video bạn vừa phân tích hoặc tải về trên trình duyệt này'
                    : 'Recent videos analyzed and downloaded in your browser'}
                </p>
              </div>

              {history.length > 0 && (
                <button
                  onClick={() => {
                    if (confirm(lang === 'vi' ? 'Bạn có chắc chắn muốn xóa toàn bộ lịch sử không?' : 'Are you sure you want to clear all history?')) {
                      setHistory([]);
                    }
                  }}
                  className="px-3 py-1.5 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs font-medium flex items-center gap-1.5 transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{lang === 'vi' ? 'Xóa Lịch Sử' : 'Clear All'}</span>
                </button>
              )}
            </div>

            {history.length === 0 ? (
              <div className="py-16 text-center flex flex-col items-center justify-center gap-3 bg-slate-900/40 border border-slate-800/80 rounded-2xl">
                <div className="w-14 h-14 rounded-2xl bg-slate-800 flex items-center justify-center text-slate-500">
                  <HistoryIcon className="w-7 h-7" />
                </div>
                <h4 className="font-bold text-slate-300 text-base">
                  {lang === 'vi' ? 'Chưa có lịch sử tải video' : 'No download history yet'}
                </h4>
                <p className="text-xs text-slate-500 max-w-sm">
                  {lang === 'vi'
                    ? 'Khi bạn dán link và phân tích video TikTok hoặc Douyin, danh sách sẽ tự động lưu lại ở đây để tải lại nhanh chóng.'
                    : 'Videos you download will appear here so you can easily access and re-download them anytime.'}
                </p>
                <button
                  onClick={() => setActiveTab('single')}
                  className="mt-2 px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-white font-bold text-xs"
                >
                  {lang === 'vi' ? 'Tải video ngay' : 'Download a video now'}
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {history.map((item) => (
                  <div
                    key={item.id}
                    className="group bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden hover:border-cyan-500/40 transition-all flex flex-col justify-between"
                  >
                    <div className="relative aspect-video bg-black overflow-hidden">
                      <img
                        src={item.cover}
                        alt={item.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <span
                        className={`absolute top-2 left-2 px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          item.platform === 'douyin' ? 'bg-pink-600 text-white' : 'bg-cyan-600 text-white'
                        }`}
                      >
                        {item.platform}
                      </span>
                      <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/70 text-[10px] text-slate-300 font-mono">
                        {new Date(item.downloadedAt).toLocaleDateString()}
                      </span>
                    </div>

                    <div className="p-3.5 flex flex-col gap-2.5 flex-1 justify-between">
                      <div>
                        <h5 className="font-semibold text-white text-xs line-clamp-2 leading-snug">
                          {item.title}
                        </h5>
                        <p className="text-[11px] text-slate-400 mt-1 truncate">
                          @{item.authorName}
                        </p>
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
                        <button
                          onClick={() => {
                            setUrlInput(item.id);
                            handleParse(item.id);
                            setActiveTab('single');
                          }}
                          className="px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-white text-xs font-bold flex items-center gap-1 shadow"
                        >
                          <Download className="w-3.5 h-3.5" /> Tải Lại
                        </button>
                        <button
                          onClick={() => {
                            setHistory((prev) => prev.filter((h) => h.id !== item.id));
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800 transition"
                          title="Xóa khỏi lịch sử"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: GUIDE & FAQ */}
        {activeTab === 'guide' && (
          <div className="max-w-4xl w-full mx-auto flex flex-col gap-8">
            <div className="text-center max-w-2xl mx-auto flex flex-col gap-2">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
                {lang === 'vi' ? 'Hướng Dẫn Sử Dụng & Câu Hỏi Thường Gặp' : 'Usage Guide & FAQ'}
              </h2>
              <p className="text-slate-400 text-xs sm:text-sm">
                {lang === 'vi'
                  ? 'Mọi thông tin bạn cần biết về cách lấy link và lưu trữ video không logo về điện thoại & máy tính'
                  : 'Everything you need to know about copying links and saving watermark-free clips'}
              </p>
            </div>

            {/* 3 Step Tutorial */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 flex flex-col gap-3 relative overflow-hidden">
                <span className="text-4xl font-extrabold text-slate-800 absolute right-3 top-2 select-none">
                  01
                </span>
                <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold">
                  <Share2 className="w-5 h-5" />
                </div>
                <h4 className="font-bold text-white text-base">Bước 1: Sao chép link</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Mở ứng dụng TikTok hoặc Douyin (抖音), nhấn vào nút <strong>Chia sẻ (Share / 分享)</strong> trên video rồi chọn <strong>Sao chép liên kết (Copy Link / 复制链接)</strong>.
                </p>
              </div>

              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 flex flex-col gap-3 relative overflow-hidden">
                <span className="text-4xl font-extrabold text-slate-800 absolute right-3 top-2 select-none">
                  02
                </span>
                <div className="w-10 h-10 rounded-xl bg-pink-500/20 text-pink-400 flex items-center justify-center font-bold">
                  <Sparkles className="w-5 h-5" />
                </div>
                <h4 className="font-bold text-white text-base">Bước 2: Dán vào công cụ</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Quay lại trang này, dán liên kết vừa sao chép vào ô tìm kiếm hoặc nhấn nút <strong>Dán</strong>. Nhấn <strong>Tải Ngay</strong> để hệ thống tự động bóc tách logo.
                </p>
              </div>

              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 flex flex-col gap-3 relative overflow-hidden">
                <span className="text-4xl font-extrabold text-slate-800 absolute right-3 top-2 select-none">
                  03
                </span>
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                  <Download className="w-5 h-5" />
                </div>
                <h4 className="font-bold text-white text-base">Bước 3: Lưu về máy</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Nhấn <strong>Tải MP4 Không Watermark</strong> để lưu video sắc nét, hoặc chọn <strong>Tải Âm Thanh MP3</strong> để chỉ lấy nhạc nền.
                </p>
              </div>
            </div>

            {/* Platform instructions accordion */}
            <div className="flex flex-col gap-3 bg-slate-900/60 border border-slate-800 p-6 rounded-2xl">
              <h3 className="font-bold text-white text-lg flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-cyan-400" />
                Các câu hỏi phổ biến (FAQ)
              </h3>

              <div className="flex flex-col gap-3 mt-2 text-sm text-slate-300">
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80">
                  <h5 className="font-bold text-white text-sm">
                    📱 Làm sao để lưu video vào Bộ sưu tập (Photos) trên iPhone / iPad?
                  </h5>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Trên iPhone dùng trình duyệt Safari: Khi bấm "Tải MP4", Safari sẽ hiển thị thông báo tải về. Sau khi tải xong, nhấn vào biểu tượng Mũi tên tải xuống ở thanh địa chỉ Safari, chọn tệp vừa tải và bấm nút Chia sẻ (Share) &rarr; chọn <strong>Lưu video (Save Video)</strong> để chuyển vào ứng dụng Ảnh.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80">
                  <h5 className="font-bold text-white text-sm">
                    🇨🇳 Tool có hỗ trợ Douyin (Tiktok nội địa Trung Quốc) không?
                  </h5>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Có! Hỗ trợ đầy đủ tất cả các định dạng link Douyin như <code>v.douyin.com/...</code>, <code>douyin.com/video/...</code> và cả toàn bộ chuỗi ký tự tiếng Trung kèm link khi bạn bấm Chia sẻ từ app Douyin.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80">
                  <h5 className="font-bold text-white text-sm">
                    ✨ Video tải về có bị giảm chất lượng không?
                  </h5>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Không! Video được trích xuất trực tiếp từ máy chủ gốc của TikTok và Douyin với độ phân giải cao nhất (1080p Full HD hoặc 2K) mà tác giả đã đăng tải, hoàn toàn không bị nén lại.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80">
                  <h5 className="font-bold text-white text-sm">
                    🔒 Sử dụng công cụ này có cần đăng nhập tài khoản không?
                  </h5>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Hoàn toàn không cần đăng nhập hay cài đặt bất kỳ phần mềm nào. Mọi thao tác xử lý hoàn toàn miễn phí, an toàn và bảo mật thông tin.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-slate-900 bg-slate-950 px-4 py-8 mt-12 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-300">TikDouyin HD Downloader</span>
            <span>•</span>
            <span>MP4 No Watermark • MP3 Extract • HD Slideshow</span>
          </div>
          <p className="max-w-xl text-slate-600 text-[11px] leading-relaxed">
            Công cụ được xây dựng nhằm hỗ trợ người dùng sao lưu nội dung cá nhân phục vụ học tập và nghiên cứu. Chúng tôi không lưu trữ bất kỳ tệp video nào trên máy chủ; toàn bộ nội dung thuộc bản quyền của người sáng tạo trên nền tảng TikTok và Douyin.
          </p>
        </div>
      </footer>
    </div>
  );
}
