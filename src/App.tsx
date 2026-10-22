import React, { useState, useEffect, useRef } from 'react';
import {
  Download,
  Copy,
  Check,
  AlertCircle,
  RefreshCw,
  Layers,
  Play,
  Pause,
  X,
  FolderDown,
  Sparkles,
  Zap,
  ShieldCheck,
  Film,
  Link as LinkIcon,
  RotateCcw,
  Images
} from 'lucide-react';
import { ParsedMedia, BatchResultItem } from './types';

// Helper formatters
function formatDuration(seconds?: number): string {
  if (!seconds) return '';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

function getTimestamp(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const yyyy = now.getFullYear();
  const mm = pad(now.getMonth() + 1);
  const dd = pad(now.getDate());
  const hh = pad(now.getHours());
  const min = pad(now.getMinutes());
  const ss = pad(now.getSeconds());
  return `${yyyy}${mm}${dd}_${hh}${min}${ss}`;
}

function generateFilename(title?: string, ext = 'mp4'): string {
  const ts = getTimestamp();
  const raw = (title || 'video')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s-]/gi, '')
    .trim()
    .replace(/\s+/g, '_')
    .substring(0, 35);

  const cleanTitle = raw.replace(/^_+|_+$/g, '');
  return cleanTitle ? `TikSaver_${cleanTitle}_${ts}.${ext}` : `TikSaver_${ts}.${ext}`;
}

