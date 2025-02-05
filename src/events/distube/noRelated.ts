import { Events } from 'distube';
import { Colors, EmbedBuilder } from 'discord.js';
import type { DisTubeError, Queue } from 'distube';
import { DisTubeEvent } from '../../auth.js';

export default class NoRelatedEvent extends DisTubeEvent<Events.NO_RELATED> {
  readonly name = Events.NO_RELATED;
  run(queue: Queue, error: DisTubeError) {
    queue.textChannel?.send({
      embeds: [
        new EmbedBuilder()
          .setColor(Colors.Red)
          .setTitle('Sherwood')
          .setDescription(error.message),
      ],
    });
  }
}
