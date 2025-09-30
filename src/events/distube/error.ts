import { Events } from 'distube';
import { EmbedBuilder } from 'discord.js';
import type { Queue, Song } from 'distube';
import { DisTubeEvent, followUp, Metadata } from '../../auth.js';

export default class ErrorEvent extends DisTubeEvent<Events.ERROR> {
  readonly name = Events.ERROR;
  async run(error: Error, queue: Queue, song?: Song<Metadata>) {
    if (song) {
      await followUp(
        song.metadata.interaction,
        new EmbedBuilder()
          .setColor('Blurple')
          .setTitle('Sherwood')
          .setDescription(`Error: \`${error.message}\``),
        queue.textChannel!,
      );
    } else if (queue.textChannel) {
      await queue.textChannel.send({
        embeds: [
          new EmbedBuilder()
            .setColor('Blurple')
            .setTitle('Sherwood')
            .setDescription(`Error: \`${error.message}\``),
        ],
      });
    } else {
      console.error(error);
    }
    
    this.client.distube.voices.get(queue.voiceChannel)?.leave();
  }
}
