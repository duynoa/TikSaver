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
  musicUrl?: string;
  musicTitle?: string;
  musicAuthor?: string;
  images?: string[];
  duration?: number;
  author: VideoAuthor;
  stats: VideoStats;
  sourceUrl: string;
}

export interface HistoryItem {
  id: string;
  platform: 'tiktok' | 'douyin';
  title: string;
  cover: string;
  videoUrl: string;
  hdVideoUrl?: string;
  musicUrl?: string;
  downloadedAt: number;
  authorName: string;
}

export interface BatchResultItem {
  raw: string;
  success: boolean;
  data?: ParsedMedia;
  error?: string;
}
