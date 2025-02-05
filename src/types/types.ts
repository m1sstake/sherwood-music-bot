import type {
  ChatInputCommandInteraction,
  ContextMenuCommandBuilder,
  SlashCommandBuilder,
  SlashCommandOptionsOnlyBuilder,
  SlashCommandSubcommandsOnlyBuilder,
} from 'discord.js';
import type { Awaitable } from 'distube';
import { DisTubeClient } from '../auth.js';

export abstract class Command {
  abstract readonly name: string;
  abstract readonly slashBuilder:
    | SlashCommandBuilder
    | ContextMenuCommandBuilder
    | SlashCommandSubcommandsOnlyBuilder
    | SlashCommandOptionsOnlyBuilder;
  readonly client: DisTubeClient;
  readonly inVoiceChannel: boolean = false;
  readonly playing: boolean = false;
  constructor(client: DisTubeClient) {
    this.client = client;
  }
  get distube() {
    return this.client.distube;
  }
  abstract onChatInput(
    interaction:
      | ChatInputCommandInteraction<'raw'>
      | ChatInputCommandInteraction<'cached'>,
  ): Awaitable<any>;
}
