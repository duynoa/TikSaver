import express, { Request, Response, Router } from 'express';

export interface VideoAuthor {
  id?: string;
  unique_id?: string;
  nickname: string;
  avatar: string;
}

export interface VideoStats {
  plays: number;
  likes: number;
  comments: number;
  shares: number;
  downloads?: number;
}

export interface ParsedMedia {
  id: string;
  platform: 'tiktok' | 'douyin';
  title: string;
  cover: string;
  videoUrl: string;
  hdVideoUrl?: string;
  wmVideoUrl?: string;
  quality?: string;
  fileSize?: number;
  musicUrl?: string;
  musicTitle?: string;
  musicAuthor?: string;
  images?: string[];
  duration?: number;
  author: VideoAuthor;
  stats: VideoStats;
  sourceUrl: string;
}

// Clean and extract URL from raw input text (handles mobile share strings with unicode/chinese chars)
function extractUrl(text: string): string | null {
  if (!text) return null;
  const match = text.match(/(https?:\/\/[a-zA-Z0-9\-._~:/?#\[\]@!$&'()*+,;%=]+)/i);
  if (!match) return null;
  let url = match[0].trim();
  url = url.replace(/[),;!<>.]+$/, '');
  return url;
}

function fixUrl(url?: string): string {
  if (!url) return '';
  if (url.startsWith('//')) return 'https:' + url;
  if (url.startsWith('/')) return 'https://www.tikwm.com' + url;
  return url;
}

// Helper: follow redirects on shortlinks (v.douyin.com, vt.tiktok.com, vm.tiktok.com)
async function resolveRedirectUrl(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
      },
      signal: AbortSignal.timeout(4000),
    });
    if (res.url && res.url !== url && !res.url.endsWith('douyin.com/') && !res.url.endsWith('tiktok.com/')) {
      return res.url;
    }
  } catch {
    // If redirect fails or times out, keep original url
  }
  return url;
}

// Pure HTTP Douyin parser (SnapTik / LoveTik backend)
async function parseDouyinBtch(url: string): Promise<ParsedMedia | null> {
  try {
    const res = await fetch(`https://backend1.tioo.eu.org/douyin?url=${encodeURIComponent(url)}`, {
      headers: {
        'User-Agent': 'btch/6.4.0',
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(6000),
    });

    if (!res.ok) return null;
    const json: any = await res.json();
    const d = json?.data || json?.result?.data || json?.result;
    if (json && json.status && d) {
      const links = Array.isArray(d.links) ? d.links : [];
      if (links.length === 0) return null;

      const videoLink = links.find((l: any) => l.quality?.includes('1'))?.url || links[0]?.url;
      const hdLink = links.find((l: any) => l.quality?.includes('2'))?.url || videoLink;
      const musicLink = links.find((l: any) => l.quality?.includes('3') || l.url?.includes('.mp3'))?.url;

      if (!videoLink) return null;

      const idMatch = url.match(/video\/(\d+)/) || videoLink.match(/_(\d+)/);
      const id = idMatch ? idMatch[1] : String(Date.now());

      return {
        id,
        platform: 'douyin',
        title: d.title || 'Douyin Video',
        cover: d.thumbnail || '',
        videoUrl: videoLink,
        hdVideoUrl: hdLink,
        musicUrl: musicLink,
        musicTitle: 'Âm thanh gốc Douyin',
        musicAuthor: 'Douyin Creator',
        author: {
          unique_id: 'douyin_creator',
          nickname: 'Douyin Creator',
          avatar: d.thumbnail || '',
        },
        stats: {
          plays: 0,
          likes: 0,
          comments: 0,
          shares: 0,
        },
        sourceUrl: url,
      };
    }
  } catch {
    // safe ignore
  }
  return null;
}

// TikWM parser (handles both TikTok and Douyin, with POST & GET fallbacks)
async function parseTikWM(url: string, isDouyin: boolean): Promise<ParsedMedia | null> {
  const tryEndpoint = async (targetUrl: string): Promise<ParsedMedia | null> => {
    try {
      // Try POST first
      const postBody = new URLSearchParams({
        url: targetUrl,
        hd: '1',
      });

      let res = await fetch('https://www.tikwm.com/api/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        },
        body: postBody.toString(),
        signal: AbortSignal.timeout(5000),
      });

      let text = await res.text();
      let json: any = null;
      if (text && text.trim().startsWith('{')) {
        try {
          json = JSON.parse(text);
        } catch {
          json = null;
        }
      }

      // If POST didn't return code 0, try GET fallback
      if (!json || json.code !== 0) {
        res = await fetch(`https://www.tikwm.com/api/?url=${encodeURIComponent(targetUrl)}&hd=1`, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          },
          signal: AbortSignal.timeout(5000),
        });
        text = await res.text();
        if (text && text.trim().startsWith('{')) {
          try {
            json = JSON.parse(text);
          } catch {
            json = null;
          }
        }
      }

      if (!json || json.code !== 0 || !json.data) return null;

      const d = json.data;
      const images = Array.isArray(d.images) ? d.images.map(fixUrl) : undefined;
      const chosenHd = fixUrl(d.hdplay || d.play);
      const isFHD = Boolean(d.hdplay && d.hdplay !== d.play);

      return {
        id: String(d.id || Date.now()),
        platform: isDouyin ? 'douyin' : 'tiktok',
        title: d.title || (isDouyin ? 'Douyin Video' : 'TikTok Video'),
        cover: fixUrl(d.cover),
        videoUrl: fixUrl(d.play),
        hdVideoUrl: chosenHd,
        wmVideoUrl: fixUrl(d.wmplay),
        quality: isFHD ? '1080p Full HD' : '720p HD',
        fileSize: d.hd_size || d.size || undefined,
        musicUrl: fixUrl(d.music),
        musicTitle: d.music_info?.title || 'Original Sound',
        musicAuthor: d.music_info?.author || d.author?.nickname || 'Creator',
        images: images && images.length > 0 ? images : undefined,
        duration: d.duration || 0,
        author: {
          unique_id: d.author?.unique_id || 'user',
          nickname: d.author?.nickname || 'Creator',
          avatar: fixUrl(d.author?.avatar),
        },
        stats: {
          plays: d.play_count || 0,
          likes: d.digg_count || 0,
          comments: d.comment_count || 0,
          shares: d.share_count || 0,
          downloads: d.download_count || 0,
        },
        sourceUrl: targetUrl,
      };
    } catch {
      return null;
    }
  };

  return await tryEndpoint(url);
}

