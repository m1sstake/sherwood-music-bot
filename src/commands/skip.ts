import { Command } from '../types/types.js';
import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';

export default class SkipCommand extends Command {
  readonly name = 'skip';
  override readonly inVoiceChannel = true;
  override readonly playing = true;
  readonly slashBuilder = new SlashCommandBuilder()
    .setName('skip')
    .setDescription('Skip the current song');
  async onChatInput(
    interaction: ChatInputCommandInteraction<'cached'>,
  ): Promise<void> {
    try {
      const queue = this.distube.getQueue(interaction);

      const isLastSong = queue.songs.length === 1;

      if (isLastSong) {
        await this.distube.stop(interaction);

        void interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor('Blurple')
              .setTitle('Sherwood')
              .setDescription('Stopped'),
          ],
        });

        return;
      }

      const song = await this.distube.skip(interaction);

      void interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor('Blurple')
            .setTitle('Sherwood')
            .setDescription(`Skipped to \`${song.name || song.url}\``),
        ],
      });
    } catch (e) {
      console.error(e);
      void interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor('Blurple')
            .setTitle('Sherwood')
            .setDescription(`Error: \`${e}\``),
        ],
      });
    }
  }
}
