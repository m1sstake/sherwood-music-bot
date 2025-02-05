import { Command } from '../types/types.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { RepeatMode } from 'distube';

export default class RepeatCommand extends Command {
  readonly name = 'repeat';
  override readonly inVoiceChannel = true;
  override readonly playing = true;
  readonly slashBuilder = new SlashCommandBuilder()
    .setName('repeat')
    .setDescription('Toggle repeat');
  async onChatInput(interaction: ChatInputCommandInteraction<'cached'>) {
    try {
      const queue = this.distube.getQueue(interaction);

      const currentMode =
        queue.repeatMode !== RepeatMode.DISABLED
          ? RepeatMode.DISABLED
          : RepeatMode.QUEUE;

      this.distube.setRepeatMode(interaction, currentMode);

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor('Blurple')
            .setTitle('Sherwood')
            .setDescription(
              `Repeat: \`${currentMode === RepeatMode.DISABLED ? 'Off' : 'On'}\``,
            ),
        ],
      });
    } catch (e) {
      console.error(e);
      interaction.reply({
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
