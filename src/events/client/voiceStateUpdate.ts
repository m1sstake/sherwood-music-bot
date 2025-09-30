import { ClientEvent } from '../../types/type.js';
import type { VoiceState } from 'discord.js';
import { isVoiceChannelEmpty } from 'distube';

export default class VoiceStateUpdateEvent extends ClientEvent<'voiceStateUpdate'> {
  readonly name = 'voiceStateUpdate';

  async run(oldState: VoiceState) {
    if (!oldState?.channel) {
      return;
    }
    const voice = this.client.distube.voices.get(oldState);
    if (voice && isVoiceChannelEmpty(oldState)) {
      voice.leave();
    }
  }
}
