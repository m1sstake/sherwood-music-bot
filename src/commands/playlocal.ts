import {
  type ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
} from 'discord.js';
import { Command } from '../types/types.js';
import { resolve } from 'node:path';
import { Metadata } from '../auth.js';
import { LOCAL_TRACKS } from '../consts/local-tracks.js';

export default class PlaylocalCommand extends Command {
  readonly name = 'playlocal';
  override readonly inVoiceChannel = true;
  readonly slashBuilder = new SlashCommandBuilder()
    .setName('playlocal')
    .setDescription('Play local tracks')
    .addStringOption((opt) =>
      opt
        .setName('track')
        .setDescription('The gif category')
        .setRequired(true)
        .addChoices(LOCAL_TRACKS),
    );

  async onChatInput(interaction: ChatInputCommandInteraction<'cached'>) {
    try {
      const track = interaction.options.getString('track', true);

      const vc = interaction.member?.voice?.channel;

      if (!vc) {
        return;
      }

      const currentPathOfLocalMusic = resolve(track);

      if (!currentPathOfLocalMusic) {
        void interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor('Blurple')
              .setTitle('Sherwood')
              .setDescription(`Error: can not find local track`),
          ],
        });

        return;
      }

      void this.client.distube.play<Metadata>(
        vc,
        `file://${currentPathOfLocalMusic}`,
        {
          metadata: { interaction },
          member: interaction.member,
          textChannel: interaction.channel ?? undefined,
        },
      );
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
