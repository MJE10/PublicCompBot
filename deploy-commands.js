import { SlashCommandBuilder } from '@discordjs/builders';
import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v9';
import config_json from './config.json';
const { clientId, guildId, token } = config_json

const commands = [
	new SlashCommandBuilder().setName('ping').setDescription('Replies with pong!'),
	new SlashCommandBuilder().setName('compete').setDescription('Start competing!')
		.addIntegerOption(option => option.setName('cover_number').setDescription('Cover Number').setRequired(true)),
	new SlashCommandBuilder().setName('scramble').setDescription('Start scrambling!'),
	new SlashCommandBuilder().setName('judge').setDescription('Start judging!')
		.addStringOption(option => option.setName('judge_name').setDescription('Display Name').setRequired(true)),
	new SlashCommandBuilder().setName('run').setDescription('Start running!'),
	new SlashCommandBuilder().setName('time').setDescription('Input user time')
		.addIntegerOption(option => option.setName('cover_number').setDescription('Cover Number').setRequired(true))
		.addStringOption(option => option.setName('time').setDescription('Time').setRequired(true)),
	new SlashCommandBuilder().setName('admin').setDescription('Use admin panel'),
	new SlashCommandBuilder().setName('results').setDescription('Get competition results')
		.addUserOption(option => option.setName('user').setDescription('User').setRequired(true))
]
	.map(command => command.toJSON());

const rest = new REST({ version: '9' }).setToken(token);

(async () => {
	try {
		await rest.put(
			Routes.applicationGuildCommands(clientId, guildId),
			{ body: commands },
		);

		console.log('Successfully registered application commands.');
	} catch (error) {
		console.error(error);
	}
})();