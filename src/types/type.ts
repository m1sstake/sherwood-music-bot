import type { ClientEvents } from 'discord.js';
import type { Awaitable } from 'distube';
import { DisTubeClient } from '../auth.js';

export abstract class ClientEvent<T extends keyof ClientEvents> {
  client: DisTubeClient;
  abstract readonly name: T;
  constructor(client: DisTubeClient) {
    this.client = client;
  }

  get distube() {
    return this.client.distube;
  }

  abstract run(...args: ClientEvents[T]): Awaitable<void>;

  async execute(...args: ClientEvents[T]) {
    try {
      await this.run(...args);
    } catch (err) {
      console.error(err);
    }
  }
}
