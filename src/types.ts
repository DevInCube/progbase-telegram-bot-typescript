export interface User {
	username: string,
	fullname: string,
	group_id: string,
	student_id: number,
	telegram_id: string,
}

export interface TaskResult {
	username: string,
	course: string,
	task: string,
	updtime: string,
	source: string
	commit: string,
	score: number
}

export interface Commit {
	id?: number | null,
	username: string,
	course: string,
	task: string,
	updtime: string,
	source: string,
	commit: string,
	checktime: string | null,
	comment: string | null,
	score: number | null
}

export interface Task {
	id: string,
	module_id: string,
	type: string,
	title: string,
	score: number
	is_extra: boolean,
	is_published?: boolean
}