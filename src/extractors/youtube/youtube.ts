import ytpl from "@distube/ytpl";
import ytdl from "@distube/ytdl-core";
import { DisTubeError, ExtractorPlugin, Playlist, type ResolveOptions, Song } from "distube";
import { spawn } from "child_process";

interface YtDlpFormat {
  url?: string;
  format_id?: string;
  acodec?: string;
  vcodec?: string;
  ext?: string;
  asr?: number;
  abr?: number;
  tbr?: number;
}

interface YtDlpResponse {
  formats?: YtDlpFormat[];
  is_live?: boolean;
  duration?: number;
}

interface YtDlpSearchVideo {
  id: string;
  title: string;
  url: string;
  thumbnail?: string;
  duration?: number | string;
  view_count?: number;
  channel?: string;
  channel_id?: string;
  channel_url?: string;
  is_live?: boolean;
  _type: "video";
}

interface YtDlpSearchPlaylist {
  id: string;
  title: string;
  url: string;
  thumbnail?: string;
  channel?: string;
  channel_id?: string;
  channel_url?: string;
  playlist_count?: number;
  _type: "playlist";
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
export function toSecond(input: any): number {
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
export function parseNumber(input: any): number {
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

  private async getVideoInfoWithYtDlp(url: string): Promise<YtDlpResponse> {
    return new Promise((resolve, reject) => {
      const ytDlp = spawn('yt-dlp', ['--print', '%(formats)j', '--no-warnings', url]);

      let stdout = '';
      let stderr = '';

      ytDlp.stdout.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      ytDlp.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      ytDlp.on('close', (code: number) => {
        if (code === 0) {
          try {
            const formats = JSON.parse(stdout) as YtDlpFormat[];
            resolve({ formats });
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

  private async searchWithYtDlp(
    query: string,
    options: { type?: SearchResultType; limit?: number },
  ): Promise<(YtDlpSearchVideo | YtDlpSearchPlaylist)[]> {
    return new Promise((resolve, reject) => {
      const searchType = options.type ?? SearchResultType.VIDEO;
      
      // Всегда ищем только первое видео/плейлист
      const searchQuery = `ytsearch1:${query}`;

      const args = [
        '--dump-json',
        '--no-warnings',
        searchQuery,
      ];

      // Для плейлистов добавляем --flat-playlist
      if (searchType === SearchResultType.PLAYLIST) {
        args.splice(1, 0, '--flat-playlist');
      }

      const ytDlp = spawn('yt-dlp', args);

      let stdout = '';
      let stderr = '';

      ytDlp.stdout.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      ytDlp.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      ytDlp.on('close', (code: number) => {
        if (code === 0) {
          try {
            // Обрабатываем только первую строку JSON
            const firstLine = stdout.trim().split('\n').find(line => line.trim());
            if (!firstLine) {
              resolve([]);
              return;
            }

            const item = JSON.parse(firstLine);
            const id = item.id || item.url?.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/playlist\?list=)([^&\s]+)/)?.[1];
            
            if (!id) {
              resolve([]);
              return;
            }

            const isPlaylist = item._type === 'playlist' || 
                              item.url?.includes('playlist') || 
                              item.playlist_id ||
                              searchType === SearchResultType.PLAYLIST;

            const result: YtDlpSearchVideo | YtDlpSearchPlaylist = isPlaylist
              ? {
                  id: item.playlist_id || item.id || id,
                  title: item.title || item.playlist_title || '',
                  url: item.url || item.webpage_url || `https://www.youtube.com/playlist?list=${id}`,
                  thumbnail: item.thumbnail || item.thumbnails?.[0]?.url,
                  channel: item.channel || item.uploader || item.channel_name,
                  channel_id: item.channel_id,
                  channel_url: item.channel_url || item.uploader_url || item.channel_url,
                  playlist_count: item.playlist_count || item.n_entries || 0,
                  _type: 'playlist',
                }
              : {
                  id,
                  title: item.title || '',
                  url: item.url || item.webpage_url || `https://youtu.be/${id}`,
                  thumbnail: item.thumbnail || item.thumbnails?.[0]?.url,
                  duration: item.duration || item.duration_string,
                  view_count: item.view_count,
                  channel: item.channel || item.uploader || item.channel_name,
                  channel_id: item.channel_id,
                  channel_url: item.channel_url || item.uploader_url,
                  is_live: item.is_live || false,
                  _type: 'video',
                };

            resolve([result]);
          } catch (parseError: unknown) {
            reject(new Error(`Failed to parse yt-dlp search output: ${String(parseError)}`));
          }
        } else {
          reject(new Error(`yt-dlp search failed with code ${code}: ${stderr}`));
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
  async resolve<T>(url: string, options: ResolveOptions<T>) {
    if (ytpl.validateID(url)) {
      const info = await ytpl(url, { limit: Infinity, requestOptions: { headers: { cookie: this.ytCookie } } });
      return new YouTubePlaylist(this, info, options);
    }
    if (ytdl.validateURL(url)) {
      const info = await ytdl.getBasicInfo(url, this.ytdlOptions);
      return new YouTubeSong(this, info, options);
    }
    throw new DisTubeError("CANNOT_RESOLVE_SONG", url);
  }

  async getStreamURL<T = unknown>(song: YouTubeSong<T>): Promise<string> {
    if (!song.url || !ytdl.validateURL(song.url)) throw new DisTubeError("CANNOT_RESOLVE_SONG", song);
    const video = await this.getVideoInfoWithYtDlp(song.url);
    
    const formats = (video.formats ?? []).map((format: YtDlpFormat) => ({
      url: format.url ?? '',
      itag: format.format_id ?? '',
      codecs: format.acodec && format.acodec !== 'none'
                      ? format.acodec
                      : format.vcodec ?? '',
      container: format.ext ?? '',
      audioSampleRate: format.asr?.toString(),
      averageBitrate: format.abr,
      bitrate: format.tbr,
      isLive: video.is_live ?? false,
    }));

    const format = formats.find((format): boolean => (format.codecs === 'opus' && format.container === 'webm' && format.audioSampleRate !== undefined && parseInt(format.audioSampleRate, 10) === 48000 && Boolean(format.url)  || format.container === 'mp4' && format.audioSampleRate !== undefined && parseInt(format.audioSampleRate, 10) > 44000 && Boolean(format.url)));

    if (!format) throw new DisTubeError("UNPLAYABLE_FORMATS");


    return format?.url;
  }
  async getRelatedSongs(song: YouTubeSong): Promise<Song[]> {
    return (song.related ? song.related : (await ytdl.getBasicInfo(song.url!, this.ytdlOptions)).related_videos)
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
    const items = await this.searchWithYtDlp(query, {
      type: options.type ?? SearchResultType.VIDEO,
      limit: options.limit ?? 10,
    });
    return items.map(i => {
      if (i._type === "video") return new YouTubeSearchResultSong(this, i as YtDlpSearchVideo);
      return new YouTubeSearchResultPlaylist(i as YtDlpSearchPlaylist);
    });
  }
}

export class YouTubeSong<T = unknown> extends Song<T> {
  chapters?: ytdl.Chapter[];
  storyboards?: ytdl.storyboard[];
  related?: ytdl.relatedVideo[];
  constructor(plugin: YouTubePlugin, info: ytdl.videoInfo, options: ResolveOptions<T>) {
    const i = info.videoDetails;
    super(
      {
        plugin,
        source: "youtube",
        playFromSource: true,
        id: i.videoId,
        name: i.title,
        isLive: Boolean(i.isLive),
        duration: i.isLive ? 0 : toSecond(i.lengthSeconds),
        url: i.video_url || `https://youtu.be/${i.videoId}`,
        thumbnail: i.thumbnails?.sort((a, b) => b.width - a.width)?.[0]?.url,
        views: parseNumber(i.viewCount || (<any>i).view_count || (<any>i).views),
        likes: parseNumber(i.likes),
        uploader: {
          name: i.author?.name || i.author?.user,
          url:
            i.author?.channel_url || i.author?.external_channel_url || i.author?.user_url || i.author?.id
              ? `https://www.youtube.com/channel/${i.author.id}`
              : i.author?.user
                ? `https://www.youtube.com/${i.author.user}`
                : undefined,
        },
        ageRestricted: Boolean(i.age_restricted),
      },
      options,
    );
    this.chapters = i.chapters || [];
    this.storyboards = i.storyboards || [];
    this.related = info.related_videos || [];
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
          isLive: Boolean((<any>i).isLive),
          uploader: {
            name: i.author?.name,
            url:
              (<any>i).author?.url || (<any>i).author?.channelID
                ? `https://www.youtube.com/channel/${(<any>i).author.channelID}`
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
        thumbnail: (<any>info).thumbnail?.url,
        songs,
      },
      options,
    );
  }
}

export class YouTubeRelatedSong extends Song {
  constructor(plugin: YouTubePlugin, info: ytdl.relatedVideo) {
    if (!info.id) throw new DisTubeError("CANNOT_RESOLVE_SONG", info);
    super({
      plugin,
      source: "youtube",
      playFromSource: true,
      id: info.id,
      name: info.title,
      url: `https://youtu.be/${info.id}`,
      thumbnail: info.thumbnails?.sort((a, b) => b.width - a.width)?.[0]?.url,
      isLive: Boolean(info.isLive),
      duration: info.isLive ? 0 : toSecond(info.length_seconds),
      views: parseNumber(info.view_count),
      uploader:
        typeof info.author === "string"
          ? {
              name: info.author,
            }
          : {
              name: info.author?.name || info.author?.user,
              url:
                info.author?.channel_url ||
                info.author?.external_channel_url ||
                info.author?.user_url ||
                info.author?.id
                  ? `https://www.youtube.com/channel/${info.author.id}`
                  : info.author?.user
                    ? `https://www.youtube.com/${info.author.user}`
                    : undefined,
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
  constructor(plugin: YouTubePlugin, info: YtDlpSearchVideo) {
    super({
      plugin,
      source: "youtube",
      playFromSource: true,
      id: info.id,
      name: info.title,
      url: info.url || `https://youtu.be/${info.id}`,
      thumbnail: info.thumbnail,
      isLive: info.is_live || false,
      duration: toSecond(info.duration),
      views: parseNumber(info.view_count),
      uploader: {
        name: info.channel,
        url: info.channel_url,
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
  constructor(info: YtDlpSearchPlaylist) {
    this.id = info.id;
    this.name = info.title;
    this.url = info.url || `https://www.youtube.com/playlist?list=${info.id}`;
    this.uploader = {
      name: info.channel,
      url: info.channel_url,
    };
    this.length = info.playlist_count || 0;
  }
}