// Pre-packaged high quality demo videos
const DEMO_VIDEOS: Record<string, ParsedMedia> = {
  tiktok_travel: {
    id: 'demo_tt_1',
    platform: 'tiktok',
    title: 'Khám phá vịnh Hạ Long tuyệt đẹp từ flycam vào buổi hoàng hôn 4K 🌅 #dulich #vietnam #halongbay #travel',
    cover: 'https://images.unsplash.com/photo-1528127269322-539801943592?q=80&w=1200&auto=format&fit=crop',
    videoUrl: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
    hdVideoUrl: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
    musicUrl: 'https://actions.google.com/sounds/v1/ambiences/outdoor_evening_birds.ogg',
    musicTitle: 'Sunset Chill Beat - Hoàng Hôn Êm Đềm',
    musicAuthor: 'Chill Vibes Vietnam',
    duration: 15,
    author: {
      unique_id: 'vietnam_traveler',
      nickname: 'Vietnam Travel Explorer 🇻🇳',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=300&auto=format&fit=crop',
    },
    stats: {
      plays: 1250400,
      likes: 98400,
      comments: 3420,
      shares: 14200,
      downloads: 8750,
    },
    sourceUrl: 'https://www.tiktok.com/@vietnam_traveler/video/7311927451725401375',
  },
  douyin_aesthetic: {
    id: 'demo_dy_1',
    platform: 'douyin',
    title: '重庆夜景 赛博朋克洪崖洞 - Cảnh đêm Trùng Khánh Hồng Nhai Động siêu ảo diệu 🌃 #douyin #chongqing #cyberpunk',
    cover: 'https://images.unsplash.com/photo-1508804185872-d7badad00f7d?q=80&w=1200&auto=format&fit=crop',
    videoUrl: 'https://www.w3schools.com/html/mov_bbb.mp4',
    hdVideoUrl: 'https://www.w3schools.com/html/mov_bbb.mp4',
    musicUrl: 'https://actions.google.com/sounds/v1/ambiences/rain_heavy.ogg',
    musicTitle: '夜色重庆 - Night Cyber Sound',
    musicAuthor: 'Chongqing Beat',
    duration: 18,
    author: {
      unique_id: 'chongqing_visuals',
      nickname: '山城视觉 (Sơn Thành Visuals)',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=300&auto=format&fit=crop',
    },
    stats: {
      plays: 3450000,
      likes: 421000,
      comments: 18900,
      shares: 56300,
      downloads: 32000,
    },
    sourceUrl: 'https://v.douyin.com/iRoCyberpunk/',
  },
  tiktok_slideshow: {
    id: 'demo_tt_slide',
    platform: 'tiktok',
    title: 'Bộ sưu tập hình nền hoa anh đào Nhật Bản mùa xuân 4K cực chill 🌸 Tải full bộ không logo!',
    cover: 'https://images.unsplash.com/photo-1522383225653-ed111181a951?q=80&w=1200&auto=format&fit=crop',
    videoUrl: 'https://www.w3schools.com/html/mov_bbb.mp4',
    hdVideoUrl: 'https://www.w3schools.com/html/mov_bbb.mp4',
    musicUrl: 'https://actions.google.com/sounds/v1/ambiences/meadow_morning.ogg',
    musicTitle: 'Haru Haru Piano Lo-Fi',
    musicAuthor: 'Sakura Melodies',
    images: [
      'https://images.unsplash.com/photo-1522383225653-ed111181a951?q=80&w=1080&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=1080&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?q=80&w=1080&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1490750967868-88aa4486c946?q=80&w=1080&auto=format&fit=crop',
    ],
    duration: 12,
    author: {
      unique_id: 'sakura_art',
      nickname: 'Japan Aesthetics 🌸',
      avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=300&auto=format&fit=crop',
    },
    stats: {
      plays: 890000,
      likes: 76500,
      comments: 1450,
      shares: 12300,
    },
    sourceUrl: 'https://www.tiktok.com/@sakura_art/video/7200000000000000000',
  },
};

