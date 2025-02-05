import { DisTubeEvent } from '../../auth.js';
import { Events, type Queue } from 'distube';

export default class InitQueueEvent extends DisTubeEvent<Events.INIT_QUEUE> {
  readonly name = Events.INIT_QUEUE;
  run(queue: Queue) {
    queue.volume = 100;
  }
}
