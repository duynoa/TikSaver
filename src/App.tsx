import React, { useState, useEffect, useRef } from 'react';
import {
  Download,
  Copy,
  Check,
  AlertCircle,
  RefreshCw,
  Layers,
  History as HistoryIcon,
  Play,
  X,
  FolderDown
} from 'lucide-react';
import { ParsedMedia, HistoryItem, BatchResultItem } from './types';

export default function App() {
  const [urlInput, setUrlInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsedData, setParsedData] = useState<ParsedMedia | null>(null);
  const [copiedCaption, setCopiedCaption] = useState(false);
  const [downloadingType, setDownloadingType] = useState<string | null>(null);

  // Modals for secondary features
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // Batch Mode
  const [batchInput, setBatchInput] = useState('');
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchResults, setBatchResults] = useState<BatchResultItem[]>([]);

  // Video Preview Player
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // History state
  const [history, setHistory] = useState<HistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem('tikdouyin_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Save history
  useEffect(() => {
    try {
      localStorage.setItem('tikdouyin_history', JSON.stringify(history));
    } catch (e) {
      console.warn('Cannot save history', e);
    }
  }, [history]);

  // Detected platform badge
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

  // Save to history helper
  const addToHistory = (item: ParsedMedia) => {
    setHistory((prev) => {
      const filtered = prev.filter((h) => h.id !== item.id);
      const newItem: HistoryItem = {
        id: item.id,
        platform: item.platform,
        title: item.title,
        cover: item.cover,
        videoUrl: item.videoUrl,
        hdVideoUrl: item.hdVideoUrl,
        musicUrl: item.musicUrl,
        downloadedAt: Date.now(),
        authorName: '',
      };
      return [newItem, ...filtered].slice(0, 20);
    });
  };

  // Main Parse function
  const handleParse = async (urlOverride?: string) => {
    const target = (urlOverride !== undefined ? urlOverride : urlInput).trim();
    if (!target) {
      setError('Vui lòng dán liên kết video TikTok hoặc Douyin vào ô bên dưới!');
      return;
    }

    setLoading(true);
    setError(null);
    setIsPlaying(false);

    try {
      const res = await fetch('/api/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: target }),
      });

      const data = await res.json();
      if (res.ok && data.success && data.data) {
        setParsedData(data.data);
        addToHistory(data.data);
        setTimeout(() => {
          document.getElementById('result-section')?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
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
        handleParse(text);
      }
    } catch {
      setError('Không thể truy cập Clipboard. Hãy dùng phím Ctrl+V hoặc nhấn giữ để dán liên kết.');
    }
  };

  // Trigger file download
  const downloadFile = (url: string, filename: string, typeKey: string) => {
    setDownloadingType(typeKey);
    const downloadUrl = `/api/download?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(filename)}&platform=${parsedData?.platform || 'tiktok'}`;

    const a = document.createElement('a');
    a.href = downloadUrl;
    a.setAttribute('download', filename);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    setTimeout(() => {
      setDownloadingType(null);
    }, 2500);
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
      videoRef.current.play();
      setIsPlaying(true);
    }
  };

  // Reset to search another video
  const resetSearch = () => {
    setParsedData(null);
    setUrlInput('');
    setError(null);
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
        data.results.forEach((r: BatchResultItem) => {
          if (r.success && r.data) addToHistory(r.data);
        });
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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-pink-500 selection:text-white">
      {/* Top Navbar */}
      <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md sticky top-0 z-30 px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5 cursor-pointer" onClick={resetSearch}>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-400 via-pink-500 to-rose-500 p-[1.5px] flex items-center justify-center shadow-md shadow-pink-500/20">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <Download className="w-4 h-4 text-pink-400" />
              </div>
            </div>
            <div>
              <span className="font-extrabold text-base sm:text-lg tracking-tight bg-gradient-to-r from-cyan-300 via-white to-pink-400 bg-clip-text text-transparent">
                TikSaver
              </span>
              <span className="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-pink-500/20 text-pink-400 uppercase">
                HD
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowBatchModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white transition"
            >
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden sm:inline">Tải nhiều link</span>
            </button>
            <button
              onClick={() => setShowHistoryModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white transition relative"
            >
              <HistoryIcon className="w-3.5 h-3.5 text-pink-400" />
              <span className="hidden sm:inline">Lịch sử</span>
              {history.length > 0 && (
                <span className="w-4 h-4 rounded-full bg-pink-500 text-white text-[10px] flex items-center justify-center font-bold">
                  {history.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-8 sm:py-12 flex flex-col gap-7">
        {/* Hero Title */}
        <div className="text-center flex flex-col items-center gap-2">
          <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
            Tải Video <span className="text-cyan-400">TikTok</span> & <span className="text-pink-500">Douyin</span> Không Logo
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm">
            Tự động loại bỏ watermark và lưu video MP4 chuẩn Full HD về thiết bị.
          </p>
        </div>

        {/* Search Input Box */}
        <div className="flex flex-col gap-2">
          <div className="relative rounded-2xl bg-slate-900 border-2 border-slate-800 focus-within:border-cyan-500 p-2 shadow-xl transition-all">
            <div className="flex items-center gap-2">
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
                placeholder="Dán liên kết TikTok hoặc Douyin vào đây..."
                className="w-full bg-transparent px-3 py-2.5 text-sm sm:text-base text-white placeholder-slate-500 focus:outline-none"
              />

              {/* Paste & Clear action buttons */}
              {urlInput ? (
                <button
                  onClick={() => {
                    setUrlInput('');
                    setError(null);
                  }}
                  className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
                  title="Xóa"
                >
                  <X className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={handlePaste}
                  type="button"
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-cyan-300 flex items-center gap-1.5 transition shrink-0"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Dán link</span>
                </button>
              )}

              {/* Submit Download Button */}
              <button
                onClick={() => handleParse()}
                disabled={loading || !urlInput.trim()}
                className="px-5 sm:px-7 py-3 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-cyan-500 via-teal-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-cyan-500/20 flex items-center justify-center gap-2 transition shrink-0 active:scale-95"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Đang tải...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>Tải Video</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Platform indicator pill */}
          {detectedPlatform && (
            <div className="flex items-center gap-1.5 text-xs text-slate-400 px-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {detectedPlatform === 'douyin' ? (
                <span className="text-pink-400 font-medium">Đã phát hiện link Douyin (抖音)</span>
              ) : (
                <span className="text-cyan-400 font-medium">Đã phát hiện link TikTok</span>
              )}
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-800/80 text-red-200 text-xs flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Sample quick test links */}
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1 text-xs text-slate-400">
            <span className="text-slate-500 text-[11px]">Link mẫu:</span>
            <button
              onClick={() => {
                setUrlInput('https://v.douyin.com/MLO5rN_kQsI/');
                handleParse('https://v.douyin.com/MLO5rN_kQsI/');
              }}
              className="px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 hover:border-pink-500/50 hover:text-pink-300 transition"
            >
              🇨🇳 Douyin Mẫu
            </button>
            <button
              onClick={() => {
                setUrlInput('demo_tiktok');
                handleParse('demo_tiktok');
              }}
              className="px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 hover:border-cyan-500/50 hover:text-cyan-300 transition"
            >
              🎵 TikTok Mẫu
            </button>
          </div>
        </div>

        {/* RESULT SECTION (Download button placed right at the top for instant 1-tap download) */}
        {parsedData && (
          <div id="result-section" className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 sm:p-6 shadow-2xl flex flex-col gap-4">
            {/* Header Status & Platform Tag */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Video đã sẵn sàng tải về
              </span>
              <span
                className={`text-[11px] font-bold px-2.5 py-1 rounded-lg uppercase tracking-wider ${
                  parsedData.platform === 'douyin'
                    ? 'bg-pink-500/20 text-pink-400 border border-pink-500/30'
                    : 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                }`}
              >
                {parsedData.platform === 'douyin' ? '🇨🇳 Douyin' : '🎵 TikTok'}
              </span>
            </div>

            {/* TOP PRIMARY ACTION: Big Download Button RIGHT AT THE TOP */}
            <div className="flex flex-col gap-2">
              {(parsedData.hdVideoUrl || parsedData.videoUrl) && (
                <button
                  onClick={() =>
                    downloadFile(
                      parsedData.hdVideoUrl || parsedData.videoUrl,
                      `[TikSaver]_${(parsedData.title || 'video').substring(0, 30)}.mp4`,
                      'video_hd'
                    )
                  }
                  disabled={downloadingType === 'video_hd'}
                  className="w-full py-4 px-4 rounded-2xl font-bold text-base text-white bg-emerald-600 hover:bg-emerald-500 shadow-xl shadow-emerald-600/30 flex items-center justify-center gap-2.5 transition active:scale-[0.98]"
                >
                  <Download className="w-5 h-5" />
                  <span>
                    {downloadingType === 'video_hd' ? '⏳ Đang bắt đầu tải về...' : 'TẢI VIDEO KHÔNG LOGO (HD MP4)'}
                  </span>
                </button>
              )}

              {/* Slideshow: Download All Photos */}
              {parsedData.images && parsedData.images.length > 0 && (
                <button
                  onClick={() => {
                    parsedData.images?.forEach((imgUrl, i) => {
                      setTimeout(() => {
                        downloadFile(imgUrl, `[Photo_${i + 1}]_${parsedData.id}.jpg`, `photo_${i}`);
                      }, i * 400);
                    });
                  }}
                  className="w-full py-4 px-4 rounded-2xl font-bold text-base text-white bg-cyan-600 hover:bg-cyan-500 flex items-center justify-center gap-2.5 transition shadow-lg shadow-cyan-600/20 active:scale-[0.98]"
                >
                  <FolderDown className="w-5 h-5" />
                  <span>TẢI TOÀN BỘ {parsedData.images.length} ẢNH</span>
                </button>
              )}

              {/* Reset: Tải video khác */}
              <button
                onClick={resetSearch}
                className="w-full py-2 text-xs font-semibold text-slate-400 hover:text-white transition text-center"
              >
                + Tải một video khác
              </button>
            </div>

            {/* Caption text */}
            {parsedData.title && (
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80 flex flex-col gap-1">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span className="font-semibold text-slate-400">Tiêu đề</span>
                  <button
                    onClick={copyCaption}
                    className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300 transition"
                  >
                    {copiedCaption ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedCaption ? 'Đã sao chép' : 'Sao chép'}</span>
                  </button>
                </div>
                <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                  {parsedData.title}
                </p>
              </div>
            )}

            {/* Video Preview (Placed below the download button) */}
            <div className="flex justify-center pt-1">
              {parsedData.images && parsedData.images.length > 0 && !parsedData.videoUrl ? (
                <div className="relative rounded-2xl overflow-hidden bg-black aspect-square w-full max-w-[200px] border border-slate-800 shadow">
                  <img src={parsedData.cover || parsedData.images[0]} alt="" className="w-full h-full object-cover" />
                  <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/70 text-xs text-white font-bold">
                    {parsedData.images.length} ảnh
                  </span>
                </div>
              ) : (
                <div className="relative rounded-2xl overflow-hidden bg-black aspect-[9/16] w-full max-w-[180px] border border-slate-800 shadow group">
                  <video
                    ref={videoRef}
                    src={parsedData.hdVideoUrl || parsedData.videoUrl}
                    poster={parsedData.cover}
                    loop
                    playsInline
                    onClick={togglePlay}
                    className="w-full h-full object-contain cursor-pointer"
                  />
                  {!isPlaying && (
                    <button
                      onClick={togglePlay}
                      className="absolute inset-0 m-auto w-10 h-10 rounded-full bg-slate-900/80 backdrop-blur-md border border-white/20 text-white flex items-center justify-center shadow hover:scale-110 transition group-hover:bg-cyan-500"
                    >
                      <Play className="w-4 h-4 fill-white ml-0.5" />
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 3 Simple Steps */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          <div className="bg-slate-900/60 border border-slate-800/70 p-4 rounded-2xl flex items-start gap-3">
            <span className="w-7 h-7 rounded-lg bg-cyan-500/20 text-cyan-400 font-extrabold text-xs flex items-center justify-center shrink-0">
              1
            </span>
            <div>
              <h5 className="font-bold text-white text-xs">Sao chép link</h5>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Mở app TikTok hoặc Douyin, bấm Chia sẻ &rarr; Sao chép liên kết.
              </p>
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/70 p-4 rounded-2xl flex items-start gap-3">
            <span className="w-7 h-7 rounded-lg bg-pink-500/20 text-pink-400 font-extrabold text-xs flex items-center justify-center shrink-0">
              2
            </span>
            <div>
              <h5 className="font-bold text-white text-xs">Dán vào ô tải</h5>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Dán link vào ô tìm kiếm phía trên rồi bấm nút Tải Video.
              </p>
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/70 p-4 rounded-2xl flex items-start gap-3">
            <span className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 font-extrabold text-xs flex items-center justify-center shrink-0">
              3
            </span>
            <div>
              <h5 className="font-bold text-white text-xs">Lưu về máy</h5>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Nhấn Tải Video Không Logo để lưu tệp MP4 về thiết bị.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* MODAL: BATCH DOWNLOADER */}
      {showBatchModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 max-w-lg w-full flex flex-col gap-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-cyan-400" />
                <h3 className="font-bold text-white text-base">Tải nhiều video cùng lúc</h3>
              </div>
              <button onClick={() => setShowBatchModal(false)} className="p-1 text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Dán nhiều link (mỗi dòng một link, tối đa 10 video). Hệ thống sẽ tự động bóc tách logo cho tất cả.
            </p>

            <textarea
              value={batchInput}
              onChange={(e) => setBatchInput(e.target.value)}
              rows={4}
              placeholder="https://v.douyin.com/...&#10;https://www.tiktok.com/@user/video/..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 font-mono"
            />

            <button
              onClick={handleBatchProcess}
              disabled={batchLoading || !batchInput.trim()}
              className="w-full py-3 rounded-xl font-bold text-xs text-white bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 flex items-center justify-center gap-2 transition"
            >
              {batchLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              <span>{batchLoading ? 'Đang xử lý...' : 'Bắt đầu tải danh sách'}</span>
            </button>

            {/* Results */}
            {batchResults.length > 0 && (
              <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1">
                {batchResults.map((b, idx) => (
                  <div key={idx} className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-2">
                    <p className="text-xs text-slate-200 truncate flex-1">
                      {b.data?.title || b.raw}
                    </p>
                    {b.success && b.data ? (
                      <button
                        onClick={() =>
                          downloadFile(
                            b.data?.hdVideoUrl || b.data?.videoUrl || '',
                            `[Batch_${idx + 1}].mp4`,
                            `b_${idx}`
                          )
                        }
                        className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-[11px] font-bold text-white shrink-0"
                      >
                        Tải MP4
                      </button>
                    ) : (
                      <span className="text-[11px] text-red-400 shrink-0">Lỗi</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: DOWNLOAD HISTORY */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 max-w-lg w-full flex flex-col gap-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <HistoryIcon className="w-5 h-5 text-pink-400" />
                <h3 className="font-bold text-white text-base">Lịch sử video đã tải</h3>
              </div>
              <div className="flex items-center gap-2">
                {history.length > 0 && (
                  <button
                    onClick={() => {
                      if (confirm('Bạn có muốn xóa toàn bộ lịch sử không?')) setHistory([]);
                    }}
                    className="text-xs text-red-400 hover:underline"
                  >
                    Xóa tất cả
                  </button>
                )}
                <button onClick={() => setShowHistoryModal(false)} className="p-1 text-slate-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {history.length === 0 ? (
              <p className="text-center py-8 text-xs text-slate-500">Chưa có lịch sử video nào.</p>
            ) : (
              <div className="flex flex-col gap-2 max-h-72 overflow-y-auto pr-1">
                {history.map((item) => (
                  <div key={item.id} className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center gap-3">
                    <img src={item.cover} alt="" className="w-10 h-10 rounded-lg object-cover bg-slate-900 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-white truncate">{item.title || 'Video'}</p>
                    </div>
                    <button
                      onClick={() => {
                        setShowHistoryModal(false);
                        setUrlInput(item.id);
                        handleParse(item.id);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-[11px] font-bold text-white shrink-0"
                    >
                      Mở lại
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 px-4 py-6 text-center text-xs text-slate-500">
        <p>TikSaver &bull; Tải video TikTok & Douyin không logo nhanh chóng, miễn phí 100%.</p>
      </footer>
    </div>
  );
}