const app = express();

// Global CORS middleware
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
});

app.use(express.json());

const apiRouter = Router();

// API: Parse single video URL
apiRouter.post('/parse', async (req: Request, res: Response): Promise<void> => {
  try {
    const rawText = String(req.body?.url || '').trim();
    if (!rawText) {
      res.status(400).json({ success: false, error: 'Vui lòng nhập hoặc dán liên kết video TikTok hoặc Douyin!' });
      return;
    }

    if (rawText.includes('demo_tiktok') || rawText.includes('halongbay') || rawText.includes('vietnam_traveler')) {
      res.json({ success: true, data: DEMO_VIDEOS.tiktok_travel });
      return;
    }
    if (rawText.includes('demo_douyin') || rawText.includes('chongqing') || rawText.includes('iRoCyberpunk')) {
      res.json({ success: true, data: DEMO_VIDEOS.douyin_aesthetic });
      return;
    }
    if (rawText.includes('demo_slide') || rawText.includes('sakura_art')) {
      res.json({ success: true, data: DEMO_VIDEOS.tiktok_slideshow });
      return;
    }

    const extractedUrl = extractUrl(rawText);
    if (!extractedUrl) {
      res.status(400).json({
        success: false,
        error: 'Không tìm thấy liên kết hợp lệ trong nội dung đã nhập. Vui lòng kiểm tra lại!',
      });
      return;
    }

    const isDouyin =
      extractedUrl.includes('douyin.com') ||
      extractedUrl.includes('iesdouyin.com') ||
      rawText.includes('抖音');

    const resolvedUrl =
      extractedUrl.includes('v.douyin.com') ||
      extractedUrl.includes('vt.tiktok.com') ||
      extractedUrl.includes('vm.tiktok.com')
        ? await resolveRedirectUrl(extractedUrl)
        : extractedUrl;

    let parsed: ParsedMedia | null = null;

    // Strategy 1 (Highest Quality 1080p FHD): Try TikWM with hd=1 first for both TikTok & Douyin
    parsed = await parseTikWM(resolvedUrl, isDouyin);
    if (!parsed && resolvedUrl !== extractedUrl) {
      parsed = await parseTikWM(extractedUrl, isDouyin);
    }

    // Strategy 2 (Fallback for Douyin): Try specialized Douyin engine if TikWM did not resolve
    if (!parsed && isDouyin) {
      parsed = await parseDouyinBtch(extractedUrl);
      if (!parsed && resolvedUrl !== extractedUrl) {
        parsed = await parseDouyinBtch(resolvedUrl);
      }
    }

    if (parsed) {
      res.json({ success: true, data: parsed });
    } else {
      res.status(422).json({
        success: false,
        error:
          'Không thể phân tích video này. Video có thể đang ở chế độ riêng tư, bị xóa hoặc liên kết không đúng định dạng. Hãy thử lại hoặc thử link mẫu!',
      });
    }
  } catch (err: unknown) {
    console.error('Parse endpoint error:', err);
    res.status(500).json({
      success: false,
      error: 'Đã xảy ra lỗi máy chủ trong quá trình tải video. Vui lòng thử lại sau giây lát!',
    });
  }
});

