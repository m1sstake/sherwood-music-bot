import { ClientEvent } from '../../types/type.js';
import { type Client, Routes } from 'discord.js';

export default class ErrorEvent extends ClientEvent<'ready'> {
  readonly name = 'ready';
  async run(c: Client<true>): Promise<void> {
    console.log(`Logged in as ${c.user.tag}!`);
    console.log(`Cached guilds: ${c.guilds.cache.size}`);

    await c.rest.put(Routes.applicationCommands(c.user.id), {
      body: this.client.commands.map((c) => c.slashBuilder.toJSON()),
    });
  }
}
