// noinspection JSCheckFunctionSignatures

import discord_js from 'discord.js';
const { Client, Intents, MessageActionRow, MessageSelectMenu, MessageButton} = discord_js;
import { Competition } from './compFunctions.js';
import Connection from 'mysql'

export class DiscordClient {
    /**
     * @param {Connection} connection
     * @param {Competition} competition
     */
    constructor(connection, competition) {
        this.connection = connection;
        this.competition = competition;

        this.competition.registerClient('discord', this);

        this.client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES] });

        this.client.once('ready', () => {
            console.log('Ready!');
        });

        this.constants = {
            GUILD_ID: '',
            CHANNEL_HOME: '',
            CATEGORY_COMPETITIONS: '',
            CHANNEL_RESULTS: '',
            RESULTS_MESSAGE: '',
            ROLE_MODERATOR: ''
        }

        this.client.on('messageCreate', async message => {
            if (message.author.id !== this.client.user.id) {
                // if it isn't the bot
                if (message.channelId === this.constants.CHANNEL_HOME) {
                    // home channel - user wants to start something new
                    if ((await message.guild.roles.fetch('')).members.has(message.author.id)) {
                        if (message.content === 'admin') {
                            const new_channel = await message.guild.channels.create(message.author.username + '-admin', {parent: this.constants.CATEGORY_COMPETITIONS});
                            await new_channel.permissionOverwrites.create(message.author.id, {'VIEW_CHANNEL': true, 'SEND_MESSAGES': true});
                            await this.competition.userInput('discord_' + new_channel.id + "_" + message.author.id, 'admin', true);
                            await message.delete();
                        }
                    }

                    if (message.content === 'start') {
                        const new_channel = await message.guild.channels.create(message.author.username, {parent: this.constants.CATEGORY_COMPETITIONS});
                        await new_channel.permissionOverwrites.create(message.author.id, {'VIEW_CHANNEL': true, 'SEND_MESSAGES': true});
                        await message.reply('Ok! Please go to <#' + new_channel.id + '>');

                        await this.competition.userInput('discord_' + new_channel.id + "_" + message.author.id, 'start', true);
                    }
                } else {
                    // not in home channel - send input to compFunctions
                    if (message.content.substring(0, 4) === 'sudo' && (await message.guild.roles.fetch(this.constants.ROLE_MODERATOR)).members.has(message.author.id))
                        await this.competition.userInput('discord_' + message.channelId, message.content.substring(5), true);
                    else await this.competition.userInput('discord_' + message.channelId, message.content);
                }
            }
        });

        // send interaction responses straight to compFunctions
        this.client.on('interactionCreate', async interaction => {
            await interaction.update({components:[]});
            if (interaction.isSelectMenu()) {
                await this.sendMessageToUser('discord_' + interaction.channelId, 'You clicked: ' + interaction.values[0]);
                await this.competition.userInput('discord_' + interaction.channelId, interaction.values[0]);
            } else if (interaction.isButton()) {
                await this.sendMessageToUser('discord_' + interaction.channelId, 'You clicked: ' + interaction.customId);
                await this.competition.userInput('discord_' + interaction.channelId, interaction.customId);
            }
        });

        // Login to Discord with your client's token
        this.query("SELECT * FROM globals WHERE name = 'token'", result => this.client.login(result[0]['value_string']));

        this.fetchResults("NOT THE OLD RESULTS");
    }

    async sendMessageToUser(address, content, buttons=[], callback=()=>{}, files=[]) {
        content = content.replace('{{@Moderator}}', '<@&' + this.constants.ROLE_MODERATOR + '>');
        let components = [];
        if (buttons.length > 5) {
            components.push(generateSelectMenu(buttons));
        } else if (buttons.length > 0) {
            let buttonJsonList = [];
            for (const b in buttons) buttonJsonList.push({id: buttons[b], label: buttons[b]});
            const buttonRow = generateButtonRow(buttonJsonList);
            components.push(buttonRow);
        }
        const channel = await (await this.client.guilds.fetch(this.constants.GUILD_ID)).channels.fetch(address.split('_')[1]).catch(()=>{return null});
        if (channel != null) {
            if (files.length > 1) {
                for (let i = 0; i < files.length; i++) await channel.send({files: [files[i]]});
                await (await channel.send({content: content, components: components}).then(message => callback(message.id)));
            } else {
                await (await channel.send({content: content, components: components, files: files}).then(message => callback(message.id)));
            }
        }
    }

    async updateLastMessageToUser(address, content, buttons=[], lastMessageId) {
        content = content.replace('{{@Moderator}}', '<@&' + this.constants.ROLE_MODERATOR + '>');
        let components = [];
        if (buttons.length > 0) {
            let buttonJsonList = [];
            for (const b in buttons) buttonJsonList.push({id: buttons[b], label: buttons[b]});
            const buttonRow = generateButtonRow(buttonJsonList);
            components.push(buttonRow);
        }
        try {
            await (await (await (await this.client.guilds.fetch(this.constants.GUILD_ID)).channels.fetch(address.split('_')[1])).messages.fetch(lastMessageId)).edit({
                content: content,
                components: components
            });
        } catch (e) {
            console.log('Tried to send a message to a deceased channel.');
        }
    }

    async endCompetition(closedChannels) {
        for (const c in closedChannels) {
            try {
                await (await this.client.channels.fetch(closedChannels[c].split('_')[1])).delete();
            } catch (e) {
                console.log('Tried to close a nonexistent channel.');
            }
        }
    }

    async getUserName(snowflake) {
        const member = (await (await this.client.guilds.fetch(this.constants.GUILD_ID)).members.fetch(snowflake));
        if (member !== null) return member.nickname || member.displayName;
        return "Anonymous";
    }

    async query(query, callback) {
        this.connection.query(query, (err, result, _) => {
            if (err) {
                console.log(err);
            }
            callback(result);
        });
    }

    async updateResults(results) {
        if (results) results = JSON.parse(results);
        const server = await this.client.guilds.fetch(this.constants.GUILD_ID);
        const channel = await server.channels.fetch(this.constants.CHANNEL_RESULTS);
        const message = await channel.messages.fetch(this.constants.RESULTS_MESSAGE);
        if (!results) await message.edit('There is no active competition!');
        else if (results.length === 0) await message.edit('There are no results yet!');
        else {
            let resultsStr = "Best singles results:\n";
            for (const r in results) {
                let byStr = "";
                if (results[r]['personal_address'] && results[r]['personal_address'] !== "" && results[r]['personal_address'] !== "undefined") byStr = ' by <@' + results[r]['personal_address'] + '>'
                resultsStr += (parseInt(r)+1) + ": " + results[r]['time'].toFixed(2) + byStr + '\n';
            }
            await message.edit(resultsStr.substring(0, 1999));
        }
    }

    async fetchResults(oldResultsStr, repeat=true) {
        await this.competition.getResults(results => {
            let resultsStr = JSON.stringify(results);
            if (oldResultsStr !== resultsStr) this.updateResults(resultsStr);
            if (repeat) setTimeout(() => {this.fetchResults(resultsStr)}, 3000);
        });
    }
}

function generateButtonRow(buttonValues) {
    const buttons = new MessageActionRow();

    buttonValues.forEach(button => {
        if (!button['style']) button['style'] = 'PRIMARY'
        buttons.addComponents(
            new MessageButton()
                .setCustomId(button['id'])
                .setLabel(button['label'])
                .setStyle(button['style'])
        )
    });

    return buttons;
}

function generateSelectMenu(options) {

    let optionsJson = [];
    
    console.log(options);
    for (let o = 0; o < options.length; o++) optionsJson.push({
        label: options[o],
        description: options[o],
        value: options[o]
    });

    return new MessageActionRow()
    .addComponents(
        new MessageSelectMenu()
            .setCustomId('select')
            .setPlaceholder('Select One')
            .addOptions(optionsJson),
        );
}