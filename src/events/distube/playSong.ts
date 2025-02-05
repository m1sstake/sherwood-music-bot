import { Events } from 'distube';
import { EmbedBuilder } from 'discord.js';
import type { Queue, Song } from 'distube';
import { DisTubeEvent, followUp, Metadata } from '../../auth.js';

export default class PlaySongEvent extends DisTubeEvent<Events.PLAY_SONG> {
  readonly name = Events.PLAY_SONG;
  run(queue: Queue, song: Song<Metadata>): void {
    followUp(
      song.metadata.interaction,
      new EmbedBuilder()
        .setColor('Blurple')
        .setTitle('Sherwood')
        .setDescription(`Playing: \`${song.name}\``),
      queue.textChannel!,
    ).catch(console.error);
  }
}
