import ytpl from "@distube/ytpl";
import ytsr from "@distube/ytsr";
import ytdl from "@distube/ytdl-core";
import { DisTubeError, ExtractorPlugin, Playlist, type ResolveOptions, Song } from "distube";
import { spawn } from "child_process";

// Интерфейс для ответа yt-dlp по printFormat
interface YtDlpVideoInfo {
  id: string;
  title: string;
  is_live: boolean;
  duration: number;
  webpage_url: string;
  thumbnails: Array<{ url: string; width?: number; height?: number }>;
  view_count: number;
  like_count: number;
  uploader: string;
  channel_id: string;
  channel_url: string;
  age_limit: number;
  chapters: Array<{ start_time: number; end_time: number; title: string }>;
  related_videos: Array<{
    id: string;
    title: string;
    author: string;
    length_seconds: number;
    view_count: number;
    thumbnails: Array<{ url: string; width?: number; height?: number }>;
    isLive: boolean;
  }>;
  audio_format_id: string;
  audio_ext: string;
  audio_url: string;
  abr: number;
}

export const clone = <T>(obj: T): T => {
  const result: T = <T>(Array.isArray(obj) ? [] : {});
  for (const key in obj) {
    result[key] = typeof obj[key] === "object" ? clone(obj[key]) : obj[key];
  }
  return result;
};

/**
 * Convert formatted duration to seconds
 * @param input - Formatted duration string
 */
export function toSecond(input: unknown): number {
  if (!input) return 0;
  if (typeof input !== "string") return Number(input) || 0;
  if (input.includes(":")) {
    const time = input.split(":").reverse();
    let seconds = 0;
    for (let i = 0; i < 3; i++) if (time[i]) seconds += Number(time[i].replace(/[^\d.]+/g, "")) * Math.pow(60, i);
    if (time.length > 3) seconds += Number(time[3].replace(/[^\d.]+/g, "")) * 24 * 60 * 60;
    return seconds;
  } else {
    return Number(input.replace(/[^\d.]+/g, "")) || 0;
  }
}
/**
 * Parse number from input
 * @param input - Input
 */
export function parseNumber(input: unknown): number {
  if (typeof input === "string") return Number(input.replace(/[^\d.]+/g, "")) || 0;
  return Number(input) || 0;
}

export type YouTubePluginOptions = {
  /**
   * YouTube Cookies
   */
  cookies?: ytdl.Cookie[];
  /**
   * ytdl-core options
   */
  ytdlOptions?: ytdl.getInfoOptions;
};

export class YouTubePlugin extends ExtractorPlugin {
  #cookies?: ytdl.Cookie[];
  cookies?: ytdl.Cookie[];
  #ytdlOptions: ytdl.getInfoOptions;

  constructor(options: YouTubePluginOptions = {}) {
    super();
    // checkInvalidKey(options, ["cookies", "ytdlOptions"], "YouTubePlugin");
    this.cookies = this.#cookies = options.cookies ? clone(options.cookies) : undefined;
    this.#ytdlOptions = options?.ytdlOptions ? clone(options.ytdlOptions) : {};
    this.#ytdlOptions.agent = ytdl.createAgent(this.cookies);
  }

