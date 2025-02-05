import { DisTubeClient } from './auth.js';
import { GatewayIntentBits } from 'discord.js';

const client = new DisTubeClient({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent,
  ],
});

const TOKEN = process.env.TOKEN;

console.log(TOKEN);

if (!TOKEN) {
  throw new Error('Not token provided');
}

void client.login(process.env.TOKEN);
