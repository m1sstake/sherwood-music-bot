import { join, dirname } from 'path';
import { readdirSync, readFileSync } from 'fs';
import { DisTube, DisTubePlugin } from 'distube';
import { YouTubePlugin } from '@distube/youtube';
import { SpotifyPlugin } from '@distube/spotify';
import { FilePlugin } from '@distube/file';
import { Client, Collection } from 'discord.js';
import { fileURLToPath } from 'url';
import type { Awaitable, DisTubeEvents } from 'distube';
import type {
  ChatInputCommandInteraction,
  // ClientEvents,
  ClientOptions,
  // ContextMenuCommandBuilder,
  EmbedBuilder,
  GuildTextBasedChannel,
  // SlashCommandBuilder,
  // SlashCommandOptionsOnlyBuilder,
  // SlashCommandSubcommandsOnlyBuilder,
} from 'discord.js';
import { DirectLinkPlugin } from '@distube/direct-link';
import { Command } from './types/types.js';
import ytdl, { Agent } from '@distube/ytdl-core';

export const followUp = async (
  interaction: ChatInputCommandInteraction,
  embed: EmbedBuilder,
  textChannel: GuildTextBasedChannel,
) => {
  // Follow up interaction if created time is less than 15 minutes
  if (Date.now() - interaction.createdTimestamp < 15 * 60 * 1000) {
    await interaction.followUp({ embeds: [embed] });
  } else {
    await textChannel.send({ embeds: [embed] });
  }
};

function getYoutubeCookies(): ytdl.Cookie[] {
  try {
    return JSON.parse(readFileSync('./cookies.json', { encoding: 'utf-8' }));

    console.log('Cookies load');
  } catch (e) {
    console.log(e);

    return [];
  }
}

function getYoutubeAgent(): Agent {
  const cookies = getYoutubeCookies();

  return ytdl.createAgent(cookies);
}

export class DisTubeClient extends Client<true> {
  distube = new DisTube(this, {
    plugins: [
      new YouTubePlugin({
        ytdlOptions: {
          agent: getYoutubeAgent(),
        },
        cookies: getYoutubeCookies(),
      }),
      new SpotifyPlugin() as unknown as DisTubePlugin,
      new DirectLinkPlugin() as unknown as DisTubePlugin,
      new FilePlugin() as unknown as DisTubePlugin,
    ],
    emitAddListWhenCreatingQueue: true,
    emitAddSongWhenCreatingQueue: true,
  });
  commands = new Collection<string, Command>();

  constructor(options: ClientOptions) {
    super(options);

    const __filename = fileURLToPath(import.meta.url);

    const __dirname = dirname(__filename);

    readdirSync(join(__dirname, 'events', 'client')).forEach(
      this.loadEvent.bind(this),
    );
    readdirSync(join(__dirname, 'events', 'distube')).forEach(
      this.loadDisTubeEvent.bind(this),
    );
    readdirSync(join(__dirname, 'commands')).forEach(
      this.loadCommand.bind(this),
    );
  }

  async loadCommand(name: string) {
    try {
      const CMD = await import(`./commands/${name}`);
      const cmd: Command = new CMD.default(this);
      this.commands.set(cmd.name, cmd);
      console.log(`Loaded command: ${cmd.name}.`);
      return false;
    } catch (err) {
      const e = `Unable to load command ${name}: ${err.stack || err}`;
      console.error(e);
      return e;
    }
  }

  async loadEvent(name: string) {
    try {
      const E = await import(`./events/client/${name}`);
      const event = new E.default(this);
      const fn = event.run.bind(event);
      this.on(event.name, fn);
      console.log(`Listened client event: ${event.name}.`);
      return false;
    } catch (err) {
      const e = `Unable to listen "${name}" event: ${err.stack || err}`;
      console.error(e);
      return e;
    }
  }

  async loadDisTubeEvent(name: string) {
    try {
      const E = await import(`./events/distube/${name}`);
      const event = new E.default(this);
      const fn = event.run.bind(event);
      this.distube.on(event.name, fn);
      console.log(`Listened DisTube event: ${event.name}.`);
      return false;
    } catch (err) {
      const e = `Unable to listen "${name}" event: ${err.stack || err}`;
      console.error(e);
      return e;
    }
  }
}

export interface Metadata {
  interaction: ChatInputCommandInteraction<'cached'>;
  // Example for strict typing
}

export abstract class DisTubeEvent<T extends keyof DisTubeEvents> {
  client: DisTubeClient;
  abstract readonly name: T;
  constructor(client: DisTubeClient) {
    this.client = client;
  }

  get distube() {
    return this.client.distube;
  }

  abstract run(...args: DisTubeEvents[T]): Awaitable<void>;

  async execute(...args: DisTubeEvents[T]) {
    try {
      await this.run(...args);
    } catch (err) {
      console.error(err);
    }
  }
}