  get ytdlOptions(): ytdl.getInfoOptions {
    if (this.cookies !== this.#cookies) this.#ytdlOptions.agent = ytdl.createAgent((this.#cookies = this.cookies));
    return this.#ytdlOptions;
  }

  get ytCookie(): string {
    const agent = this.#ytdlOptions.agent;
    if (!agent) return "";
    const { jar } = agent;
    return jar.getCookieStringSync("https://www.youtube.com");
  }

  private async getVideoInfoWithYtDlp(url: string): Promise<YtDlpVideoInfo> {
    return new Promise((resolve, reject) => {
      const printFormat = `{
  "id": %(id)j,
  "title": %(title)j,
  "is_live": %(is_live)j,
  "duration": %(duration)j,
  "webpage_url": %(webpage_url)j,
  "thumbnails": %(thumbnails|json)j,
  "view_count": %(view_count)j,
  "like_count": %(like_count)j,
  "uploader": %(uploader)j,
  "channel_id": %(channel_id)j,
  "channel_url": %(channel_url)j,
  "age_limit": %(age_limit)j,
  "audio_format_id": %(format_id)j,
  "audio_ext": %(ext)j,
  "audio_url": %(url)j,
  "abr": %(abr)j
}`;
      
      const ytDlp = spawn('yt-dlp', ['--no-warnings', '-f', 'bestaudio', '--print', printFormat, url]);

      let stdout = '';
      let stderr = '';

      ytDlp.stdout.on('data', (data: Buffer) => {
        console.log(data.toString());
        stdout += data.toString();
      });

      ytDlp.stderr.on('data', (data: Buffer) => {
        console.log(data.toString());
        stderr += data.toString();
      });

      ytDlp.on('close', (code: number) => {
        if (code === 0) {
          try {
            const info = JSON.parse(stdout) as YtDlpVideoInfo;
            resolve(info);
          } catch (parseError: unknown) {
            reject(new Error(`Failed to parse yt-dlp JSON output: ${String(parseError)}`));
          }
        } else {
          reject(new Error(`yt-dlp failed with code ${code}: ${stderr}`));
        }
      });

      ytDlp.on('error', (error: Error) => {
        reject(new Error(`Failed to spawn yt-dlp: ${error.message}`));
      });
    });
  }

  validate(url: string): boolean {
    if (ytdl.validateURL(url) || ytpl.validateID(url)) return true;
    return false;
  }
  async resolve<T>(url: string, options: ResolveOptions<T>): Promise<Playlist<T> | Song<T>> {
    if (ytpl.validateID(url)) {
      const info = await ytpl(url, { limit: Infinity, requestOptions: { headers: { cookie: this.ytCookie } } });
      return new YouTubePlaylist(this, info, options);
    }
    if (ytdl.validateURL(url)) {
      const info = await this.getVideoInfoWithYtDlp(url);
      return new YouTubeSong(this, info, options);
    }
    throw new DisTubeError("CANNOT_RESOLVE_SONG", url);
  }

  async getStreamURL<T = unknown>(song: YouTubeSong<T>): Promise<string> {
    if (!song.url || !ytdl.validateURL(song.url)) throw new DisTubeError("CANNOT_RESOLVE_SONG", song);

    if (!song.streamUrl) throw new DisTubeError("UNPLAYABLE_FORMATS");

    return song.streamUrl;
  }
  async getRelatedSongs(song: YouTubeSong): Promise<Song[]> {
    return (song.related ? song.related : (await this.getVideoInfoWithYtDlp(song.url!)).related_videos)
      .filter(r => r.id)
      .map(r => new YouTubeRelatedSong(this, r));
  }
  async searchSong<T>(query: string, options: ResolveOptions<T>): Promise<Song<T> | null> {
    const result = await this.search(query, { type: SearchResultType.VIDEO, limit: 1 });
    if (!result?.[0]) return null;
    const info = result[0];
    return new Song(
      {
        plugin: this,
        source: "youtube",
        playFromSource: true,
        id: info.id,
        name: info.name,
        url: info.url,
        thumbnail: info.thumbnail,
        duration: info.duration,
        views: info.views,
        uploader: info.uploader,
      },
      options,
    );
  }

  search(
    string: string,
    options?: { type?: SearchResultType.VIDEO; limit?: number; safeSearch?: boolean },
  ): Promise<YouTubeSearchResultSong[]>;
  search(
    string: string,
    options: { type: SearchResultType.PLAYLIST; limit?: number; safeSearch?: boolean },
  ): Promise<YouTubeSearchResultPlaylist[]>;
  search(
    string: string,
    options?: { type?: SearchResultType; limit?: number; safeSearch?: boolean },
  ): Promise<YouTubeSearchResultSong[] | YouTubeSearchResultPlaylist[]>;
  /**
   * Search for a song.
   *
   * @param query              - The string search for
   * @param options            - Search options
   * @param options.limit      - Limit the results
   * @param options.type       - Type of results (`video` or `playlist`).
   * @param options.safeSearch - Whether or not use safe search (YouTube restricted mode)
   *
   * @returns Array of results
   */
  async search(
    query: string,
    options: {
      type?: SearchResultType;
      limit?: number;
      safeSearch?: boolean;
    } = {},
  ): Promise<(YouTubeSearchResultSong | YouTubeSearchResultPlaylist)[]> {
    const { items } = await ytsr(query, {
      type: SearchResultType.VIDEO,
      limit: 10,
      safeSearch: false,
      ...options,
      requestOptions: { headers: { cookie: this.ytCookie } },
    });
    return items.map(i => {
      if (i.type === "video") return new YouTubeSearchResultSong(this, i);
      return new YouTubeSearchResultPlaylist(i);
    });
  }
}

export class YouTubeSong<T = unknown> extends Song<T> {
  chapters?: { start_time: number; end_time: number; title: string }[];
  related?: YtDlpVideoInfo['related_videos'];
  streamUrl: string;
  constructor(plugin: YouTubePlugin, info: YtDlpVideoInfo, options: ResolveOptions<T>) {
    super(
      {
        plugin,
        source: "youtube",
        playFromSource: true,
        id: info.id,
        name: info.title,
        isLive: Boolean(info.is_live),
        duration: info.is_live ? 0 : info.duration,
        url: info.webpage_url || `https://youtu.be/${info.id}`,
        thumbnail: info.thumbnails?.sort((a, b) => (b.width || 0) - (a.width || 0))?.[0]?.url,
        views: info.view_count,
        likes: info.like_count,
        uploader: {
          name: info.uploader,
          url: info.channel_url || (info.channel_id ? `https://www.youtube.com/channel/${info.channel_id}` : undefined),
        },
        ageRestricted: Boolean(info.age_limit),
      },
      options,
    );
    this.chapters = info.chapters || [];
    this.related = info.related_videos || [];
    this.streamUrl = info.audio_url || '';
  }
}

export class YouTubePlaylist<T> extends Playlist<T> {
  constructor(plugin: YouTubePlugin, info: ytpl.result, options: ResolveOptions<T>) {
    const songs = info.items.map(
      i =>
        new Song({
          plugin,
          playFromSource: true,
          source: "youtube",
          id: i.id,
          name: i.title,
          url: i.url,
          thumbnail: i.thumbnail,
          duration: toSecond(i.duration),
          isLive: Boolean((i as { isLive?: boolean }).isLive),
          uploader: {
            name: i.author?.name,
            url:
              (i.author as { url?: string; channelID?: string })?.url || (i.author as { channelID?: string })?.channelID
                ? `https://www.youtube.com/channel/${(i.author as { channelID?: string })?.channelID}`
                : undefined,
          },
        }),
    );
    super(
      {
        source: "youtube",
        id: info.id,
        name: info.title,
        url: info.url,
        thumbnail: (info as { thumbnail?: { url?: string } })?.thumbnail?.url,
        songs,
      },
      options,
    );
  }
}

export class YouTubeRelatedSong extends Song {
  constructor(plugin: YouTubePlugin, info: YtDlpVideoInfo['related_videos'][number]) {
    if (!info.id) throw new DisTubeError("CANNOT_RESOLVE_SONG", info);
    super({
      plugin,
      source: "youtube",
      playFromSource: true,
      id: info.id,
      name: info.title,
      url: `https://youtu.be/${info.id}`,
      thumbnail: info.thumbnails?.sort((a, b) => (b.width || 0) - (a.width || 0))?.[0]?.url,
      isLive: Boolean(info.isLive),
      duration: info.isLive ? 0 : info.length_seconds,
      views: info.view_count,
      uploader: {
        name: info.author,
      },
    });
  }
}

/**
 * Search result types:
 *
 * - `VIDEO` = `"video"`
 * - `PLAYLIST` = `"playlist"`
 */
export enum SearchResultType {
  VIDEO = "video",
  PLAYLIST = "playlist",
}

/**
 * A class representing a video search result.
 */
export class YouTubeSearchResultSong extends Song {
  constructor(plugin: YouTubePlugin, info: ytsr.Video) {
    super({
      plugin,
      source: "youtube",
      playFromSource: true,
      id: info.id,
      name: info.name,
      url: `https://youtu.be/${info.id}`,
      thumbnail: info.thumbnail,
      isLive: info.isLive,
      duration: toSecond(info.duration),
      views: parseNumber(info.views),
      uploader: {
        name: info.author?.name,
        url: info.author?.url,
      },
    });
  }
}

/**
 * A class representing a playlist search result.
 */
export class YouTubeSearchResultPlaylist {
  /**
   * YouTube  playlist id
   */
  id: string;
  /**
   * Playlist title.
   */
  name: string;
  /**
   * Playlist URL.
   */
  url: string;
  /**
   * Playlist owner
   */
  uploader: {
    name?: string;
    url?: string;
  };
  /**
   * Number of videos in the playlist
   */
  length: number;
  constructor(info: ytsr.Playlist) {
    this.id = info.id;
    this.name = info.name;
    this.url = `https://www.youtube.com/playlist?list=${info.id}`;
    this.uploader = {
      name: info.owner?.name,
      url: info.owner?.url,
    };
    this.length = info.length;
  }
}