import { Events } from 'distube';
import { DisTubeEvent } from '../../auth.js';

export default class DebugEvent extends DisTubeEvent<Events.DEBUG> {
  readonly name = Events.DEBUG;
  run(message: string) {
    console.log(message);
  }
}
