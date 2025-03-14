export const clone_object = <T extends unknown = unknown>(obj: T): T => {
	if (Array.isArray(obj)) return obj.map(clone_object) as T
	if (obj === null) return null as T
	if (typeof obj !== 'object') return obj
	return Object.fromEntries(Object.entries(obj).map(([key,value]) => [ key, clone_object(value) ])) as T;
}
export const unique_list_strings = <T extends unknown = unknown>(list: Array<T>, getId: ((item: T) => string) = item => item as string): Array<T> => Object.values(Object.fromEntries(list.map(item=>[getId(item),item])));
const reduce_get_path_object = <T extends unknown = unknown, O extends unknown = unknown>(obj: T | O | undefined, step: PathUnit): T | undefined => obj ? ((obj as any)[step] as T) : undefined
export const get_path_object = <T extends unknown = unknown, O extends unknown = unknown>(object: O, path: Path = []): undefined | T => (path.reduce(reduce_get_path_object<T,O>, object) as (T | undefined))
export const set_path_object = <T extends unknown = unknown>(object: T, path: Path = [], value: unknown = undefined): T => {
	if (path.length === 0 || typeof object !== 'object' || !object) return value as T
	if (Array.isArray(object)) return [ ...object.slice(0, path[0] as number), set_path_object(object[path[0] as number], path.slice(1), value), ...object.slice(1 + (path[0] as number)) ] as T
	return { ...object, [path[0]]: set_path_object((object as Record<string,unknown>)[path[0] as string], path.slice(1), value), }
}
export const update_path_object = <T extends unknown = unknown, O extends unknown = unknown>(object: O, path: Path = [], transformer: ((original: T, path: Path, object: O) => T) = ident) => set_path_object(object, path, transformer(get_path_object<T>(object, path)!, path, object))
const map_list_path_object = ([ key, value ]: [ string, unknown ]): Array<Path> => list_path_object(value).map(path => [ key, ...path ])
export const list_path_object = (object: unknown): Array<Path> => typeof object !== 'object' || !object ? [[]] : ([[]] as Array<Path>).concat(...Object.entries(object).map(map_list_path_object))
export const normalise_function = (functOrResult: Function | unknown): Function => (typeof functOrResult === 'function') ? functOrResult : () => functOrResult
const reduce_deep_merge_object = <T extends unknown = unknown>(base: T, override: unknown): T => {
	if (!((base && typeof base === 'object') && !Array.isArray(base) && (override && typeof override === 'object') && !Array.isArray(override)))
		return override as T;
	const allKeys = unique_list_strings(Object.keys(base).concat(Object.keys(override)));
	return Object.fromEntries(allKeys.map(key => [ key, key in override ? deep_merge_object((base as Record<string,unknown>)[key], (override as Record<string,unknown>)[key]) : (base as Record<string,unknown>)[key] ])) as T;
}
export const deep_merge_object = <T extends unknown = unknown>(base: T, ...overrides: Array<unknown>): T => overrides.reduce(reduce_deep_merge_object<T>, base)
export const shallow_merge_object = <T extends unknown = unknown>(a: T, ...objects: Array<Partial<T>>): T => Object.fromEntries(([] as Array<[string, unknown]>).concat(...[a,...objects].map(object => Object.entries(object)))) as T
export const get_closest_path = <T extends unknown = unknown, O extends unknown = unknown>(object: O, path: Path = [], condition: ((item: T, path: Path, object: O) => boolean) = () => true): Path | null => {
const item = get_path_object<T>(object, path)!
if (condition(item, path, object)) return path
if (path.length === 0) return null
return get_closest_path(object, path.slice(0,-1), condition)
}
export const wait_time = (delay: number): Promise<void> => (delay ? new Promise(resolve => setTimeout(resolve, delay)) : Promise.resolve())
export const name = (obj: Function | { name?: string } | (Array<unknown> & { name?: string })): string | undefined => obj.name
export const named = <T extends unknown = unknown>(name: string, obj: T): T & { name: string } => {
	const type = typeof obj
	if (typeof obj === 'function') return ({ [name]: (...args: Array<unknown>) => obj(...args) })[name] as T & { name: string }
	if (typeof obj === 'object' && !Array.isArray(obj)) return { ...obj, name }
	const ret = Array.isArray(obj) ? [...obj] : obj;
	(ret as T & { name: string }).name = name
	return (ret as T & { name: string })
}
export const ident = <T extends unknown = unknown>(original: T): T => original
export const inc = <State extends InitialState = InitialState>(property: keyof State, by: number = 1): ((state: SystemState<State>) => ChangesType<State>) => named(`${by === 1 ? 'increment ':''}${by === -1 ? 'decrement ':''}${String(property)}${Math.sign(by) === 1 && by !== 1 ? ` plus ${by}`:''}${Math.sign(by) === -1 && by !== -1 ? ` minus ${Math.abs(by)}`:''}`, ({ [property]: i }) => ({ [property]: (i as number) + by } as ChangesType<State>))
export const and = <Args extends Array<unknown> = Array<unknown>>(...methods: Array<(...args: Args) => boolean>): ((...args: Args) => boolean) => named(methods.map(name).join(' and '), (...args) => methods.every(method => method(...args)))
export const or = <Args extends Array<unknown> = Array<unknown>>(...methods: Array<(...args: Args) => boolean>): ((...args: Args) => boolean) => named(methods.map(name).join(' or '), (...args) => methods.some(method => method(...args)))
export const not = <Args extends Array<unknown> = Array<unknown>>(method: ((...args: Args) => boolean)): ((...args: Args) => boolean) => named(`not ${method.name}`, (...args) => !method(...args))
export const forIn = <
	State extends InitialState = InitialState,
	Output extends unknown = undefined,
	Input extends Array<unknown> = [Partial<InputSystemState<State, Output>>] | [],
	Action extends unknown = ActionType<State, Output>,
	Process extends unknown = ProcessType<State, Output, Action>,
>(list: string, index: string, ...methods: Array<Process>): Process => named(`for ${index} in ${list}`, [ named(`reset ${index}`, () => ({ [index]: 0 })), { while: named(`${index} is within ${list}`, ({ [index]: i, [list]: l }: State) => (i as number) < (l as Array<unknown>).length), do: [ methods, inc(index) ] } ]) as Process
export class SuperSmallStateMachineError<
	State extends InitialState = InitialState,
	Output extends unknown = undefined,
	Input extends Array<unknown> = [Partial<InputSystemState<State, Output>>] | [],
	Action extends unknown = ActionType<State, Output>,
	Process extends unknown = ProcessType<State, Output, Action>,
> extends Error {
	public instance?: Partial<S<State, Output, Input, Action, Process>>
	public state?: SystemState<State, Output>
	public data?: any
	constructor(message: string, { instance, state, data }: Partial<SuperSmallStateMachineError<State, Output, Input, Action, Process>>) {
		super(message)
		Object.assign(this, { instance, state, data })
	}
}
export class SuperSmallStateMachineReferenceError<
	State extends InitialState = InitialState,
	Output extends unknown = undefined,
	Input extends Array<unknown> = [Partial<InputSystemState<State, Output>>] | [],
	Action extends unknown = ActionType<State, Output>,
	Process extends unknown = ProcessType<State, Output, Action>,
> extends SuperSmallStateMachineError<State, Output, Input, Action, Process> {}
export class SuperSmallStateMachineTypeError<
	State extends InitialState = InitialState,
	Output extends unknown = undefined,
	Input extends Array<unknown> = [Partial<InputSystemState<State, Output>>] | [],
	Action extends unknown = ActionType<State, Output>,
	Process extends unknown = ProcessType<State, Output, Action>,
> extends SuperSmallStateMachineError<State, Output, Input, Action, Process> {}
export class StateReferenceError<
	State extends InitialState = InitialState,
	Output extends unknown = undefined,
	Input extends Array<unknown> = [Partial<InputSystemState<State, Output>>] | [],
	Action extends unknown = ActionType<State, Output>,
	Process extends unknown = ProcessType<State, Output, Action>,
> extends SuperSmallStateMachineReferenceError<State, Output, Input, Action, Process> {}
export class StateTypeError<
	State extends InitialState = InitialState,
	Output extends unknown = undefined,
	Input extends Array<unknown> = [Partial<InputSystemState<State, Output>>] | [],
	Action extends unknown = ActionType<State, Output>,
	Process extends unknown = ProcessType<State, Output, Action>,
> extends SuperSmallStateMachineTypeError<State, Output, Input, Action, Process> {}
export class NodeTypeError<
	State extends InitialState = InitialState,
	Output extends unknown = undefined,
	Input extends Array<unknown> = [Partial<InputSystemState<State, Output>>] | [],
	Action extends unknown = ActionType<State, Output>,
	Process extends unknown = ProcessType<State, Output, Action>,
> extends SuperSmallStateMachineTypeError<State, Output, Input, Action, Process> {}
export class NodeReferenceError<
	State extends InitialState = InitialState,
	Output extends unknown = undefined,
	Input extends Array<unknown> = [Partial<InputSystemState<State, Output>>] | [],
	Action extends unknown = ActionType<State, Output>,
	Process extends unknown = ProcessType<State, Output, Action>,
> extends SuperSmallStateMachineReferenceError<State, Output, Input, Action, Process> {}
export class MaxIterationsError<
	State extends InitialState = InitialState,
	Output extends unknown = undefined,
	Input extends Array<unknown> = [Partial<InputSystemState<State, Output>>] | [],
	Action extends unknown = ActionType<State, Output>,
	Process extends unknown = ProcessType<State, Output, Action>,
