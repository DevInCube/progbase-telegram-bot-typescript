import { User, Task, TaskResult } from './types';

// this is a mockup module

export default {
    getTelegramUserResults: async function (username: string, module_id: string): Promise<TaskResult[]> {
        return [];  // @todo provide your own implementation
    },

    getModuleAllTasks: async function (module_id: string): Promise<Task[]> {
        return [];  // @todo provide your own implementation
    },

    setTelegramId: async function (username: string, chat_id: string) : Promise<void> {
        // @todo provide your own implementation
    },

    getTelegramByUsername: async function (username: string) : Promise<User> {
        // @todo provide your own implementation
        return {
            username,
            fullname: 'fake_user',
            group_id: '2016_kp61',
            student_id: 1,
            telegram_id: ""
        };
    }
};