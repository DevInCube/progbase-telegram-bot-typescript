import * as rp from 'request-promise-native';

import config from './config';
import taskdb from './taskdb';

import * as telegram from 'telegram-bot-api';

import { Commit, Task, TaskResult, User } from './types';

interface TelegramMessage {
	chat: {
		id: string,
		username: string,
	},
	text: string
}

if (!config.services.telegram.bot_token) {
	console.error('Please, set you bot token in src/config.ts file');
	process.exit(1);
}

const api = new telegram({
	token: config.services.telegram.bot_token,
	updates: {
		enabled: true
	}
});

// register incoming user messages handler

api.on('message',
	(message: TelegramMessage) => processRequest(message)
		.catch(() => api.sendMessage({
			chat_id: message.chat.id,
			text: 'Something went wrong. Try again later.',
			parse_mode: 'Markdown'
		})));

// module API

// available bot commands

const BotCommands: { [id: string]: { id: string, description: string } } = {
	Start: { id: '/start', description: `subscribe for my notifications` },
	Progbase: { id: '/progbase', description: `get all your scores report of Progbase module` },
	Progbase2: { id: '/progbase2', description: `get all your scores report of Progbase2 module` },
	WebProgbase: { id: '/webprogbase', description: `get all your scores report of WebProgbase module` },
	RandomCatImage: { id: '/cat', description: `get random cat image :3` },
	Help: { id: '/help', description: `get my help` },
};

let commandToModuleId = (command: string) => command.substr(1);

// main handler

let processRequest = async (message: TelegramMessage) => {
	let chat_id = message.chat.id;
	let username = message.chat.username;
	let parse_mode = 'Markdown';
	let command = message.text;

	console.log(`Got command: '${command}'`);
	if (command === BotCommands['Start'].id) {
		let text = await registerUser(chat_id, username);
		return api.sendMessage({ chat_id, text, parse_mode });
	} else if ([BotCommands['Progbase'].id, BotCommands['Progbase2'].id, BotCommands['WebProgbase'].id].includes(command)) {
		let text = await getModuleUserResults(username, commandToModuleId(command))
		return api.sendMessage({ chat_id, text, parse_mode });
	} else if (command === BotCommands['RandomCatImage'].id) {
		let link = await getRandomCatPhoto();
		return api.sendPhoto({ chat_id, caption: 'Meow', photo: link });
	} else {
		let text = prepareUndefinedCommandText(username, command);
		return api.sendMessage({ chat_id, text, parse_mode });
	}
};

// bot command handlers

let getModuleUserResults = async (username: string, module_id: string) => {
	let user = await getTelegramUser(username);
	if (!user) {
		return `User with Telegram username *${username}*` +
			` is not registered on Progbase.`;
	} else {
		let [task_results, tasks] = await Promise.all([
			taskdb.getTelegramUserResults(username, module_id),
			taskdb.getModuleAllTasks(module_id)
		]);
		return prepareModuleResults(module_id, task_results, (tasks as Task[]).filter(x => x.is_published));
	}
};

let registerUser = (chat_id: string, username: string) =>
	getTelegramUser(username)
		.then(user => {
			if (!user) {
				return `User with Telegram username *${username}*` +
					` is not registered on Progbase.`;
			} else {
				return taskdb.setTelegramId(username, chat_id)
					.then(() => `Hello, *Master ${username}*! ` +
						`Now you are subscribed to my notifications` +
						'\r\n\r\nUse /help for my help.');
			}
		});

let getRandomCatPhoto = () =>
	getJson('http://random.cat/meow')
		.then(x => x.file.replace('\\', ''));

// message renders

function getTaskUrlType(task: Task): string {
	switch (task.type) {
		case "task": return "homeworks";
		case "lab": return "labs";
		case "test": return "tests";
		default: throw `Unsupported task type '${task.type}'`;
	}
}

function getModuleLink(module_id: string): string {
	return `https://progbase.herokuapp.com/modules/${module_id}`;
}

function getTaskLink(task: Task): string {
	return `${getModuleLink(task.module_id)}/${getTaskUrlType(task)}/${task.id}`;
}

const Markdown = {
	newLine: '  \r\n',
	paragraph: '\r\n\r\n'
};