> extends SuperSmallStateMachineError<State, Output, Input, Action, Process> {}
export class PathReferenceError<
	State extends InitialState = InitialState,
	Output extends unknown = undefined,
	Input extends Array<unknown> = [Partial<InputSystemState<State, Output>>] | [],
	Action extends unknown = ActionType<State, Output>,
	Process extends unknown = ProcessType<State, Output, Action>,
> extends SuperSmallStateMachineReferenceError<State, Output, Input, Action, Process> {}
export enum NodeTypes {
	CD = 'condition', SW = 'switch', WH = 'while',
	MC = 'machine', SQ = 'sequence', FN = 'function',
	CH = 'changes', UN = 'undefined', EM = 'empty',
	DR = 'directive', RT = 'return', ID = 'interrupt-directive', AD = 'absolute-directive', MD = 'machine-directive', SD = 'sequence-directive',
}
export enum KeyWords {
	IT = 'initial',
	IF = 'if', TN = 'then', EL = 'else',
	SW = 'switch', CS = 'case', DF = 'default',
	WH = 'while', DO = 'do',
}
export class NS<
	State extends InitialState = InitialState,
	Output extends unknown = undefined,
	Input extends Array<unknown> = [Partial<InputSystemState<State, Output>>] | [],
	Action extends unknown = ActionType<State, Output>,
	Process extends unknown = ProcessType<State, Output, Action>,
> extends Map<string | symbol, typeof N> {
	constructor(...nodes: Array<typeof N>) { super(nodes.flat(Infinity).map(node => [node.type,node])) }
	typeof(object: unknown, objectType: (typeof object) = typeof object, isAction: boolean = false): false | string | symbol {
		const foundType = [...this.values()].reverse().find(current => current.typeof(object, objectType, isAction))
		return foundType ? foundType.type : false
	}
}
export class N {
	static type: string | symbol = Symbol('Unnamed node')
	static typeof<SelfType extends unknown = never>(object: unknown, objectType: typeof object, isAction: boolean): object is SelfType { return false };
	static execute<
	State extends InitialState = InitialState,
	Output extends unknown = undefined,
	Input extends Array<unknown> = [Partial<InputSystemState<State, Output>>] | [],
	Action extends unknown = ActionType<State, Output>,
	Process extends unknown = ProcessType<State, Output, Action>,
SelfType extends unknown = never,>(this: Instance<State, Output, Input, Action, Process>, node: SelfType, state: SystemState<State, Output>): Action | Promise<Action> { return node as unknown as Action }
	static proceed<
	State extends InitialState = InitialState,
	Output extends unknown = undefined,
	Input extends Array<unknown> = [Partial<InputSystemState<State, Output>>] | [],
	Action extends unknown = ActionType<State, Output>,
	Process extends unknown = ProcessType<State, Output, Action>,
SelfType extends unknown = never,>(this: Instance<State, Output, Input, Action, Process>, action: SelfType, state: SystemState<State, Output>, isAction: boolean, nodeIndex: PathUnit): SystemState<State, Output> | Promise<SystemState<State, Output>> {
		const stack = state[S.Stack] || [[]]
		if (stack[0].length === 0) {
			if (stack.length === 1) return { ...state, [S.Return]: state[S.Return] }
			const { [S.Return]: interceptReturn, ...otherState } = state
			return { ...otherState, [S.Stack]: stack.slice(1) } as SystemState<State, Output>
		}
		const parPath = stack[0].slice(0,-1)
		return S._proceed(this, { ...state, [S.Stack]: [parPath, ...stack.slice(1)] }, get_path_object(this.process, parPath), false, stack[0][parPath.length])
	};
	static perform<
	State extends InitialState = InitialState,
	Output extends unknown = undefined,
	Input extends Array<unknown> = [Partial<InputSystemState<State, Output>>] | [],
	Action extends unknown = ActionType<State, Output>,
	Process extends unknown = ProcessType<State, Output, Action>,
SelfType extends unknown = never,>(this: Instance<State, Output, Input, Action, Process>, action: SelfType, state: SystemState<State, Output>): SystemState<State, Output> | Promise<SystemState<State, Output>> { return state }
	static traverse<
	State extends InitialState = InitialState,
	Output extends unknown = undefined,
	Input extends Array<unknown> = [Partial<InputSystemState<State, Output>>] | [],
	Action extends unknown = ActionType<State, Output>,
	Process extends unknown = ProcessType<State, Output, Action>,
SelfType extends unknown = never,>(this: Instance<State, Output, Input, Action, Process>, node: SelfType, path: Path, iterate: ((path: Path) => SelfType)): SelfType { return node }
}
export interface Instance<
	State extends InitialState = InitialState,
	Output extends unknown = undefined,
	Input extends Array<unknown> = [Partial<InputSystemState<State, Output>>] | [],
	Action extends unknown = ActionType<State, Output>,
	Process extends unknown = ProcessType<State, Output, Action>,
> {
	config: Config<State, Output, Input, Action, Process>,
	process: Process,
}
export interface InitialState {
	[key: string]: unknown,
}
export type SystemState<State extends InitialState = InitialState, Output extends unknown = undefined> = State & {
	[S.Stack]: Stack
	[S.Trace]: Array<Stack>
	[S.Changes]: Partial<State>
	[S.Return]?: Output | undefined
}
export type InputSystemState<State extends InitialState = InitialState, Output extends unknown = undefined> = State & Partial<Pick<SystemState<State, Output>, typeof S.Stack | typeof S.Return | typeof S.Trace>>

export interface Config<
	State extends InitialState = InitialState,
	Output extends unknown = undefined,
	Input extends Array<unknown> = [Partial<InputSystemState<State, Output>>] | [],
	Action extends unknown = ActionType<State, Output>,
	Process extends unknown = ProcessType<State, Output, Action>,
