import { Command } from '../types/types.js';
import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import type { Metadata } from '../auth.js';
import type { ChatInputCommandInteraction } from 'discord.js';

export default class PlayCommand extends Command {
  readonly name = 'play';
  override readonly inVoiceChannel = true;
  readonly slashBuilder = new SlashCommandBuilder()
    .setName('play')
    .setDescription(
      'Play music from a supported URL (all provider) or search a query',
    )
    .addStringOption((opt) =>
      opt
        .setName('input')
        .setDescription('A supported URL or a search query')
        .setRequired(true),
    )
    .addNumberOption((opt) =>
      opt.setName('seek').setDescription('Seek').setRequired(false),
    );

  async onChatInput(interaction: ChatInputCommandInteraction<'cached'>) {
    const input = interaction.options.getString('input', true);

    const seek = interaction.options.getNumber('seek', false) ?? undefined;

    const vc = interaction.member?.voice?.channel;

    if (!vc) {
      return;
    }

    await interaction.deferReply();

    this.client.distube
      .play<Metadata>(vc, input, {
        skip: false,
        position: undefined,
        textChannel: interaction.channel ?? undefined,
        member: interaction.member,
        metadata: { interaction },
      })
      .then(() => {
        if (seek) {
          console.log('seek', seek);
          this.distube.seek(interaction, seek);
        }
      })
      .catch((e) => {
        console.error(e);
        interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor('Red')
              .setTitle('Sherwood Music')
              .setDescription(`Error: \`${e.message}\``),
          ],
        });
      });
  }
}
