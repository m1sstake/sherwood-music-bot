import { DisTubeClient } from '../auth.js';
import {  ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder, VoiceBasedChannel } from 'discord.js';
import { Command } from '../types/types.js';
import YoutubeCastReceiver, { Player, Volume, DefaultDataStore, RESET_PLAYER_ON_DISCONNECT_POLICIES, Video } from 'yt-cast-receiver';

class YoutubePlayer extends Player {
    client: DisTubeClient;
    vc: VoiceBasedChannel;
    interaction: ChatInputCommandInteraction<'cached'>;
    videoUrl: string;

    constructor(client: DisTubeClient, vc: VoiceBasedChannel, interaction: ChatInputCommandInteraction<'cached'>) {
        super();
        this.client = client;
        this.vc = vc;
        this.interaction = interaction;
    }

    async doPlay(video: Video) {
        this.videoUrl = `https://youtu.be/${video.id}`;

        await this.client.distube.play(this.vc, this.videoUrl, {
            skip: true,
            metadata: { interaction: this.interaction },
        });

        return true;
    }

    doPause() {
        console.log('doPause');
        return Promise.resolve(true);
    }

    doResume() {
        this.client.distube.play(this.vc, this.videoUrl, {
            skip: false,
            metadata: { interaction: this.interaction },
        });

        return Promise.resolve(true);
    }

    async doStop() {
        // this.isStopping = true;

        // if (this.client.distube.queues.size > 0) {
        //     await this.client.distube.stop(this.interaction);
        // }

        // this.isStopping = false;

        return Promise.resolve(true);
    }

    doSetVolume(volume: Volume) {
        return Promise.resolve(true);
    }

    doGetVolume() {
        return Promise.resolve({ level: 0, muted: false });
    }

    doGetPosition() {
        return Promise.resolve(0);
    }

    doGetDuration() {
        return Promise.resolve(0);
    }

    doSeek(position: number) {
        this.client.distube.seek(this.interaction, position);
        return Promise.resolve(true);
    }
}

export default class LinkYtCommand extends Command {
  readonly name = 'linkyt';
  override readonly inVoiceChannel = true;
  readonly slashBuilder = new SlashCommandBuilder()
    .setName('linkyt')
    .setDescription('Link your YouTube account to your Discord account');

    async onChatInput(interaction: ChatInputCommandInteraction<'cached'>) {
        const vc = interaction.member?.voice?.channel;

        this.client.distube.voices.get(vc)?.join();

        const player = new YoutubePlayer(this.client, vc, interaction);
        

        const dataStore = new DefaultDataStore();
        await dataStore.clear();

        const receiver = new YoutubeCastReceiver(player, {
            dial: { port: 8099 }, // DIAL server port
            app: { resetPlayerOnDisconnectPolicy: RESET_PLAYER_ON_DISCONNECT_POLICIES.ALL_EXPLICITLY_DISCONNECTED },
            dataStore,
            device: {
                name: 'Sherwood Music',
                
            }
            });


            try {
                console.log('starting receiver');
                await receiver.start();
            } catch (error) {
                console.error(error);
            }

            receiver.on('senderConnect', () => {
                console.log('sender connected');
            })

            receiver.on('senderDisconnect', () => { 
                console.log('sender disconnected');
            })

            const service = receiver.getPairingCodeRequestService();

            service.start();

            console.log('getting service');

            service.on('request', () => {
                console.log('request');
            })

            service.on('response', async (code) => {
                const method = interaction.isRepliable() ? 'reply' : 'editReply';
                await interaction[method]({
                    embeds: [
                        new EmbedBuilder()
                            .setColor('Blurple')
                            .setTitle('Sherwood')
                            .setDescription(`Pairing code: \`${code}\``),
                    ],
                }); 
            })

            service.on('error', (error) => {
                console.error(error);
            })

        }
    



}