> {
	defaults: State,
	iterations: number,
	until: (this: Instance<State, Output, Input, Action, Process>, state: SystemState<State, Output>, runs: number) => boolean,
	strict: boolean | typeof S.StrictTypes,
	override: null | ((...args: Input) => Output),
	adapt: Array<(process: Process) => Process>,
	before: Array<(state: SystemState<State, Output>) => SystemState<State, Output>>,
	after: Array<(state: SystemState<State, Output>) => SystemState<State, Output>>,
	input: (...input: Input) => Partial<InputSystemState<State, Output>>,
	output: (state: SystemState<State, Output>) => Output,
	nodes: NS<State, Output, Input, Action, Process>,
	trace: boolean,
	deep: boolean,
	async: boolean,
	pause: (this: Instance<State, Output, Input, Action, Process>, state: SystemState<State, Output>, runs: number) => false | Promise<any>
}
	export type ChangesType<State extends InitialState = InitialState> = Partial<State>
	export class Changes extends N {
		static type = NodeTypes.CH
		static typeof<SelfType = ChangesType>(object: unknown, objectType: typeof object, isAction: boolean): object is SelfType { return Boolean(object && objectType === 'object') }
		static perform<
	State extends InitialState = InitialState,
	Output extends unknown = undefined,
	Input extends Array<unknown> = [Partial<InputSystemState<State, Output>>] | [],
	Action extends unknown = ActionType<State, Output>,
	Process extends unknown = ProcessType<State, Output, Action>,
SelfType = ChangesType<State>,>(this: Instance<State, Output, Input, Action, Process>, action: SelfType, state: SystemState<State, Output>): SystemState<State, Output> | Promise< SystemState<State, Output>> { return S._changes(this, state, action as ChangesType<State>) as SystemState<State, Output> }
	}
	export type SequenceType<State extends InitialState = InitialState, Output extends unknown = undefined, Action extends unknown = ActionType<State, Output>> = Array<ProcessType<State, Output, Action>>
	export class Sequence extends N {
		static type = NodeTypes.SQ
		static proceed<
	State extends InitialState = InitialState,
	Output extends unknown = undefined,
	Input extends Array<unknown> = [Partial<InputSystemState<State, Output>>] | [],
	Action extends unknown = ActionType<State, Output>,
	Process extends unknown = ProcessType<State, Output, Action>,
SelfType = SequenceType<State, Output, Action>,>(this: Instance<State, Output, Input, Action, Process>, action: SelfType, state: SystemState<State, Output>, isAction: boolean, childItem: number): SystemState<State, Output> | Promise<SystemState<State, Output>> {
			if (action && childItem+1 < (action as SequenceType<State, Output, Action>).length) return { ...state, [S.Stack]: [[...state[S.Stack][0], childItem+1], ...state[S.Stack].slice(1)] }
			return N.proceed.call(this, action, state)
		}
		static typeof<SelfType = SequenceType>(object: unknown, objectType: typeof object, isAction: boolean): object is SelfType { return ((!isAction) && objectType === 'object' && Array.isArray(object)) }
		static execute<
	State extends InitialState = InitialState,
	Output extends unknown = undefined,
	Input extends Array<unknown> = [Partial<InputSystemState<State, Output>>] | [],
	Action extends unknown = ActionType<State, Output>,
	Process extends unknown = ProcessType<State, Output, Action>,
SelfType = SequenceType<State, Output, Action>,>(this: Instance<State, Output, Input, Action, Process>, node: SelfType, state: SystemState<State, Output>): Action | Promise<Action> { return ((node as SequenceType<State, Output, Action>).length ? [ ...state[S.Stack], 0 ] : null) as Action }
		static traverse<
	State extends InitialState = InitialState,
	Output extends unknown = undefined,
	Input extends Array<unknown> = [Partial<InputSystemState<State, Output>>] | [],
	Action extends unknown = ActionType<State, Output>,
	Process extends unknown = ProcessType<State, Output, Action>,
SelfType = SequenceType<State, Output, Action>,>(this: Instance<State, Output, Input, Action, Process>, node: SelfType, path: Path, iterate: ((path: Path) => SelfType)): SelfType { return (node as SequenceType<State, Output, Action>).map((_,i) => iterate([...path,i])) as SelfType }
	}
	export type FunctionType<State extends InitialState = InitialState, Output extends unknown = undefined, Action extends unknown = ActionType<State, Output>> = (state: SystemState<State, Output>) => Action | Promise<Action>
	export class FunctionN extends N {
		static type = NodeTypes.FN
		static typeof<SelfType = FunctionType>(object: unknown, objectType: typeof object, isAction: boolean): object is SelfType { return (!isAction) && objectType === 'function' }
		static execute<
	State extends InitialState = InitialState,
	Output extends unknown = undefined,
	Input extends Array<unknown> = [Partial<InputSystemState<State, Output>>] | [],
	Action extends unknown = ActionType<State, Output>,
	Process extends unknown = ProcessType<State, Output, Action>,
SelfType = FunctionType<State, Output, Action>,>(this: Instance<State, Output, Input, Action, Process>, node: SelfType, state: SystemState<State, Output>): Action | Promise<Action> { return (node as FunctionType<State, Output, Action>)(state) }
	}
	export class Undefined extends N {
		static type = NodeTypes.UN
		static typeof<SelfType = undefined>(object: unknown, objectType: typeof object, isAction: boolean): object is SelfType { return objectType === 'undefined' }
		static execute<
	State extends InitialState = InitialState,
	Output extends unknown = undefined,
	Input extends Array<unknown> = [Partial<InputSystemState<State, Output>>] | [],
	Action extends unknown = ActionType<State, Output>,
	Process extends unknown = ProcessType<State, Output, Action>,
SelfType = undefined>(this: Instance<State, Output, Input, Action, Process>, node: SelfType, state: SystemState<State, Output>): Action | Promise<Action> { throw new NodeReferenceError(`There is nothing to execute at path [ ${state[S.Stack][0].map(key => key.toString()).join(', ')} ]`, { instance: this, state, data: { node } }) }
	}
	export class Empty extends N {
		static type = NodeTypes.EM
		static typeof<SelfType = null>(object: unknown, objectType: typeof object, isAction: boolean): object is SelfType { return object === null }
	}
	export interface ConditionType<
			State extends InitialState = InitialState,
			Output extends unknown = undefined,
			Action extends unknown = ActionType<State, Output>,
		> {
			[KeyWords.IF]: (state: SystemState<State, Output>) => boolean,
			[KeyWords.TN]?: ProcessType<State, Output, Action>
			[KeyWords.EL]?: ProcessType<State, Output, Action>
		}
	export class Condition extends N {
		static type = NodeTypes.CD
		static typeof<SelfType = ConditionType>(object: unknown, objectType: typeof object, isAction: boolean): object is SelfType { return Boolean((!isAction) && object && objectType === 'object' && (KeyWords.IF in (object as object))) }
		static execute<
	State extends InitialState = InitialState,
	Output extends unknown = undefined,
	Input extends Array<unknown> = [Partial<InputSystemState<State, Output>>] | [],
	Action extends unknown = ActionType<State, Output>,
	Process extends unknown = ProcessType<State, Output, Action>,
SelfType = ConditionType<State, Output, Action>,>(this: Instance<State, Output, Input, Action, Process>, node: SelfType, state: SystemState<State, Output>): Action | Promise<Action> {
			if (normalise_function((node as ConditionType<State, Output, Action>)[KeyWords.IF])(state))
			return (KeyWords.TN in (node as ConditionType<State, Output, Action>) ? [ ...state[S.Stack][0], KeyWords.TN ] : null) as Action
			return (KeyWords.EL in (node as ConditionType<State, Output, Action>) ? [ ...state[S.Stack][0], KeyWords.EL ] : null) as Action
		}
		static traverse<
	State extends InitialState = InitialState,
	Output extends unknown = undefined,
	Input extends Array<unknown> = [Partial<InputSystemState<State, Output>>] | [],
	Action extends unknown = ActionType<State, Output>,
	Process extends unknown = ProcessType<State, Output, Action>,
SelfType = ConditionType<State, Output, Action>,>(this: Instance<State, Output, Input, Action, Process>, node: SelfType, path: Path, iterate: ((path: Path) => SelfType)): SelfType { return {
			...node,
			...(KeyWords.TN in (node as ConditionType<State, Output, Action>) ? { [KeyWords.TN]: iterate([...path,KeyWords.TN]) } : {}),
			...(KeyWords.EL in (node as ConditionType<State, Output, Action>) ? { [KeyWords.EL]: iterate([...path,KeyWords.EL]) } : {})
		} }
	}
	export interface SwitchType<
			State extends InitialState = InitialState,
			Output extends unknown = undefined,
			Action extends unknown = ActionType<State, Output>,
		> {
			[KeyWords.SW]: (state: SystemState<State, Output>) => string | number,
			[KeyWords.CS]: Record<string | number, ProcessType<State, Output, Action>>
		}
	export class Switch extends N {
		static type = NodeTypes.SW
		static typeof<SelfType = SwitchType>(object: unknown, objectType: typeof object, isAction: boolean): object is SelfType { return Boolean((!isAction) && object && objectType === 'object' && (KeyWords.SW in (object as object))) }
		static execute<
	State extends InitialState = InitialState,
	Output extends unknown = undefined,
	Input extends Array<unknown> = [Partial<InputSystemState<State, Output>>] | [],
	Action extends unknown = ActionType<State, Output>,
	Process extends unknown = ProcessType<State, Output, Action>,
SelfType = SwitchType<State, Output, Action>,>(this: Instance<State, Output, Input, Action, Process>, node: SelfType, state: SystemState<State, Output>): Action | Promise<Action> {
			const key = normalise_function((node as SwitchType<State, Output, Action>)[KeyWords.SW])(state)
			const fallbackKey = (key in (node as SwitchType<State, Output, Action>)[KeyWords.CS]) ? key : KeyWords.DF
			return ((fallbackKey in (node as SwitchType<State, Output, Action>)[KeyWords.CS]) ? [ ...state[S.Stack][0], KeyWords.CS, fallbackKey ] : null) as Action
		}
		static traverse<
	State extends InitialState = InitialState,
	Output extends unknown = undefined,
	Input extends Array<unknown> = [Partial<InputSystemState<State, Output>>] | [],
	Action extends unknown = ActionType<State, Output>,
	Process extends unknown = ProcessType<State, Output, Action>,
SelfType = SwitchType<State, Output, Action>,>(this: Instance<State, Output, Input, Action, Process>, node: SelfType, path: Path, iterate: ((path: Path) => SelfType)): SelfType { return { ...node, [KeyWords.CS]: Object.fromEntries(Object.keys((node as SwitchType<State, Output, Action>)[KeyWords.CS]).map(key => [ key, iterate([...path,KeyWords.CS,key]) ])), } }
	}
	export interface WhileType<
			State extends InitialState = InitialState,
			Output extends unknown = undefined,
			Action extends unknown = ActionType<State, Output>,
		> {
			[KeyWords.WH]: (state: SystemState<State, Output>) => boolean,
			[KeyWords.DO]: ProcessType<State, Output, Action>
		}
	export class While extends N {
		static type = NodeTypes.WH
		static typeof<SelfType = WhileType>(object: unknown, objectType: typeof object, isAction: boolean): object is SelfType { return Boolean((!isAction) && object && objectType === 'object' && (KeyWords.WH in (object as object))) }
		static execute<
	State extends InitialState = InitialState,
	Output extends unknown = undefined,
	Input extends Array<unknown> = [Partial<InputSystemState<State, Output>>] | [],
	Action extends unknown = ActionType<State, Output>,
	Process extends unknown = ProcessType<State, Output, Action>,
SelfType = WhileType<State, Output, Action>,>(this: Instance<State, Output, Input, Action, Process>, node: SelfType, state: SystemState<State, Output>): Action | Promise<Action> {
			if (!((KeyWords.DO in (node as WhileType<State, Output, Action>)) && normalise_function((node as WhileType<State, Output, Action>)[KeyWords.WH])(state))) return null as Action
			return [ ...state[S.Stack][0], KeyWords.DO ] as Action
		}
		static proceed<
	State extends InitialState = InitialState,
	Output extends unknown = undefined,
	Input extends Array<unknown> = [Partial<InputSystemState<State, Output>>] | [],
	Action extends unknown = ActionType<State, Output>,
	Process extends unknown = ProcessType<State, Output, Action>,
SelfType = WhileType<State, Output, Action>,>(this: Instance<State, Output, Input, Action, Process>, action: SelfType, state: SystemState<State, Output>): SystemState<State, Output> | Promise<SystemState<State, Output>> { return state }
		static traverse<
	State extends InitialState = InitialState,
	Output extends unknown = undefined,
	Input extends Array<unknown> = [Partial<InputSystemState<State, Output>>] | [],
	Action extends unknown = ActionType<State, Output>,
	Process extends unknown = ProcessType<State, Output, Action>,
SelfType = WhileType<State, Output, Action>,>(this: Instance<State, Output, Input, Action, Process>, node: SelfType, path: Path, iterate: ((path: Path) => SelfType)): SelfType { return { ...node, ...(KeyWords.DO in (node as object) ? { [KeyWords.DO]: iterate([...path,KeyWords.DO]) } : {}), } }
	}
	export interface MachineType<
			State extends InitialState = InitialState,
			Output extends unknown = undefined,
			Action extends unknown = ActionType<State, Output>,
		> {
			[KeyWords.IT]: ProcessType<State, Output, Action>
			[key: string | number | symbol]: ProcessType<State, Output, Action>
		}
	export class Machine extends N {
		static type = NodeTypes.MC
		static typeof<SelfType = MachineType>(object: unknown, objectType: typeof object, isAction: boolean): object is SelfType { return Boolean((!isAction) && object && objectType === 'object' && (KeyWords.IT in (object as object))) }
		static execute<
	State extends InitialState = InitialState,
	Output extends unknown = undefined,
	Input extends Array<unknown> = [Partial<InputSystemState<State, Output>>] | [],
	Action extends unknown = ActionType<State, Output>,
	Process extends unknown = ProcessType<State, Output, Action>,
SelfType = MachineType<State, Output, Action>,>(this: Instance<State, Output, Input, Action, Process>, node: SelfType, state: SystemState<State, Output>): Action | Promise<Action> { return [ ...state[S.Stack][0], KeyWords.IT ] as Action }
		static traverse<
	State extends InitialState = InitialState,
	Output extends unknown = undefined,
	Input extends Array<unknown> = [Partial<InputSystemState<State, Output>>] | [],
	Action extends unknown = ActionType<State, Output>,
	Process extends unknown = ProcessType<State, Output, Action>,
SelfType = MachineType<State, Output, Action>,>(this: Instance<State, Output, Input, Action, Process>, node: SelfType, path: Path, iterate: ((path: Path) => SelfType)): SelfType { return { ...node, ...Object.fromEntries(Object.keys(node as object).map(key => [ key, iterate([...path,key]) ])) } }
	}
	export type DirectiveType = { [S.Goto]: AbsoluteDirectiveType | SequenceDirectiveType | MachineDirectiveType }
	export class Directive extends N {
		static type = NodeTypes.DR
		static typeof<SelfType = DirectiveType>(object: unknown, objectType: typeof object, isAction: boolean): object is SelfType  { return Boolean(object && objectType === 'object' && (S.Stack in (object as object))) }
		static perform<
	State extends InitialState = InitialState,
	Output extends unknown = undefined,
	Input extends Array<unknown> = [Partial<InputSystemState<State, Output>>] | [],
	Action extends unknown = ActionType<State, Output>,
	Process extends unknown = ProcessType<State, Output, Action>,
SelfType = DirectiveType,>(this: Instance<State, Output, Input, Action, Process>, action: SelfType, state: SystemState<State, Output>): SystemState<State, Output> | Promise< SystemState<State, Output>> { return S._perform(this, state, (action as DirectiveType)[S.Stack] as Action) }
		static proceed(action, state) { return state }
	}
	export type SequenceDirectiveType = number
	export class SequenceDirective extends Directive {
		static type = NodeTypes.SD
		static typeof<SelfType = SequenceDirectiveType>(object: unknown, objectType: typeof object, isAction: boolean): object is SelfType { return objectType === 'number' }
		static perform<
	State extends InitialState = InitialState,
	Output extends unknown = undefined,
	Input extends Array<unknown> = [Partial<InputSystemState<State, Output>>] | [],
	Action extends unknown = ActionType<State, Output>,
	Process extends unknown = ProcessType<State, Output, Action>,
SelfType = SequenceDirectiveType,>(this: Instance<State, Output, Input, Action, Process>, action: SelfType, state: SystemState<State, Output>): SystemState<State, Output> | Promise< SystemState<State, Output>> {
			const lastOf = S._closest(this, state[S.Stack][0].slice(0,-1), NodeTypes.SQ)
			if (!lastOf) throw new PathReferenceError(`A relative directive has been provided as a number (${String(action)}), but no sequence exists that this number could be an index of from path [ ${state[S.Stack][0].map(key => key.toString()).join(', ')} ].`, { instance: this, state, data: { action } })
			return { ...state, [S.Stack]: [ [...lastOf, action as SequenceDirectiveType], ...state[S.Stack].slice(1) ] }
		}
	}
	export type MachineDirectiveType = string
	export class MachineDirective extends Directive {
		static type = NodeTypes.MD
		static typeof<SelfType = MachineDirectiveType>(object: unknown, objectType: typeof object, isAction: boolean): object is SelfType { return objectType === 'string' }
		static perform<
	State extends InitialState = InitialState,
	Output extends unknown = undefined,
	Input extends Array<unknown> = [Partial<InputSystemState<State, Output>>] | [],
	Action extends unknown = ActionType<State, Output>,
	Process extends unknown = ProcessType<State, Output, Action>,
SelfType = MachineDirectiveType,>(this: Instance<State, Output, Input, Action, Process>, action: SelfType, state: SystemState<State, Output>): SystemState<State, Output> | Promise< SystemState<State, Output>> {
			const lastOf = S._closest(this, state[S.Stack][0].slice(0,-1), NodeTypes.MC)
			if (!lastOf) throw new PathReferenceError(`A relative directive has been provided as a string (${String(action)}), but no state machine exists that this string could be a state of. From path [ ${state[S.Stack][0].map(key => key.toString()).join(', ')} ].`, { instance: this, state, data: { action } })
			return { ...state, [S.Stack]: [ [...lastOf, action as MachineDirectiveType], ...state[S.Stack].slice(1) ] }
		}
	}
	export type InterruptDirectiveType = symbol
	export class InterruptDirective extends Directive {
		static type = NodeTypes.ID
		static typeof<SelfType = InterruptDirectiveType>(object: unknown, objectType: typeof object, isAction: boolean): object is SelfType { return objectType === 'symbol' }
		static perform<
	State extends InitialState = InitialState,
	Output extends unknown = undefined,
	Input extends Array<unknown> = [Partial<InputSystemState<State, Output>>] | [],
	Action extends unknown = ActionType<State, Output>,
	Process extends unknown = ProcessType<State, Output, Action>,
SelfType = InterruptDirectiveType,>(this: Instance<State, Output, Input, Action, Process>, action: SelfType, state: SystemState<State, Output>): SystemState<State, Output> | Promise< SystemState<State, Output>> {
			const lastOf = get_closest_path(this.process, state[S.Stack][0].slice(0,-1), i => this.config.nodes.typeof(i) === NodeTypes.MC && ((action as InterruptDirectiveType) in (i as object)))
			if (!lastOf) return { ...state, [S.Return]: action } as SystemState<State, Output>
			return { ...state, [S.Stack]: [ [...lastOf, action as InterruptDirectiveType], ...state[S.Stack] ] }
		}
		static proceed<
	State extends InitialState = InitialState,
	Output extends unknown = undefined,
	Input extends Array<unknown> = [Partial<InputSystemState<State, Output>>] | [],
	Action extends unknown = ActionType<State, Output>,
	Process extends unknown = ProcessType<State, Output, Action>,
SelfType = InterruptDirectiveType,>(this: Instance<State, Output, Input, Action, Process>, action: SelfType, state: SystemState<State, Output>): SystemState<State, Output> | Promise< SystemState<State, Output>> {
			const { [S.Stack]: stack, [S.Return]: interceptReturn, ...proceedPrevious } = S._proceed(this, { ...state, [S.Stack]: state[S.Stack].slice(1) }, undefined, true)
			return { ...proceedPrevious, [S.Stack]: [ state[S.Stack][0], ...stack ] } as SystemState<State, Output>
		}
	}
	export type AbsoluteDirectiveType = Path
	export class AbsoluteDirective extends Directive {
		static type = NodeTypes.AD
		static typeof<SelfType = AbsoluteDirectiveType>(object: unknown, objectType: typeof object, isAction: boolean): object is SelfType  { return isAction && Array.isArray(object) }
		static perform<
	State extends InitialState = InitialState,
	Output extends unknown = undefined,
	Input extends Array<unknown> = [Partial<InputSystemState<State, Output>>] | [],
	Action extends unknown = ActionType<State, Output>,
	Process extends unknown = ProcessType<State, Output, Action>,
SelfType = AbsoluteDirectiveType,>(this: Instance<State, Output, Input, Action, Process>, action: SelfType, state: SystemState<State, Output>): SystemState<State, Output> | Promise< SystemState<State, Output>> { return { ...state, [S.Stack]: [ action as AbsoluteDirectiveType, ...state[S.Stack].slice(1) ] } }
	}
	export type ReturnObjectType<Output extends unknown = unknown> = { [S.Return]: Output }
	export type ReturnType<Output extends unknown = unknown> = ReturnObjectType<Output> | typeof S.Return
	export class Return extends Directive {
		static type = NodeTypes.RT
		static typeof<SelfType = ReturnType>(object: unknown, objectType: typeof object, isAction: boolean): object is SelfType  { return object === S.Return || Boolean(object && objectType === 'object' && (S.Return in (object as object))) }
		static perform<
	State extends InitialState = InitialState,
	Output extends unknown = undefined,
	Input extends Array<unknown> = [Partial<InputSystemState<State, Output>>] | [],
	Action extends unknown = ActionType<State, Output>,
	Process extends unknown = ProcessType<State, Output, Action>,
SelfType = ReturnType<Output>,>(this: Instance<State, Output, Input, Action, Process>, action: SelfType, state: SystemState<State, Output>): SystemState<State, Output> | Promise< SystemState<State, Output>> { return { ...state, [S.Return]: !action || action === S.Return ? undefined : (action as unknown as ReturnObjectType<Output>)[S.Return] as Output, } }
	}