let prepareCommitCheckMessage = (task: Task, commit: Commit) => {
	let score = `*${commit.score || '-'}*`;
	let comment = commit.comment ? `${Markdown.paragraph}${commit.comment}` : ``;
	return `Your task was checked:${Markdown.newLine}*"${task.title}"*${Markdown.newLine}` +
		`[${commit.course}/${commit.task}](${getTaskLink(task)})${Markdown.paragraph}` +
		`Score: ${score}/${task.score}${comment}`;
};

function renderTaskGroup(title: string, task_results: TaskResult[], tasks: Task[]): { text: string, total: number, max_total: number } {
	let total = 0;
	let max_total = 0;
	let text = `*${title}* (${tasks.length}):${Markdown.newLine}`;
	for (let task of tasks) {
		let res = task_results
			.find(result => result.task === task.id);
		let score = (res && res.score) ? res.score : 0;
		let maxScore = task.score || 0;
		total += score;
		max_total += maxScore;
		text += `*${score}*/${maxScore}: \`${task.id}\`${Markdown.newLine}`;
	}
	return { text, total, max_total };
}

let prepareModuleResults = (module_id: string, task_results: TaskResult[], tasks: Task[]) => {
	let text = `Your scores in module [${module_id}](${getModuleLink(module_id)}):${Markdown.paragraph}`;

	let requiredTasks = tasks.filter(x => !x.is_extra);
	let extraTasks = tasks.filter(x => x.is_extra);
	let requiredScore = 0;
	let maxRequiredScore = 0;
	let extraScore = 0;
	let maxExtraScore = 0;

	text += `Required tasks (${requiredTasks.length}):${Markdown.newLine}\`---\`${Markdown.newLine}`;
	let homeworks = renderTaskGroup('Homeworks', task_results, requiredTasks.filter(x => x.type === 'task'));
	text += homeworks.text;
	requiredScore += homeworks.total;
	maxRequiredScore += homeworks.max_total;
	let labs = renderTaskGroup('Labs', task_results, requiredTasks.filter(x => x.type === 'lab'));
	text += labs.text;
	requiredScore += labs.total;
	maxRequiredScore += labs.max_total;
	let tests = renderTaskGroup('Tests', task_results, requiredTasks.filter(x => x.type === 'test'));
	text += tests.text;
	requiredScore += tests.total;
	maxRequiredScore += tests.max_total;
	text += `\`---\`${Markdown.newLine}*${requiredScore}*/${maxRequiredScore} _total required scores_`;

	if (extraTasks.length > 0) {
		text += `${Markdown.paragraph}`;
		let homeworks = renderTaskGroup('Extra tasks', task_results, extraTasks);
		text += homeworks.text;
		extraScore += homeworks.total;
		maxExtraScore += homeworks.max_total;
		text += `\`---\`${Markdown.newLine}*${extraScore}*/${maxExtraScore} _total extra scores_`;

		text += `${Markdown.paragraph}\`===\`${Markdown.newLine}*${requiredScore + extraScore}*/${maxRequiredScore + maxExtraScore}  _total scores_`;
	}
	text += `${Markdown.paragraph}/help`;
	return text;
};

let prepareUndefinedCommandText = (username: string, request: string) => {
	let text = ``;
	if (request !== BotCommands['Help'].id)
		text += `I can't understand your command *Master ${username}*.${Markdown.newLine}`;
	text += `What can I do for you?${Markdown.newLine}`;
	for (let commandKey of Object.keys(BotCommands)) {
		let command = BotCommands[commandKey];
		text += `${command.id} - ${command.description}${Markdown.newLine}`;
	}
	return text;
};

// utils

let getTelegramUser = (username: string) => taskdb.getTelegramByUsername(username);

let getJson = (url: string) =>
	rp({ url })
		.then(response => JSON.parse(response));

export default class Telegram {
	static async sendCommitMessageToUser(user: User, task: Task, commit: Commit): Promise<void> {
		await api.sendMessage({
			chat_id: user.telegram_id,
			text: prepareCommitCheckMessage(task, commit),
			parse_mode: 'Markdown'
		});
	}
}

console.log('Module loaded. Now you can use your bot');