export default function App() {
  const [urlInput, setUrlInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsedData, setParsedData] = useState<ParsedMedia | null>(null);
  const [copiedCaption, setCopiedCaption] = useState(false);
  const [downloadingType, setDownloadingType] = useState<string | null>(null);

  // Batch modal
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchInput, setBatchInput] = useState('');
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchResults, setBatchResults] = useState<BatchResultItem[]>([]);

  // Video preview player
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Active image index for slideshow preview
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  // Clean up any old history from localStorage once on mount
  useEffect(() => {
    try {
      localStorage.removeItem('tikdouyin_history');
    } catch {
      // ignore
    }
  }, []);

  // Detected platform badge
  const detectedPlatform = React.useMemo(() => {
    const text = urlInput.toLowerCase();
    if (text.includes('douyin.com') || text.includes('iesdouyin') || urlInput.includes('抖音') || text.includes('douyin')) {
      return 'douyin';
    }
    if (text.includes('tiktok.com') || text.includes('tiktokcdn') || text.includes('tiktok')) {
      return 'tiktok';
    }
    return null;
  }, [urlInput]);

  // Main Parse & Auto-Download function
  const handleParseAndDownload = async (urlOverride?: string, autoDownload = true) => {
    const target = (urlOverride !== undefined ? urlOverride : urlInput).trim();
    if (!target) {
      setError('Vui lòng dán liên kết video TikTok hoặc Douyin vào ô bên dưới!');
      return;
    }

    setLoading(true);
    setError(null);
    setIsPlaying(false);
    setActiveImageIndex(0);

    try {
      const res = await fetch('/api/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: target }),
      });

      const data = await res.json();
      if (res.ok && data.success && data.data) {
        setParsedData(data.data);

        // Auto trigger file download if video is available
        if (autoDownload) {
          const videoUrl = data.data.hdVideoUrl || data.data.videoUrl;
          if (videoUrl) {
            downloadFile(
              videoUrl,
              generateFilename(data.data.title, 'mp4'),
              'video_hd',
              data.data.platform
            );
          }
        }

        setTimeout(() => {
          document.getElementById('result-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 150);
      } else {
        setError(data.error || 'Không thể tải video này. Vui lòng kiểm tra lại liên kết hoặc thử link khác!');
      }
    } catch {
      setError('Lỗi kết nối máy chủ. Vui lòng thử lại sau giây lát!');
    } finally {
      setLoading(false);
    }
  };

  // Quick Paste from Clipboard
  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setUrlInput(text);
        handleParseAndDownload(text);
      }
    } catch {
      setError('Không thể truy cập Clipboard. Hãy dùng phím Ctrl+V hoặc nhấn giữ để dán liên kết.');
    }
  };

  // Trigger file download
  const downloadFile = (url: string, filename: string, typeKey: string, platform?: string) => {
    setDownloadingType(typeKey);
    const resolvedPlatform = platform || parsedData?.platform || 'tiktok';
    const downloadUrl = `/api/download?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(filename)}&platform=${resolvedPlatform}`;

    const a = document.createElement('a');
    a.href = downloadUrl;
    a.setAttribute('download', filename);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    setTimeout(() => {
      setDownloadingType(null);
    }, 2000);
  };

  // Copy caption
  const copyCaption = () => {
    if (!parsedData?.title) return;
    navigator.clipboard.writeText(parsedData.title);
    setCopiedCaption(true);
    setTimeout(() => setCopiedCaption(false), 2000);
  };

  // Toggle Video playback
  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  };

  // Reset to search another video
  const resetSearch = () => {
    setParsedData(null);
    setUrlInput('');
    setError(null);
    setIsPlaying(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Batch process
  const handleBatchProcess = async () => {
    const rawLines = batchInput
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (rawLines.length === 0) {
      alert('Vui lòng nhập ít nhất 1 liên kết vào danh sách!');
      return;
    }

    setBatchLoading(true);
    setBatchResults([]);

    try {
      const res = await fetch('/api/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls: rawLines }),
      });

      const data = await res.json();
      if (res.ok && data.results) {
        setBatchResults(data.results);
      } else {
        alert(data.error || 'Có lỗi xảy ra khi xử lý danh sách.');
      }
    } catch {
      alert('Lỗi kết nối máy chủ khi xử lý danh sách.');
    } finally {
      setBatchLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#080c14] text-slate-100 flex flex-col font-sans selection:bg-pink-500 selection:text-white relative overflow-x-hidden">
      {/* Ambient background glows */}
      <div className="fixed top-0 left-1/4 -translate-x-1/2 -top-40 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed top-1/3 right-0 w-[500px] h-[500px] bg-pink-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-0 left-1/3 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Navbar */}
      <header className="border-b border-white/[0.06] bg-[#080c14]/80 backdrop-blur-xl sticky top-0 z-30 px-4 py-3.5 transition-all">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          {/* Logo */}
          <div
            className="flex items-center gap-2.5 cursor-pointer group"
            onClick={resetSearch}
            title="Về trang chủ TikSaver"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-400 via-pink-500 to-rose-500 p-[1.5px] flex items-center justify-center shadow-lg shadow-pink-500/20 group-hover:shadow-pink-500/30 transition">
              <div className="w-full h-full bg-[#090d16] rounded-[10px] flex items-center justify-center">
                <Download className="w-4 h-4 text-pink-400 group-hover:scale-110 transition-transform" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-cyan-300 via-white to-pink-400 bg-clip-text text-transparent">
                TikSaver
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gradient-to-r from-pink-500/20 to-rose-500/20 border border-pink-500/30 text-pink-300 uppercase tracking-wider">
                HD
              </span>
            </div>
          </div>

          {/* Action button */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowBatchModal(true)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-slate-300 hover:text-white transition shadow-sm active:scale-95"
            >
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
              <span>Tải nhiều link</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-8 sm:py-12 flex flex-col gap-8 relative z-10">
        {/* Hero Section */}
        <div className="text-center flex flex-col items-center gap-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-xs text-slate-300 backdrop-blur-sm shadow-sm mb-1">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>Tách watermark tự động &bull; Hoàn toàn miễn phí</span>
          </div>

          <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight">
            Tải Video <span className="bg-gradient-to-r from-cyan-400 to-teal-300 bg-clip-text text-transparent">TikTok</span> &{' '}
            <span className="bg-gradient-to-r from-pink-500 to-rose-400 bg-clip-text text-transparent">Douyin</span> Không Logo
          </h1>

          <p className="text-slate-400 text-xs sm:text-sm max-w-lg leading-relaxed">
            Dán liên kết bất kỳ để tải video MP4 chuẩn Full HD không dính ID và tải trọn bộ ảnh album cực nhanh.
          </p>
        </div>

        {/* Input Box Card */}
        <div className="flex flex-col gap-3">
          <div className="relative rounded-2xl bg-white/[0.03] border border-white/[0.1] focus-within:border-cyan-500/80 focus-within:ring-4 focus-within:ring-cyan-500/10 p-2 sm:p-2.5 backdrop-blur-xl shadow-2xl transition-all">
            <div className="flex items-center gap-2">
              <div className="pl-2 text-slate-500 hidden sm:block">
                <LinkIcon className="w-5 h-5 text-slate-400" />
              </div>

              <input
                type="text"
                value={urlInput}
                onChange={(e) => {
                  setUrlInput(e.target.value);
                  if (error) setError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleParseAndDownload();
                }}
                placeholder="Dán liên kết video TikTok hoặc Douyin vào đây..."
                className="w-full bg-transparent px-2.5 py-2.5 text-sm sm:text-base text-white placeholder-slate-500 focus:outline-none"
              />

              {/* Clear button */}
              {urlInput && (
                <button
                  onClick={() => {
                    setUrlInput('');
                    setError(null);
                  }}
                  className="p-2 text-slate-400 hover:text-white hover:bg-white/[0.08] rounded-xl transition"
                  title="Xóa liên kết"
                >
                  <X className="w-4 h-4" />
                </button>
              )}

              {/* Paste button */}
              <button
                onClick={handlePaste}
                type="button"
                className="px-3.5 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.08] text-xs font-semibold text-cyan-300 flex items-center gap-1.5 transition shrink-0 active:scale-95"
                title="Dán link từ bộ nhớ tạm"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Dán link</span>
              </button>
            </div>
          </div>

          {/* Primary Action Button: TẢI VIDEO KHÔNG LOGO LÊN ĐẦU */}
          <button
            onClick={() => handleParseAndDownload()}
            disabled={loading || !urlInput.trim()}
            className="w-full py-4 px-6 rounded-2xl font-black text-sm sm:text-base text-white bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-400 disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-emerald-500/25 flex items-center justify-center gap-2.5 transition active:scale-[0.98] cursor-pointer tracking-wide"
          >
            {loading ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                <span>Đang xử lý & bắt đầu tải video...</span>
              </>
            ) : (
              <>
                <Download className="w-5 h-5" />
                <span>TẢI VIDEO KHÔNG LOGO (HD MP4)</span>
              </>
            )}
          </button>

          {/* Platform indicator badge */}
          {detectedPlatform && (
            <div className="flex items-center gap-2 px-1 text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              {detectedPlatform === 'douyin' ? (
                <span className="text-pink-400 font-semibold bg-pink-500/10 px-2.5 py-0.5 rounded-full border border-pink-500/20">
                  🇨🇳 Phát hiện link Douyin (抖音)
                </span>
              ) : (
                <span className="text-cyan-400 font-semibold bg-cyan-500/10 px-2.5 py-0.5 rounded-full border border-cyan-500/20">
                  🎵 Phát hiện link TikTok
                </span>
              )}
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-3.5 rounded-2xl bg-red-950/40 border border-red-500/30 text-red-200 text-xs sm:text-sm flex items-center gap-3 backdrop-blur-md animate-in fade-in">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
              <span className="flex-1">{error}</span>
            </div>
          )}
        </div>

        {/* RESULT SECTION */}
        {parsedData && (
          <section
            id="result-section"
            className="rounded-3xl bg-white/[0.03] border border-white/[0.1] backdrop-blur-xl p-5 sm:p-7 shadow-2xl flex flex-col gap-6"
          >
            {/* Header: Status + Platform badge */}
            <div className="flex items-center justify-between gap-3 pb-4 border-b border-white/[0.08]">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-semibold text-sm text-slate-200">Video đã sẵn sàng</span>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className={`text-[11px] font-bold px-3 py-1 rounded-full uppercase tracking-wider ${
                    parsedData.platform === 'douyin'
                      ? 'bg-pink-500/15 text-pink-300 border border-pink-500/30'
                      : 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                  }`}
                >
                  {parsedData.platform === 'douyin' ? '🇨🇳 Douyin' : '🎵 TikTok'}
                </span>
              </div>
            </div>

            {/* Main Content Grid: Preview on Left, Details & Downloads on Right */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
              {/* Media Preview Column */}
              <div className="md:col-span-5 flex flex-col items-center">
                {parsedData.images && parsedData.images.length > 0 && !parsedData.videoUrl ? (
                  /* Slideshow Gallery */
                  <div className="w-full flex flex-col items-center gap-2.5">
                    <div className="relative rounded-2xl overflow-hidden bg-black/60 aspect-square w-full max-w-[260px] border border-white/[0.08] shadow-lg">
                      <img
                        src={parsedData.images[activeImageIndex] || parsedData.cover}
                        alt="Photo preview"
                        className="w-full h-full object-cover"
                      />
                      <span className="absolute bottom-2.5 right-2.5 px-2.5 py-1 rounded-lg bg-black/75 backdrop-blur-sm text-xs font-bold text-white">
                        {activeImageIndex + 1} / {parsedData.images.length}
                      </span>
                    </div>

                    {/* Thumbnail dots/bar */}
                    {parsedData.images.length > 1 && (
                      <div className="flex items-center gap-1.5 overflow-x-auto max-w-full py-1">
                        {parsedData.images.slice(0, 6).map((img, idx) => (
                          <button
                            key={idx}
                            onClick={() => setActiveImageIndex(idx)}
                            className={`w-9 h-9 rounded-lg overflow-hidden border transition shrink-0 ${
                              activeImageIndex === idx ? 'border-cyan-400 ring-2 ring-cyan-400/40' : 'border-white/10 opacity-60 hover:opacity-100'
                            }`}
                          >
                            <img src={img} alt="" className="w-full h-full object-cover" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  /* Video Player */
                  <div className="relative rounded-2xl overflow-hidden bg-black aspect-[9/16] w-full max-w-[220px] border border-white/[0.08] shadow-2xl group">
                    <video
                      ref={videoRef}
                      src={parsedData.hdVideoUrl || parsedData.videoUrl}
                      poster={parsedData.cover}
                      loop
                      playsInline
                      onClick={togglePlay}
                      className="w-full h-full object-cover cursor-pointer"
                    />

                    {/* Duration badge */}
                    {parsedData.duration ? (
                      <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-sm text-[11px] font-mono text-white">
                        {formatDuration(parsedData.duration)}
                      </span>
                    ) : null}

                    {/* Play/Pause Button Overlay */}
                    <button
                      onClick={togglePlay}
                      className="absolute inset-0 m-auto w-12 h-12 rounded-full bg-slate-900/80 backdrop-blur-md border border-white/20 text-white flex items-center justify-center shadow-lg transition transform hover:scale-110 active:scale-95 group-hover:bg-cyan-500"
                      title={isPlaying ? 'Tạm dừng' : 'Xem video'}
                    >
                      {isPlaying ? (
                        <Pause className="w-5 h-5 fill-white" />
                      ) : (
                        <Play className="w-5 h-5 fill-white ml-0.5" />
                      )}
                    </button>
                  </div>
                )}
              </div>

              {/* Actions & Details Column */}
              <div className="md:col-span-7 flex flex-col gap-4">
                {/* 1. DOWNLOAD ACTIONS GROUP (CHUYỂN NÚT TẢI LÊN ĐẦU) */}
                <div className="flex flex-col gap-2.5">
                  {/* Main Video HD Download */}
                  {(parsedData.hdVideoUrl || parsedData.videoUrl) && (
                    <button
                      onClick={() =>
                        downloadFile(
                          parsedData.hdVideoUrl || parsedData.videoUrl,
                          generateFilename(parsedData.title, 'mp4'),
                          'video_hd',
                          parsedData.platform
                        )
                      }
                      disabled={downloadingType === 'video_hd'}
                      className="w-full py-4 px-5 rounded-2xl font-bold text-sm sm:text-base text-white bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-400 shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-2.5 transition active:scale-[0.98] cursor-pointer"
                    >
                      {downloadingType === 'video_hd' ? (
                        <>
                          <RefreshCw className="w-5 h-5 animate-spin" />
                          <span>Đang bắt đầu tải video...</span>
                        </>
                      ) : (
                        <>
                          <Download className="w-5 h-5" />
                          <span>TẢI VIDEO KHÔNG LOGO (HD MP4)</span>
                        </>
                      )}
                    </button>
                  )}

                  {/* Photos / Slideshow Download */}
                  {parsedData.images && parsedData.images.length > 0 && (
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => {
                          const ts = getTimestamp();
                          parsedData.images?.forEach((imgUrl, i) => {
                            setTimeout(() => {
                              downloadFile(imgUrl, `TikSaver_Photo_${i + 1}_${ts}.jpg`, `photo_${i}`);
                            }, i * 400);
                          });
                        }}
                        className="w-full py-3.5 px-4 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 shadow-lg shadow-cyan-600/20 flex items-center justify-center gap-2 transition active:scale-[0.98] cursor-pointer"
                      >
                        <FolderDown className="w-4 h-4" />
                        <span>TẢI TẤT CẢ {parsedData.images.length} ẢNH HD</span>
                      </button>

                      {/* Download currently viewed image */}
                      <button
                        onClick={() =>
                          downloadFile(
                            parsedData.images![activeImageIndex],
                            `TikSaver_Photo_${activeImageIndex + 1}_${getTimestamp()}.jpg`,
                            'photo_single'
                          )
                        }
                        className="w-full py-2 px-3 rounded-xl text-xs text-slate-300 bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.06] flex items-center justify-center gap-1.5 transition"
                      >
                        <Images className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Tải ảnh đang xem (#{activeImageIndex + 1})</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* 2. Caption / Title */}
                {parsedData.title && (
                  <div className="p-3.5 rounded-2xl bg-black/40 border border-white/[0.06] flex flex-col gap-2">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span className="font-semibold text-slate-300">Tiêu đề nội dung</span>
                      <button
                        onClick={copyCaption}
                        className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300 text-xs font-medium transition"
                      >
                        {copiedCaption ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedCaption ? 'Đã chép' : 'Sao chép caption'}</span>
                      </button>
                    </div>
                    <p className="text-xs sm:text-sm text-slate-200 line-clamp-3 leading-relaxed">
                      {parsedData.title}
                    </p>
                  </div>
                )}

                {/* 3. Reset Button */}
                <button
                  onClick={resetSearch}
                  className="w-full py-2.5 text-xs font-medium text-slate-400 hover:text-white flex items-center justify-center gap-1.5 transition"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Tải video khác</span>
                </button>
              </div>
            </div>
          </section>
        )}

        {/* 3 Simple Steps */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-2">
          <div className="bg-white/[0.02] border border-white/[0.06] p-4 rounded-2xl flex items-start gap-3 backdrop-blur-sm">
            <span className="w-7 h-7 rounded-xl bg-cyan-500/15 border border-cyan-500/20 text-cyan-400 font-black text-xs flex items-center justify-center shrink-0">
              1
            </span>
            <div>
              <h5 className="font-bold text-white text-xs">Sao chép liên kết</h5>
              <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                Mở app TikTok hoặc Douyin, nhấn Chia sẻ &rarr; Sao chép liên kết.
              </p>
            </div>
          </div>

          <div className="bg-white/[0.02] border border-white/[0.06] p-4 rounded-2xl flex items-start gap-3 backdrop-blur-sm">
            <span className="w-7 h-7 rounded-xl bg-pink-500/15 border border-pink-500/20 text-pink-400 font-black text-xs flex items-center justify-center shrink-0">
              2
            </span>
            <div>
              <h5 className="font-bold text-white text-xs">Dán vào TikSaver</h5>
              <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                Dán link vào khung tìm kiếm phía trên rồi bấm nút Tải Ngay.
              </p>
            </div>
          </div>

          <div className="bg-white/[0.02] border border-white/[0.06] p-4 rounded-2xl flex items-start gap-3 backdrop-blur-sm">
            <span className="w-7 h-7 rounded-xl bg-emerald-500/15 border border-emerald-500/20 text-emerald-400 font-black text-xs flex items-center justify-center shrink-0">
              3
            </span>
            <div>
              <h5 className="font-bold text-white text-xs">Lưu về thiết bị</h5>
              <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                Lưu video MP4 HD không logo hoặc ảnh album về máy.
              </p>
            </div>
          </div>
        </div>

        {/* Feature Highlights */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/[0.05] flex flex-col items-center text-center gap-1.5">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <span className="text-xs font-semibold text-white">Sạch Watermark</span>
            <span className="text-[10px] text-slate-400">Xóa logo và ID 100%</span>
          </div>

          <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/[0.05] flex flex-col items-center text-center gap-1.5">
            <Film className="w-5 h-5 text-cyan-400" />
            <span className="text-xs font-semibold text-white">Chuẩn Full HD</span>
            <span className="text-[10px] text-slate-400">Độ phân giải gốc nét cao</span>
          </div>

          <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/[0.05] flex flex-col items-center text-center gap-1.5">
            <Sparkles className="w-5 h-5 text-pink-400" />
            <span className="text-xs font-semibold text-white">Không Giới Hạn</span>
            <span className="text-[10px] text-slate-400">Tải miễn phí 100%</span>
          </div>

          <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/[0.05] flex flex-col items-center text-center gap-1.5">
            <Zap className="w-5 h-5 text-amber-400" />
            <span className="text-xs font-semibold text-white">Siêu Tốc Độ</span>
            <span className="text-[10px] text-slate-400">Tải về chỉ trong 1 chạm</span>
          </div>
        </div>
      </main>

      {/* MODAL: BATCH DOWNLOADER */}
      {showBatchModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0e1422] border border-white/[0.1] rounded-3xl p-5 sm:p-6 max-w-lg w-full flex flex-col gap-4 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-cyan-400" />
                <h3 className="font-bold text-white text-base">Tải nhiều link cùng lúc</h3>
              </div>
              <button
                onClick={() => setShowBatchModal(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Dán danh sách liên kết TikTok / Douyin (mỗi dòng một link, tối đa 10 video). Hệ thống sẽ tự động bóc tách không dính logo.
            </p>

            <textarea
              value={batchInput}
              onChange={(e) => setBatchInput(e.target.value)}
              rows={4}
              placeholder="https://v.douyin.com/...&#10;https://www.tiktok.com/@user/video/..."
              className="w-full bg-black/40 border border-white/[0.08] rounded-xl p-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 font-mono"
            />

            <button
              onClick={handleBatchProcess}
              disabled={batchLoading || !batchInput.trim()}
              className="w-full py-3 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 flex items-center justify-center gap-2 transition cursor-pointer shadow-lg shadow-cyan-600/20"
            >
              {batchLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              <span>{batchLoading ? 'Đang xử lý...' : 'Bắt đầu xử lý danh sách'}</span>
            </button>

            {/* Results */}
            {batchResults.length > 0 && (
              <div className="flex flex-col gap-2 max-h-56 overflow-y-auto pr-1">
                {batchResults.map((b, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-black/40 border border-white/[0.06] flex items-center justify-between gap-3"
                  >
                    <p className="text-xs text-slate-200 truncate flex-1 font-medium">
                      {b.data?.title || b.raw}
                    </p>
                    {b.success && b.data ? (
                      <button
                        onClick={() =>
                          downloadFile(
                            b.data?.hdVideoUrl || b.data?.videoUrl || '',
                            generateFilename(b.data?.title || `Batch_${idx + 1}`, 'mp4'),
                            `b_${idx}`,
                            b.data?.platform
                          )
                        }
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white shrink-0 transition"
                      >
                        Tải MP4
                      </button>
                    ) : (
                      <span className="text-xs text-red-400 shrink-0">Lỗi link</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-white/[0.06] bg-[#080c14] px-4 py-6 text-center text-xs text-slate-500 relative z-10">
        <p>TikSaver &bull; Tải video TikTok & Douyin không watermark Full HD, miễn phí 100%.</p>
      </footer>
    </div>
  );
}