export type PathUnit = SequenceDirectiveType | MachineDirectiveType | InterruptDirectiveType
export type Path = Array<PathUnit>
export type Stack = Array<Path>

export type ProcessType<
	State extends InitialState = InitialState,
	Output extends unknown = undefined,
	Action extends unknown = ActionType<State, Output>,
> =
| SequenceType<State, Output, Action>
| MachineType<State, Output, Action>
| ConditionType<State, Output, Action>
| SwitchType<State, Output, Action>
| WhileType<State, Output, Action>
| FunctionType<State, Output, Action>
| DirectiveType | SequenceDirectiveType | MachineDirectiveType
| ReturnType<Output>
| ChangesType<State>
| null

export type ActionType<
	State extends InitialState = InitialState,
	Output extends unknown = undefined,
> = DirectiveType | AbsoluteDirectiveType | SequenceDirectiveType | MachineDirectiveType | ReturnType<Output>| ChangesType<State> | null | undefined | void

export class Interruptable<Result, Interrupt> extends Promise<Result> {
	private interruptor: (...interruptions: Array<Interrupt>) => void = () => {}
	private settled: boolean = false
	constructor(executorOrPromise: Promise<Result> | ((resolve: ((arg: Result) => void), reject: ((arg: Error) => void)) => void), interruptor: (...interruptions: Array<Interrupt>) => void) {
		const settle = <A extends Array<unknown> = Array<unknown>>(f: ((...args: A) => void)) => (...args: A): void => {
			this.settled = true
			f(...args)
		}
		if (typeof executorOrPromise === 'function') super((resolve, reject) => executorOrPromise(settle(resolve), settle(reject)))
		else super((resolve, reject) => { Promise.resolve(executorOrPromise).then(settle(resolve)).catch(settle(reject)) })
		this.interruptor = interruptor
	}
	interrupt(...interruptions: Array<Interrupt>): void {
		if (this.settled) throw new Error('A settled Interruptable cannot be interrupted.')
		return this.interruptor(...interruptions)
	}
}
export class ExtensibleFunction extends Function {
	constructor(f: Function) { super(); return Object.setPrototypeOf(f, new.target.prototype); };
}
export interface SuperSmallStateMachineCore<
	State extends InitialState = InitialState,
	Output extends unknown = undefined,
	Input extends Array<unknown> = [Partial<InputSystemState<State, Output>>] | [],
	Action extends unknown = ActionType<State, Output>,
	Process extends unknown = ProcessType<State, Output, Action>,
