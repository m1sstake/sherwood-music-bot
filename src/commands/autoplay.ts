import { Command } from '../types/types.js';
import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';

export default class AutoplayCommand extends Command {
  readonly name = 'autoplay';
  override readonly inVoiceChannel = true;
  override readonly playing = true;
  readonly slashBuilder = new SlashCommandBuilder()
    .setName('autoplay')
    .setDescription('Toggle autoplay');
  async onChatInput(interaction: ChatInputCommandInteraction<'cached'>) {
    try {
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor('Blurple')
            .setTitle('Sherwood')
            .setDescription(
              `Autoplay: \`${this.distube.toggleAutoplay(interaction) ? 'On' : 'Off'}\``,
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