// API: Batch parse multiple URLs
apiRouter.post('/batch', async (req: Request, res: Response): Promise<void> => {
  try {
    const urls: string[] = Array.isArray(req.body?.urls) ? req.body.urls : [];
    if (urls.length === 0) {
      res.status(400).json({ success: false, error: 'Danh sách liên kết không được để trống!' });
      return;
    }

    const limited = urls.slice(0, 10);
    const results = await Promise.all(
      limited.map(async (raw) => {
        const u = extractUrl(raw);
        if (!u) return { raw, success: false, error: 'URL không hợp lệ' };
        const isDy = u.includes('douyin.com') || u.includes('iesdouyin.com') || raw.includes('抖音');
        const resolved =
          u.includes('v.douyin.com') || u.includes('vt.tiktok.com') || u.includes('vm.tiktok.com')
            ? await resolveRedirectUrl(u)
            : u;

        let data: ParsedMedia | null = null;
        // Strategy 1 (Highest Quality 1080p FHD): Try TikWM with hd=1 first
        data =
          (await parseTikWM(resolved, isDy)) ||
          (resolved !== u ? await parseTikWM(u, isDy) : null);

        // Strategy 2 (Fallback for Douyin)
        if (!data && isDy) {
          data = await parseDouyinBtch(u);
          if (!data && resolved !== u) {
            data = await parseDouyinBtch(resolved);
          }
        }

        if (data) return { raw, success: true, data };
        return { raw, success: false, error: 'Không thể giải mã' };
      })
    );

    res.json({ success: true, results });
  } catch (err) {
    console.error('Batch error:', err);
    res.status(500).json({ success: false, error: 'Lỗi xử lý hàng loạt' });
  }
});

// API: Proxy stream download
apiRouter.get('/download', async (req: Request, res: Response): Promise<void> => {
  try {
    const targetUrl = req.query.url as string;
    const rawFilename = (req.query.filename as string) || 'video.mp4';

    if (!targetUrl) {
      res.status(400).send('Missing target URL');
      return;
    }

    const cleanFilename = rawFilename
      .replace(/[^\w\s.-]/gi, '_')
      .replace(/\s+/g, '_')
      .substring(0, 100);

    const headers: Record<string, string> = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      Accept: '*/*',
    };

    if (targetUrl.includes('douyin') || targetUrl.includes('snssdk') || targetUrl.includes('byteoversea') || targetUrl.includes('zjcdn')) {
      headers['Referer'] = 'https://www.douyin.com/';
    } else if (targetUrl.includes('tiktok') || targetUrl.includes('ibytedtos')) {
      headers['Referer'] = 'https://www.tiktok.com/';
    }

    if (req.headers.range) {
      headers['Range'] = req.headers.range;
    }

    const upstream = await fetch(targetUrl, { headers });

    if (!upstream.ok && upstream.status !== 206) {
      res.status(upstream.status).send(`Failed to stream media: ${upstream.statusText}`);
      return;
    }

    const contentType = upstream.headers.get('content-type') || (cleanFilename.endsWith('.mp3') ? 'audio/mpeg' : 'video/mp4');
    const contentLength = upstream.headers.get('content-length');
    const contentRange = upstream.headers.get('content-range');

    res.status(upstream.status);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${cleanFilename}"`);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Access-Control-Allow-Origin', '*');

    if (contentLength) res.setHeader('Content-Length', contentLength);
    if (contentRange) res.setHeader('Content-Range', contentRange);

    if (!upstream.body) {
      res.end();
      return;
    }

    const reader = upstream.body.getReader();
    const pump = async () => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const ok = res.write(Buffer.from(value));
        if (!ok) {
          await new Promise((resolve) => res.once('drain', resolve));
        }
      }
      res.end();
    };

    req.on('close', () => {
      reader.cancel().catch(() => {});
    });

    await pump();
  } catch (err: unknown) {
    console.error('Download proxy error:', err);
    if (!res.headersSent) {
      res.status(500).send('Error streaming download');
    }
  }
});

// Health check
apiRouter.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Mount API router on both '/api' and '/'
app.use('/api', apiRouter);
app.use('/', apiRouter);

export { app };
export default app;