> { process: Process; (...args: Input): Output; }
export abstract class SuperSmallStateMachineCore<
	State extends InitialState = InitialState,
	Output extends unknown = undefined,
	Input extends Array<unknown> = [Partial<InputSystemState<State, Output>>] | [],
	Action extends unknown = ActionType<State, Output>,
	Process extends unknown = ProcessType<State, Output, Action>,
> extends ExtensibleFunction {
		public static readonly Return = Symbol('Super Small State Machine Return')
		public static readonly Changes = Symbol('Super Small State Machine Changes')
		public static readonly Goto = Symbol('Super Small State Machine Goto')
		public static readonly Stack = Symbol('Super Small State Machine Stack')
		public static readonly Trace = Symbol('Super Small State Machine Trace')
		public static readonly StrictTypes = Symbol('Super Small State Machine Strict Types')
	public static readonly keyWords: typeof KeyWords = KeyWords
	public static readonly kw:       typeof KeyWords = KeyWords
	public static readonly nodeTypes:typeof NodeTypes = NodeTypes
	public static readonly types:    typeof NodeTypes = NodeTypes
	static nodes = [ Changes, Sequence, FunctionN, Undefined, Empty, Condition, Switch, While, Machine, Directive, InterruptDirective, AbsoluteDirective, MachineDirective, SequenceDirective, Return, ]
	public static readonly config: Config = {
		defaults: {},
		input: (state = {}) => state,
		output:  state => state[S.Return],
		strict: false,
		iterations: 10000,
		until: state => S.Return in state,
		pause: () => false,
		async: false,
		trace: false,
		deep: false,
		override: null,
		nodes: new NS(...SuperSmallStateMachineCore.nodes as unknown as []),
		adapt: [],
		before: [],
		after: [],
	}
	public static _closest<
	State extends InitialState = InitialState,
	Output extends unknown = undefined,
	Input extends Array<unknown> = [Partial<InputSystemState<State, Output>>] | [],
	Action extends unknown = ActionType<State, Output>,
	Process extends unknown = ProcessType<State, Output, Action>,
>(instance: Instance<State, Output, Input, Action, Process>, path: Path, ...nodeTypes: Array<string | symbol | Array<string | symbol>>): Path | null {
		const flatTypes = nodeTypes.flat(Infinity)
		return get_closest_path(instance.process, path, i => {
			const nodeType = instance.config.nodes.typeof(i)
			return Boolean(nodeType && flatTypes.includes(nodeType))
		})
	}
	public static _changes<
	State extends InitialState = InitialState,
	Output extends unknown = undefined,
	Input extends Array<unknown> = [Partial<InputSystemState<State, Output>>] | [],
	Action extends unknown = ActionType<State, Output>,
	Process extends unknown = ProcessType<State, Output, Action>,
>(instance: Instance<State, Output, Input, Action, Process>, state: SystemState<State, Output>, changes: Partial<State>): SystemState<State, Output> {
		if (instance.config.strict && Object.entries(changes).some(([property]) => !(property in state)))
			throw new StateReferenceError(`Only properties that exist on the initial context may be updated.\nYou changed [ ${Object.keys(changes).filter(property => !(property in state)).map(key => key.toString()).join(', ')} ], which ${Object.keys(changes).filter(property => !(property in state)).length === 1 ? 'is' : 'are'} not in: [ ${Object.keys(state).map(key => key.toString()).join(', ')} ].\nPath: [ ${state[S.Stack][0].map(key => key.toString()).join(' / ')} ]`, { instance, state, data: { changes } })
		if (instance.config.strict === this.StrictTypes && Object.entries(changes).some(([property,value]) => typeof value !== typeof state[property]))
			throw new StateTypeError(`Properties must have the same type as their initial value. ${Object.entries(changes).filter(([property,value]) => typeof value !== typeof state[property]).map(([property,value]) => `${typeof value} given for '${property}', should be ${typeof state[property]}`).join('. ')}.`, { instance, state, data: { changes } })
		const merge = instance.config.deep ? deep_merge_object : shallow_merge_object
		const allChanges = merge(state[S.Changes] || {}, changes)
		return {
			...state,
			...merge(state, allChanges),
			[S.Stack]: state[S.Stack],
			[S.Changes]: allChanges
		}
	}
	public static _proceed<
	State extends InitialState = InitialState,
	Output extends unknown = undefined,
	Input extends Array<unknown> = [Partial<InputSystemState<State, Output>>] | [],
	Action extends unknown = ActionType<State, Output>,
	Process extends unknown = ProcessType<State, Output, Action>,
>(instance: Instance<State, Output, Input, Action, Process>, state: SystemState<State, Output>, node: Process | Action = undefined as Process, isAction: boolean = false, nodeIndex?: PathUnit): SystemState<State, Output> {
		const nodeType = instance.config.nodes.typeof(node, typeof node, isAction)
		if (!nodeType) throw new NodeTypeError(`Unknown action type: ${typeof node}${nodeType ? `, nodeType: ${String(nodeType)}` : ''}`, { instance, state, data: { action: node } })
		return instance.config.nodes.get(nodeType)!.proceed.call(instance, node, state, isAction, nodeIndex)
	}
	public static _perform<
	State extends InitialState = InitialState,
	Output extends unknown = undefined,
	Input extends Array<unknown> = [Partial<InputSystemState<State, Output>>] | [],
	Action extends unknown = ActionType<State, Output>,
	Process extends unknown = ProcessType<State, Output, Action>,
>(instance: Instance<State, Output, Input, Action, Process>, state: SystemState<State, Output>, action: Action = null as Action): SystemState<State, Output> {
		const nodeType = instance.config.nodes.typeof(action, typeof action, true)
		if (!nodeType) throw new NodeTypeError(`Unknown action type: ${typeof action}${nodeType ? `, nodeType: ${String(nodeType)}` : ''}.`, { instance, state, data: { action } })
		return instance.config.nodes.get(nodeType)!.perform.call(instance as any, action, state) as SystemState<State, Output>
	}
	public static _execute<
	State extends InitialState = InitialState,
	Output extends unknown = undefined,
	Input extends Array<unknown> = [Partial<InputSystemState<State, Output>>] | [],
	Action extends unknown = ActionType<State, Output>,
	Process extends unknown = ProcessType<State, Output, Action>,
>(instance: Instance<State, Output, Input, Action, Process>, state: SystemState<State, Output>, node: Process = get_path_object(instance.process, state[S.Stack][0]) as Process): Action {
		const nodeType = instance.config.nodes.typeof(node)
		if (!nodeType) throw new NodeTypeError(`Unknown node type: ${typeof node}${nodeType ? `, nodeType: ${String(nodeType)}` : ''}.`, { instance, state, data: { node } })
		return instance.config.nodes.get(nodeType)!.execute.call(instance as any, node, state) as Action
	}
	public static _traverse<
	State extends InitialState = InitialState,
	Output extends unknown = undefined,
	Input extends Array<unknown> = [Partial<InputSystemState<State, Output>>] | [],
	Action extends unknown = ActionType<State, Output>,
	Process extends unknown = ProcessType<State, Output, Action>,
> (instance: Instance<State, Output, Input, Action, Process>, iterator: ((node: Process, path: Path, process: Process, nodeType: string | symbol) => Process) = ident): Process {
		const iterate = (path: Path = []): Process => {
			const node = get_path_object<Process>(instance.process, path)!
			const nodeType = instance.config.nodes.typeof(node)
			if (!nodeType) throw new NodeTypeError(`Unknown node type: ${typeof node}${nodeType ? `, nodeType: ${String(nodeType)}` : ''} at [ ${path.map(key => key.toString()).join(', ')} ]`, { instance, data: { node } })
			return iterator.call(instance, instance.config.nodes.get(nodeType)!.traverse.call(instance as any, node, path, iterate) as Process, path, instance.process, nodeType)
		}
		return iterate()
	}
	public static _run<
	State extends InitialState = InitialState,
	Output extends unknown = undefined,
	Input extends Array<unknown> = [Partial<InputSystemState<State, Output>>] | [],
	Action extends unknown = ActionType<State, Output>,
	Process extends unknown = ProcessType<State, Output, Action>,
>(instance: Instance<State, Output, Input, Action, Process>, ...input: Input): Output {
		if (instance.config.async) return this._runAsync(instance, ...input) as Output
		return this._runSync(instance, ...input)
	}
	public static _runSync<
	State extends InitialState = InitialState,
	Output extends unknown = undefined,
	Input extends Array<unknown> = [Partial<InputSystemState<State, Output>>] | [],
	Action extends unknown = ActionType<State, Output>,
	Process extends unknown = ProcessType<State, Output, Action>,
>(instance: Instance<State, Output, Input, Action, Process>, ...input: Input): Output {
		const { until, iterations, input: adaptInput, output: adaptOutput, before, after, defaults, trace } = { ...this.config, ...instance.config }
		const modifiedInput = adaptInput.apply(instance, input) || {}
		let r = 0, currentState = { ...before.reduce((prev, modifier) => modifier.call(instance, prev), this._changes(instance, {
			[S.Changes]: {},
			...defaults,
			[S.Stack]: modifiedInput[S.Stack] || [[]], [S.Trace]: modifiedInput[S.Trace] || [],
			...(S.Return in modifiedInput ? {[S.Return]: modifiedInput[S.Return]} : {})
		} as SystemState<State, Output>, modifiedInput)), [S.Changes]: {} }
		while (r < iterations) {
			if (until.call(instance, currentState, r)) break;
			if (++r >= iterations) throw new MaxIterationsError(`Maximum iterations of ${iterations} reached at path [ ${currentState[S.Stack][0].map(key => key.toString()).join(', ')} ]`, { instance, state: currentState, data: { iterations } })
			if (trace) currentState = { ...currentState, [S.Trace]: [ ...currentState[S.Trace], currentState[S.Stack] ] }
			const action = this._execute(instance, currentState)
			currentState = this._perform(instance, currentState, action)
			currentState = this._proceed(instance, currentState, action, true)
		}
		return adaptOutput.call(instance, after.reduce((prev, modifier) => modifier.call(instance, prev), currentState))
	}
	public static _runAsync<
	State extends InitialState = InitialState,
	Output extends unknown = undefined,
	Input extends Array<unknown> = [Partial<InputSystemState<State, Output>>] | [],
	Action extends unknown = ActionType<State, Output>,
	Process extends unknown = ProcessType<State, Output, Action>,
>(instance: Instance<State, Output, Input, Action, Process>, ...input: Input): Promise<Output> {
	let interruptionStack: Array<Symbol> = []
	return new Interruptable<Output, Symbol>((async () => {
		const { pause, until, iterations, input: adaptInput, output: adaptOutput, before, after, defaults, trace } = { ...this.config, ...instance.config }
		const modifiedInput = (await adaptInput.apply(instance, input)) || {}
		let r = 0, currentState = { ...before.reduce((prev, modifier) => modifier.call(instance, prev), this._changes(instance, {
			[S.Changes]: {},
			...defaults,
			[S.Stack]: modifiedInput[S.Stack] || [[]], [S.Trace]: modifiedInput[S.Trace] || [],
			...(S.Return in modifiedInput ? {[S.Return]: modifiedInput[S.Return]} : {})
		} as SystemState<State, Output>, modifiedInput)), [S.Changes]: {} }
		while (r < iterations) {
			const pauseExecution = pause.call(instance, currentState, r)
			if (pauseExecution) await pauseExecution;
			if (until.call(instance, currentState, r)) break;
			if (++r >= iterations) throw new MaxIterationsError(`Maximum iterations of ${iterations} reached at path [ ${currentState[S.Stack][0].map(key => key.toString()).join(', ')} ]`, { instance, state: currentState, data: { iterations } })
			if (trace) currentState = { ...currentState, [S.Trace]: [ ...currentState[S.Trace], currentState[S.Stack] ] }
			if (interruptionStack.length) currentState = await this._perform(instance, currentState, interruptionStack.shift() as Action)
			else {
				const action = await this._execute(instance, currentState)
				currentState = await this._perform(instance, currentState, action)
				currentState = await this._proceed(instance, currentState, action, true)
			}
		}
		return adaptOutput.call(instance, after.reduce((prev, modifier) => modifier.call(instance, prev), currentState))
	})(), (...interruptions) => {
			if (interruptions.length === 1 && instance.config.nodes.typeof(interruptions[0]) === NodeTypes.ID)
				interruptionStack.push(interruptions[0])
			else {
				const interruption = Symbol("System Interruption")
				instance.process[interruption] = interruptions
				interruptionStack.push(interruption)
			}
		})
	}
}
export abstract class SuperSmallStateMachineChain<
	State extends InitialState = InitialState,
	Output extends unknown = undefined,
	Input extends Array<unknown> = [Partial<InputSystemState<State, Output>>] | [],
	Action extends unknown = ActionType<State, Output>,
	Process extends unknown = ProcessType<State, Output, Action>,
