import { Events } from 'distube';
import { EmbedBuilder } from 'discord.js';
import type { Queue, Song } from 'distube';
import { DisTubeEvent, Metadata } from '../../auth.js';

export default class AddSongEvent extends DisTubeEvent<Events.ADD_SONG> {
  readonly name = Events.ADD_SONG;
  run(_queue: Queue, song: Song<Metadata>) {
    song.metadata.interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor('Blurple')
          .setTitle('Sherwood')
          .setDescription(`Added \`${song.name}\` to the queue`),
      ],
    });
  }
}