> extends SuperSmallStateMachineCore<State, Output, Input, Action, Process> {
	static closest<
	State extends InitialState = InitialState,
	Output extends unknown = undefined,
	Input extends Array<unknown> = [Partial<InputSystemState<State, Output>>] | [],
	Action extends unknown = ActionType<State, Output>,
	Process extends unknown = ProcessType<State, Output, Action>,
>(path: Path, ...nodeTypes: Array<string | symbol | Array<string | symbol>>) { return (instance: Instance<State, Output, Input, Action, Process>): Path | null => this._closest(instance, path, ...nodeTypes) }
	static changes<
	State extends InitialState = InitialState,
	Output extends unknown = undefined,
	Input extends Array<unknown> = [Partial<InputSystemState<State, Output>>] | [],
	Action extends unknown = ActionType<State, Output>,
	Process extends unknown = ProcessType<State, Output, Action>,
>(state: SystemState<State, Output>, changes: Partial<State>) { return (instance: Instance<State, Output, Input, Action, Process>): SystemState<State, Output> => this._changes(instance, state, changes) }
	static proceed<
	State extends InitialState = InitialState,
	Output extends unknown = undefined,
	Input extends Array<unknown> = [Partial<InputSystemState<State, Output>>] | [],
	Action extends unknown = ActionType<State, Output>,
	Process extends unknown = ProcessType<State, Output, Action>,
>(state: SystemState<State, Output>, node: Process) { return (instance: Instance<State, Output, Input, Action, Process>): SystemState<State, Output> => this._proceed(instance, state, node) }
	static perform<
	State extends InitialState = InitialState,
	Output extends unknown = undefined,
	Input extends Array<unknown> = [Partial<InputSystemState<State, Output>>] | [],
	Action extends unknown = ActionType<State, Output>,
	Process extends unknown = ProcessType<State, Output, Action>,
>(state: SystemState<State, Output>, action: Action) { return (instance: Instance<State, Output, Input, Action, Process>): SystemState<State, Output> => this._perform(instance, state, action) }
	static execute<
	State extends InitialState = InitialState,
	Output extends unknown = undefined,
	Input extends Array<unknown> = [Partial<InputSystemState<State, Output>>] | [],
	Action extends unknown = ActionType<State, Output>,
	Process extends unknown = ProcessType<State, Output, Action>,
>(state: SystemState<State, Output>, node: Process) { return (instance: Instance<State, Output, Input, Action, Process>): Action => this._execute(instance, state, node) }
	static traverse<
	State extends InitialState = InitialState,
	Output extends unknown = undefined,
	Input extends Array<unknown> = [Partial<InputSystemState<State, Output>>] | [],
	Action extends unknown = ActionType<State, Output>,
	Process extends unknown = ProcessType<State, Output, Action>,
>(iterator: ((node: Process, path: Path, process: Process, nodeType: string | symbol) => Process)) { return (instance: Instance<State, Output, Input, Action, Process>) => this._traverse(instance, iterator) }
	static run<
	State extends InitialState = InitialState,
	Output extends unknown = undefined,
	Input extends Array<unknown> = [Partial<InputSystemState<State, Output>>] | [],
	Action extends unknown = ActionType<State, Output>,
	Process extends unknown = ProcessType<State, Output, Action>,
>(...input: Input) { return (instance: Instance<State, Output, Input, Action, Process>): Output => this._run(instance, ...input) }
	static runSync<
	State extends InitialState = InitialState,
	Output extends unknown = undefined,
	Input extends Array<unknown> = [Partial<InputSystemState<State, Output>>] | [],
	Action extends unknown = ActionType<State, Output>,
	Process extends unknown = ProcessType<State, Output, Action>,
>(...input: Input) { return (instance: Instance<State, Output, Input, Action, Process>): Output => this._runSync(instance, ...input) }
	static runAsync<
	State extends InitialState = InitialState,
	Output extends unknown = undefined,
	Input extends Array<unknown> = [Partial<InputSystemState<State, Output>>] | [],
	Action extends unknown = ActionType<State, Output>,
	Process extends unknown = ProcessType<State, Output, Action>,
>(...input: Input) { return (instance: Instance<State, Output, Input, Action, Process>): Promise<Output> => this._runAsync(instance, ...input) }
	static do<
	State extends InitialState = InitialState,
	Output extends unknown = undefined,
	Input extends Array<unknown> = [Partial<InputSystemState<State, Output>>] | [],
	Action extends unknown = ActionType<State, Output>,
	Process extends unknown = ProcessType<State, Output, Action>,
>(process: Process) { return (instance: Instance<State, Output, Input, Action, Process>): Instance<State, Output, Input, Action, Process> => ({ process: instance.config.adapt.reduce((prev, modifier) => modifier.call(instance, prev), process), config: instance.config }) }
	static defaults<
	State extends InitialState = InitialState,
	Output extends unknown = undefined,
	Input extends Array<unknown> = [Partial<InputSystemState<State, Output>>] | [],
	Action extends unknown = ActionType<State, Output>,
	Process extends unknown = ProcessType<State, Output, Action>,
	NewState extends InitialState = State,
>(defaults: NewState) { return (instance: Instance<State, Output, Input, Action, Process>): Pick<S<NewState, Output, [Partial<InputSystemState<NewState>>] | [], ActionType<NewState, Output>, ProcessType<NewState, Output, ActionType<NewState, Output>>>, 'process' | 'config'> => ({ process: instance.process as unknown as ProcessType<NewState, Output, ActionType<NewState, Output>>, config: { ...instance.config, defaults } as unknown as Config<NewState, Output, [Partial<InputSystemState<NewState>>] | [], ActionType<NewState, Output>, ProcessType<NewState, Output, ActionType<NewState, Output>>>, }) }
	static input<
	State extends InitialState = InitialState,
	Output extends unknown = undefined,
	Input extends Array<unknown> = [Partial<InputSystemState<State, Output>>] | [],
	Action extends unknown = ActionType<State, Output>,
	Process extends unknown = ProcessType<State, Output, Action>,
	NewInput extends Array<unknown> = Array<unknown>,
>(input: (...input: NewInput) => Partial<InputSystemState<State, Output>>) { return (instance: Instance<State, Output, Input, Action, Process>): Pick<S<State, Output, NewInput, Action, Process>, 'process' | 'config'> => ({ process: instance.process, config: { ...instance.config, input } as unknown as Config<State, Output, NewInput, Action, Process>, }) }
	static output<
	State extends InitialState = InitialState,
	Output extends unknown = undefined,
	Input extends Array<unknown> = [Partial<InputSystemState<State, Output>>] | [],
	Action extends unknown = ActionType<State, Output>,
	Process extends unknown = ProcessType<State, Output, Action>,
	NewResult extends unknown = Output,
>(output: (state: SystemState<State, Output>) => NewResult) { return (instance: Instance<State, Output, Input, Action, Process>): Pick<S<State, NewResult, Input, ActionType<State, NewResult>, ProcessType<State, NewResult, ActionType<State, NewResult>>>, 'process' | 'config'> => ({ process: instance.process as unknown as ProcessType<State, NewResult, ActionType<State, NewResult>>, config: { ...instance.config, output } as unknown as Config<State, NewResult, Input, ActionType<State, NewResult>, ProcessType<State, NewResult, ActionType<State, NewResult>>>, }) }
	static untrace<
	State extends InitialState = InitialState,
	Output extends unknown = undefined,
	Input extends Array<unknown> = [Partial<InputSystemState<State, Output>>] | [],
	Action extends unknown = ActionType<State, Output>,
	Process extends unknown = ProcessType<State, Output, Action>,
>(instance: Instance<State, Output, Input, Action, Process>): Instance<State, Output, Input, Action, Process> { return ({ process: instance.process, config: { ...instance.config, trace: false }, }) }
	static trace<
	State extends InitialState = InitialState,
	Output extends unknown = undefined,
	Input extends Array<unknown> = [Partial<InputSystemState<State, Output>>] | [],
	Action extends unknown = ActionType<State, Output>,
	Process extends unknown = ProcessType<State, Output, Action>,
>(instance: Instance<State, Output, Input, Action, Process>): Instance<State, Output, Input, Action, Process> { return ({ process: instance.process, config: { ...instance.config, trace: true }, }) }
	static shallow<
	State extends InitialState = InitialState,
	Output extends unknown = undefined,
	Input extends Array<unknown> = [Partial<InputSystemState<State, Output>>] | [],
	Action extends unknown = ActionType<State, Output>,
	Process extends unknown = ProcessType<State, Output, Action>,
>(instance: Instance<State, Output, Input, Action, Process>): Instance<State, Output, Input, Action, Process> { return ({ process: instance.process, config: { ...instance.config, deep: false }, }) }
	static deep<
	State extends InitialState = InitialState,
	Output extends unknown = undefined,
	Input extends Array<unknown> = [Partial<InputSystemState<State, Output>>] | [],
	Action extends unknown = ActionType<State, Output>,
	Process extends unknown = ProcessType<State, Output, Action>,
>(instance: Instance<State, Output, Input, Action, Process>): Instance<State, Output, Input, Action, Process> { return ({ process: instance.process, config: { ...instance.config, deep: true }, }) }
	static unstrict<
	State extends InitialState = InitialState,
	Output extends unknown = undefined,
	Input extends Array<unknown> = [Partial<InputSystemState<State, Output>>] | [],
	Action extends unknown = ActionType<State, Output>,
	Process extends unknown = ProcessType<State, Output, Action>,
>(instance: Instance<State, Output, Input, Action, Process>): Instance<State, Output, Input, Action, Process> { return ({ process: instance.process, config: { ...instance.config, strict: false }, }) }
	static strict<
	State extends InitialState = InitialState,
	Output extends unknown = undefined,
	Input extends Array<unknown> = [Partial<InputSystemState<State, Output>>] | [],
	Action extends unknown = ActionType<State, Output>,
	Process extends unknown = ProcessType<State, Output, Action>,
> (instance: Instance<State, Output, Input, Action, Process>): Instance<State, Output, Input, Action, Process> { return ({ process: instance.process, config: { ...instance.config, strict: true }, }) }
	static strictTypes<
	State extends InitialState = InitialState,
	Output extends unknown = undefined,
	Input extends Array<unknown> = [Partial<InputSystemState<State, Output>>] | [],
	Action extends unknown = ActionType<State, Output>,
	Process extends unknown = ProcessType<State, Output, Action>,
> (instance: Instance<State, Output, Input, Action, Process>): Instance<State, Output, Input, Action, Process> { return ({ process: instance.process, config: { ...instance.config, strict: S.StrictTypes }, }) }
	static for<
	State extends InitialState = InitialState,
	Output extends unknown = undefined,
	Input extends Array<unknown> = [Partial<InputSystemState<State, Output>>] | [],
	Action extends unknown = ActionType<State, Output>,
	Process extends unknown = ProcessType<State, Output, Action>,
>(iterations: number = 10000) { return (instance: Instance<State, Output, Input, Action, Process>): Instance<State, Output, Input, Action, Process> => ({ process: instance.process, config: { ...instance.config, iterations }, }) }
	static until<
	State extends InitialState = InitialState,
	Output extends unknown = undefined,
	Input extends Array<unknown> = [Partial<InputSystemState<State, Output>>] | [],
	Action extends unknown = ActionType<State, Output>,
	Process extends unknown = ProcessType<State, Output, Action>,
>(until: Config<State, Output, Input, Action, Process>['until']) { return (instance: Instance<State, Output, Input, Action, Process>): Instance<State, Output, Input, Action, Process> => ({ process: instance.process, config: { ...instance.config, until }, }) }
	static forever<
	State extends InitialState = InitialState,
	Output extends unknown = undefined,
	Input extends Array<unknown> = [Partial<InputSystemState<State, Output>>] | [],
	Action extends unknown = ActionType<State, Output>,
	Process extends unknown = ProcessType<State, Output, Action>,
> (instance: Instance<State, Output, Input, Action, Process>): Instance<State, Output, Input, Action, Process> { return ({ process: instance.process, config: { ...instance.config, iterations: Infinity }, }) }
	static sync<
	State extends InitialState = InitialState,
	Output extends unknown = undefined,
	Input extends Array<unknown> = [Partial<InputSystemState<State, Output>>] | [],
	Action extends unknown = ActionType<State, Output>,
	Process extends unknown = ProcessType<State, Output, Action>,
> (instance: Instance<State, Output, Input, Action, Process>): Pick<S<State, Awaited<Output>, Input, Action, Process>, 'process' | 'config'> { return ({ process: instance.process, config: { ...instance.config, async: false } as unknown as Config<State, Awaited<Output>, Input, Action, Process>, }) }
	static async<
	State extends InitialState = InitialState,
	Output extends unknown = undefined,
	Input extends Array<unknown> = [Partial<InputSystemState<State, Output>>] | [],
	Action extends unknown = ActionType<State, Output>,
	Process extends unknown = ProcessType<State, Output, Action>,
> (instance: Instance<State, Output, Input, Action, Process>): Pick<S<State, Promise<Output>, Input, Action, Process>, 'process' | 'config'> { return ({ process: instance.process, config: { ...instance.config, async: true } as unknown as Config<State, Promise<Output>, Input, Action, Process>, }) }
	static pause<
	State extends InitialState = InitialState,
	Output extends unknown = undefined,
	Input extends Array<unknown> = [Partial<InputSystemState<State, Output>>] | [],
	Action extends unknown = ActionType<State, Output>,
	Process extends unknown = ProcessType<State, Output, Action>,
>(pause: Config<State, Output, Input, Action, Process>['pause']) { return (instance: Instance<State, Output, Input, Action, Process>): Instance<State, Output, Input, Action, Process> => ({ process: instance.process, config: { ...instance.config, pause }, }) }
	static override<
	State extends InitialState = InitialState,
	Output extends unknown = undefined,
	Input extends Array<unknown> = [Partial<InputSystemState<State, Output>>] | [],
	Action extends unknown = ActionType<State, Output>,
	Process extends unknown = ProcessType<State, Output, Action>,
>(override: ((...args: Input) => Output) | null) { return (instance: Instance<State, Output, Input, Action, Process>): Instance<State, Output, Input, Action, Process> => ({ process: instance.process, config: { ...instance.config, override } }) }
	static addNode<
	State extends InitialState = InitialState,
	Output extends unknown = undefined,
	Input extends Array<unknown> = [Partial<InputSystemState<State, Output>>] | [],
	Action extends unknown = ActionType<State, Output>,
	Process extends unknown = ProcessType<State, Output, Action>,
>(...nodes: any[]) { return (instance: Instance<State, Output, Input, Action, Process>) => ({ process: instance.process, config: { ...instance.config, nodes: new NS(...instance.config.nodes.values(),...nodes) }, }) }
	static adapt<
	State extends InitialState = InitialState,
	Output extends unknown = undefined,
	Input extends Array<unknown> = [Partial<InputSystemState<State, Output>>] | [],
	Action extends unknown = ActionType<State, Output>,
	Process extends unknown = ProcessType<State, Output, Action>,
>(...adapters: Array<(process: Process) => Process>) { return (instance: Instance<State, Output, Input, Action, Process>): Pick< S<State, Output, Input, Action, Process>, 'process' | 'config'> => ({ process: adapters.reduce((prev, adapter) => adapter.call(instance, prev), instance.process), config: { ...instance.config, adapt: [ ...instance.config.adapt, ...adapters ] }, }) }
	static before<
	State extends InitialState = InitialState,
	Output extends unknown = undefined,
	Input extends Array<unknown> = [Partial<InputSystemState<State, Output>>] | [],
	Action extends unknown = ActionType<State, Output>,
	Process extends unknown = ProcessType<State, Output, Action>,
>(...adapters: Array<(state: SystemState<State, Output>) => SystemState<State, Output>>) { return (instance: Instance<State, Output, Input, Action, Process>): Instance<State, Output, Input, Action, Process> => ({ process: instance.process, config: { ...instance.config, before: [ ...instance.config.before, ...adapters ] }, }) }
	static after<
	State extends InitialState = InitialState,
	Output extends unknown = undefined,
	Input extends Array<unknown> = [Partial<InputSystemState<State, Output>>] | [],
	Action extends unknown = ActionType<State, Output>,
	Process extends unknown = ProcessType<State, Output, Action>,
>(...adapters: Array<(state: SystemState<State, Output>) => SystemState<State, Output>>) { return (instance: Instance<State, Output, Input, Action, Process>): Instance<State, Output, Input, Action, Process> => ({ process: instance.process, config: { ...instance.config, after: [ ...instance.config.after, ...adapters ] }, }) }
	static with<
	State extends InitialState = InitialState,
	Output extends unknown = undefined,
	Input extends Array<unknown> = [Partial<InputSystemState<State, Output>>] | [],
	Action extends unknown = ActionType<State, Output>,
	Process extends unknown = ProcessType<State, Output, Action>,

	NewState extends InitialState = State,
	NewResult extends unknown = Output,
	NewInput extends Array<unknown> = Input,
	NewAction extends unknown = Action,
	NewProcess extends unknown = Process
>(...adapters: Array<((instance: Instance<State, Output, Input, Action, Process>) => Pick<S<NewState, NewResult, NewInput, NewAction, NewProcess>, 'process' | 'config'>)>) {
		const flatAdapters = adapters.flat(Infinity)
		return (instance: Instance<State, Output, Input, Action, Process>): S<NewState, NewResult, NewInput, NewAction, NewProcess> => {
			const adapted = flatAdapters.reduce((prev, adapter) => adapter.call(instance, prev) as unknown as Instance<State, Output, Input, Action, Process>, instance) as unknown as Pick<S<NewState, NewResult, NewInput, NewAction, NewProcess>, 'process' | 'config'>
			return adapted instanceof S ? adapted : new S<NewState, NewResult, NewInput, NewAction, NewProcess>(adapted.process, adapted.config)
		}
	}
}
export default class S<
	State extends InitialState = InitialState,
	Output extends unknown = undefined,
	Input extends Array<unknown> = [Partial<InputSystemState<State, Output>>] | [],
	Action extends unknown = ActionType<State, Output>,
	Process extends unknown = ProcessType<State, Output, Action>,
> extends SuperSmallStateMachineChain<State, Output, Input, Action, Process> {
	process = null as Process
	#config: Config<State, Output, Input, Action, Process> = S.config as unknown as Config<State, Output, Input, Action, Process>
	get config(): Config<State, Output, Input, Action, Process> { return { ...this.#config } }
	constructor(process: Process = (null as Process), config: Config<State, Output, Input, Action, Process> = (S.config as unknown as Config<State, Output, Input, Action, Process>)) {
		super((...input: Input): Output => (config.override || this.run).apply(this, input))
		this.#config = { ...this.#config, ...config } as unknown as Config<State, Output, Input, Action, Process>
		this.process = process
	}
	closest(path: Path, ...nodeTypes: Array<string | symbol | Array<string | symbol>>): Path | null { return S._closest(this, path, ...nodeTypes) }
	changes(state: SystemState<State, Output>, changes: Partial<State>): SystemState<State, Output> { return S._changes(this, state, changes) }
	proceed(state: SystemState<State, Output>, node: Process | Action, isAction: boolean) { return S._proceed(this, state, node, isAction) }
	perform(state: SystemState<State, Output>, action: Action) { return S._perform(this, state, action) }
	execute(state: SystemState<State, Output>, node: Process) { return S._execute(this, state, node) }
	traverse(iterator: ((node: Process, path: Path, process: Process, nodeType: string | symbol) => Process)){ return S._traverse(this, iterator) }
	run (...input: Input): Output { return S._run(this, ...input) }
	runSync (...input: Input): Output { return S._runSync(this, ...input) }
	runAsync(...input: Input): Promise<Output> { return S._runAsync(this, ...input) }
	do(process: Process): S<State, Output, Input, Action, Process> { return this.with(S.do(process)) }
	defaults<NewState extends InitialState = State>(defaults: NewState): S<NewState, Output, [Partial<InputSystemState<NewState>>] | [], ActionType<NewState, Output>, ProcessType<NewState, Output, ActionType<NewState, Output>>> { return this.with(S.defaults(defaults)) }
	input<NewInput extends Array<unknown> = Array<unknown>>(input: (...input: NewInput) => Partial<InputSystemState<State, Output>>): S<State, Output, NewInput, Action, Process> { return this.with(S.input(input)) }
	output<NewResult extends unknown = Output>(output: (state: SystemState<State, Output>) => NewResult): S<State, NewResult, Input, ActionType<State, NewResult>, ProcessType<State, NewResult, ActionType<State, NewResult>>> { return this.with(S.output(output)) }
	get untrace(): S<State, Output, Input, Action, Process> { return this.with(S.untrace) }
	get trace(): S<State, Output, Input, Action, Process> { return this.with(S.trace) }
	get shallow(): S<State, Output, Input, Action, Process> { return this.with(S.shallow) }
	get deep(): S<State, Output, Input, Action, Process> { return this.with(S.deep) }
	get unstrict(): S<State, Output, Input, Action, Process> { return this.with(S.unstrict) }
	get strict(): S<State, Output, Input, Action, Process> { return this.with(S.strict) }
	get strictTypes(): S<State, Output, Input, Action, Process> { return this.with(S.strictTypes) }
	for(iterations: number): S<State, Output, Input, Action, Process> { return this.with(S.for(iterations)) }
	until(until: Config<State, Output, Input, Action, Process>['until']): S<State, Output, Input, Action, Process> { return this.with(S.until(until)) }
	get forever(): S<State, Output, Input, Action, Process> { return this.with(S.forever) }
	get sync(): S<State, Awaited<Output>, Input, Action, Process> { return this.with(S.sync) }
	get async(): S<State, Promise<Output>, Input, Action, Process> { return this.with(S.async) }
	pause(pause: Config<State, Output, Input, Action, Process>['pause']): S<State, Output, Input, Action, Process> { return this.with(S.pause(pause)) }
	override(override: ((...args: Input) => Output) | null): S<State, Output, Input, Action, Process> { return this.with(S.override(override)) }
	addNode(...nodes: any[]) { return this.with(S.addNode(...nodes)) }
	adapt(...adapters: Array<(process: Process) => Process>): S<State, Output, Input, Action, Process> { return this.with(S.adapt(...adapters)) }
	before(...adapters: Array<(state: SystemState<State, Output>) => SystemState<State, Output>>): S<State, Output, Input, Action, Process> { return this.with(S.before(...adapters)) }
	after(...adapters: Array<(state: SystemState<State, Output>) => SystemState<State, Output>>): S<State, Output, Input, Action, Process> { return this.with(S.after(...adapters)) }
	with<NewState extends InitialState = State, NewResult extends unknown = Output, NewInput extends Array<unknown> = Input, NewAction extends unknown = Action, NewProcess extends unknown = Process>(...transformers: Array<(instance: Instance<State, Output, Input, Action, Process>) => Pick<S<NewState, NewResult, NewInput, NewAction, NewProcess>, 'process' | 'config'>>): S<NewState, NewResult, NewInput, NewAction, NewProcess> { return S.with<State, Output, Input, Action, Process, NewState, NewResult, NewInput, NewAction, NewProcess>(...transformers)(this) }
}
export const StateMachine = S
export const SuperSmallStateMachine = S
export const NodeDefinition = N
export const NodeDefinitions = NS
