export const clone_object = (obj) => {
	if (Array.isArray(obj)) return obj.map(clone_object)
	if (obj === null) return null
	if (typeof obj !== 'object') return obj
	return Object.fromEntries(Object.entries(obj).map(([key,value]) => [ key, clone_object(value) ]));
}
export const unique_list_strings = (list, getId = ident) => Object.values(Object.fromEntries(list.map(item=>[getId(item),item])));
const reduce_get_path_object = (obj, step) => obj ? obj[step] : undefined
export const get_path_object = (object, path = []) => (path.reduce(reduce_get_path_object, object))
export const set_path_object = (object, path = [], value = undefined) => {
	if (path.length === 0 || typeof object !== 'object' || !object) return value
	if (Array.isArray(object)) return [ ...object.slice(0,path[0]), set_path_object(object[path[0]], path.slice(1), value), ...object.slice(1+path[0]) ]
	return { ...object, [path[0]]: set_path_object(object[path[0]], path.slice(1), value), }
}
export const update_path_object = (object, path = [], transformer = ident) => set_path_object(object, path, transformer(get_path_object(object, path), path, object))
const map_list_path_object = ([ key, value ]) => list_path_object(value).map(path => [ key, ...path ])
export const list_path_object = object => typeof object !== 'object' || !object ? [[]] : [[]].concat(...Object.entries(object).map(map_list_path_object))
export const normalise_function = (functOrReturn) => (typeof functOrReturn === 'function') ? functOrReturn : () => functOrReturn
const reduce_deep_merge_object = (base, override) => {
	if (!((base && typeof base === 'object') && !Array.isArray(base) && (override && typeof override === 'object') && !Array.isArray(override)))
		return override;
	const allKeys = unique_list_strings(Object.keys(base).concat(Object.keys(override)));
	return Object.fromEntries(allKeys.map(key => [ key, key in override ? deep_merge_object(base[key], override[key]) : base[key] ]));
}
export const deep_merge_object = (base, ...overrides) => overrides.reduce(reduce_deep_merge_object, base)
export const shallow_merge_object = (...objects) => Object.fromEntries([].concat(...objects.map(object => Object.entries(object))))
export const get_closest_path = (object, path = [], condition = () => true) => {
const item = get_path_object(object, path)
if (condition(item, path, object)) return path
if (path.length === 0) return null
return get_closest_path(object, path.slice(0,-1), condition)
}
export const wait_time = delay => (delay ? new Promise(resolve => setTimeout(resolve, delay)) : Promise.resolve())
export const name = obj => obj.name
export const named = (name, obj) => {
	const type = typeof obj
	if (type === 'function') return ({ [name]: (...args) => obj(...args) })[name]
	if (type === 'object' && !Array.isArray(obj)) return { ...obj, name }
	const ret = type === 'object' ? [...obj] : obj
	ret.name = name
	return ret
}
export const noop = () => {}
export const ident = original => original
export const inc = (property, by = 1) => named(`${by === 1 ? 'increment ':''}${by === -1 ? 'decrement ':''}${property}${Math.sign(by) === 1 && by !== 1 ? ` plus ${by}`:''}${Math.sign(by) === -1 && by !== -1 ? ` minus ${Math.abs(by)}`:''}`, ({ [property]: i }) => ({ [property]: i + by }))
export const and = (...methods) => named(methods.map(name).join(' and '), (...args) => methods.every(method => method(...args)))
export const or = (...methods) => named(methods.map(name).join(' or '), (...args) => methods.some(method => method(...args)))
export const not = method => named(`not ${method.name}`, (...args) => !method(...args))
export const forIn = (list, index, ...methods) => named(`for ${index} in ${list}`, [ named(`reset ${index}`, () => ({ [index]: 0 })), { while: named(`${index} is within ${list}`, ({ [index]: i, [list]: l }) => i < l.length), do: [ methods, inc(index) ] } ])
export class SuperSmallStateMachineError extends Error {
	instance; state; data;
	constructor(message, { instance, state, data } = {}) {
		super(message)
		Object.assign(this, { instance, state, data })
	}
}
export class SuperSmallStateMachineReferenceError extends SuperSmallStateMachineError {}
export class SuperSmallStateMachineTypeError extends SuperSmallStateMachineError {}
export class StateReferenceError extends SuperSmallStateMachineReferenceError {}
export class StateTypeError extends SuperSmallStateMachineTypeError {}
export class NodeTypeError extends SuperSmallStateMachineTypeError {}
export class NodeReferenceError extends SuperSmallStateMachineReferenceError {}
export class MaxIterationsError extends SuperSmallStateMachineError {}
export class PathReferenceError extends SuperSmallStateMachineReferenceError {}
export const Stack       = Symbol('SSSM Stack')
export const Interrupts  = Symbol('SSSM Interrupts')
export const Trace       = Symbol('SSSM Trace')
export const StrictTypes = Symbol('SSSM Strict Types')
export class Nodes extends Map {
	constructor(...nodes) { super(nodes.flat(Infinity).map(node => [node.type,node])) }
	typeof(object, objectType = typeof object, isAction = false) {
		const foundType = [...this.values()].findLast(current => current.typeof(object, objectType, isAction))
		return foundType ? foundType.type : false
	}
	get keywords() { return [...this.values()].flatMap(({ keywords }) => keywords) }
}
export class Node {
	static type = Symbol('SSSM Unnamed')
	static typeof = () => false
	static keywords = []
	static execute = ident
	static proceed (nodeInfo, state) {
		const stack = state[Stack] || [[]]
		if (stack[0].length === 0) {
			if (stack.length === 1) return { ...state, [Return]: state[Return], [Stack]: [] }
			const { [Return]: interruptReturn, ...cleanState } = state
			return { ...cleanState, [Stack]: stack.slice(1), [Interrupts]: state[Interrupts].slice(1), [state[Interrupts][0]]: interruptReturn }
		}
		const parPath = stack[0].slice(0,-1)
		return S._proceed(this, { ...state, [Stack]: [parPath, ...stack.slice(1)] }, { node: get_path_object(this.process, parPath), action: false, index: stack[0][parPath.length] })
	}
	static perform(action, state) { return state }
	static traverse = ident;
}
export const ErrorN = Symbol('SSSM Error')
export class ErrorNode extends Node {
	static type = ErrorN
	static typeof = (object, objectType) => (objectType === 'object' && object instanceof Error) || (objectType === 'function' && (object === Error || object.prototype instanceof Error))
	static perform(action, state) {
		if (typeof action === 'function') throw new action()
		throw action
	}
}
export const Changes = Symbol('SSSM Changes')
export class ChangesNode extends Node {
	static type = Changes
	static typeof(object, objectType) { return Boolean(object && objectType === 'object') }
	static perform(action, state) { return S._changes(this, state, action) }
}
export const Sequence = Symbol('SSSM Sequence')
export class SequenceNode extends Node {
	static type = Sequence
	static proceed(nodeInfo, state) {
		if (nodeInfo.node && (typeof nodeInfo.index === 'number') && (nodeInfo.index+1 < nodeInfo.node.length)) return { ...state, [Stack]: [[...state[Stack][0], nodeInfo.index+1], ...state[Stack].slice(1)] }
		return Node.proceed.call(this, nodeInfo, state)
	}
	static typeof(object, objectType, isAction) { return ((!isAction) && objectType === 'object' && Array.isArray(object)) }
	static execute(node, state) { return node.length ? [ ...state[Stack][0], 0 ] : null }
	static traverse(node, path, iterate) { return node.map((_,i) => iterate([...path,i])) }
}
export const FunctionN = Symbol('SSSM Function')
export class FunctionNode extends Node {
	static type = FunctionN
	static typeof(object, objectType, isAction) { return (!isAction) && objectType === 'function' }
	static execute(node, state) { return node(state) }
}
export const Undefined = Symbol('SSSM Undefined')
export class UndefinedNode extends Node {
	static type = Undefined
	static typeof(object, objectType) { return objectType === 'undefined' }
	static execute(node, state) { throw new NodeReferenceError(`There is nothing to execute at path [ ${state[Stack][0].map(key => key.toString()).join(', ')} ]`, { instance: this, state, data: { node } }) }
}
export const Empty = Symbol('SSSM Empty')
export class EmptyNode extends Node {
	static type = Empty
	static typeof(object, objectType) { return object === null }
}
export const Condition = Symbol('SSSM Condition')
export class ConditionNode extends Node {
	static type = Condition
	static typeof(object, objectType, isAction) { return Boolean((!isAction) && object && objectType === 'object' && ('if' in object)) }
	static keywords = ['if','then','else']
	static execute(node, state) {
		if (normalise_function(node.if)(state))
		return 'then' in node ? [ ...state[Stack][0], 'then' ] : null
		return 'else' in node ? [ ...state[Stack][0], 'else' ] : null
	}
	static traverse(node, path, iterate) { return {
		...node,
		...('then' in node ? { then: iterate([...path,'then']) } : {}),
		...('else' in node ? { else: iterate([...path,'else']) } : {})
	} }
}
export const Switch = Symbol('SSSM Switch')
export class SwitchNode extends Node {
	static type = Switch
	static typeof(object, objectType, isAction) { return Boolean((!isAction) && object && objectType === 'object' && ('switch' in object)) }
	static keywords = ['switch','case','default']
	static execute(node, state) {
		const key = normalise_function(node.switch)(state)
		const fallbackKey = (key in node.case) ? key : 'default'
		return (fallbackKey in node.case) ? [ ...state[Stack][0], 'case', fallbackKey ] : null
	}
	static traverse(node, path, iterate) { return { ...node, case: Object.fromEntries(Object.keys(node.case).map(key => [ key, iterate([...path,'case',key]) ])), } }
}
export const While = Symbol('SSSM While')
export class WhileNode extends Node {
	static type = While
	static typeof(object, objectType, isAction) { return Boolean((!isAction) && object && objectType === 'object' && ('while' in object)) }
	static keywords = ['while','do']
	static execute(node, state) {
		if (!(('do' in node) && normalise_function(node.while)(state))) return null
		return [ ...state[Stack][0], 'do' ]
	}
	static proceed(nodeInfo, state) { return state }
	static traverse(node, path, iterate) { return { ...node, ...('do' in node ? { do: iterate([ ...path, 'do' ]) } : {}), } }
}
export const Machine = Symbol('SSSM Machine')
export class MachineNode extends Node {
	static type = Machine
	static typeof(object, objectType, isAction) { return Boolean((!isAction) && object && objectType === 'object' && ('initial' in object)) }
	static keywords = ['initial']
	static execute(node, state) { return [ ...state[Stack][0], 'initial' ] }
	static traverse(node, path, iterate) { return { ...node, ...Object.fromEntries(Object.keys(node).concat(Interrupts in node ? node[Interrupts]: []).map(key => [ key, iterate([...path,key]) ])) } }
}
export const Goto = Symbol('SSSM Goto')
export class GotoNode extends Node {
	static type = Goto
	static typeof(object, objectType, isAction) { return Boolean(object && objectType === 'object' && (Goto in object)) }
	static perform(action, state) { return S._perform(this, state, action[Goto]) }
	static proceed(nodeInfo, state) { return state }
}
export const SequenceGoto = Symbol('SSSM Sequence Goto')
export class SequenceGotoNode extends GotoNode {
	static type = SequenceGoto
	static typeof(object, objectType, isAction) { return objectType === 'number' }
	static perform(action, state) {
		const lastOf = S._closest(this, state[Stack][0].slice(0,-1), SequenceNode.type)
		if (!lastOf) throw new PathReferenceError(`A relative goto has been provided as a number (${String(action)}), but no sequence exists that this number could be an index of from path [ ${state[Stack][0].map(key => key.toString()).join(', ')} ].`, { instance: this, state, data: { action } })
		return { ...state, [Stack]: [ [...lastOf, action], ...state[Stack].slice(1) ] }
	}
}
export const MachineGoto = Symbol('SSSM Machine Goto')
export class MachineGotoNode extends GotoNode {
	static type = MachineGoto
	static typeof(object, objectType, isAction) { return objectType === 'string' }
	static perform(action, state) {
		const lastOf = S._closest(this, state[Stack][0].slice(0,-1), MachineNode.type)
		if (!lastOf) throw new PathReferenceError(`A relative goto has been provided as a string (${String(action)}), but no state machine exists that this string could be a state of. From path [ ${state[Stack][0].map(key => key.toString()).join(', ')} ].`, { instance: this, state, data: { action } })
		return { ...state, [Stack]: [ [...lastOf, action], ...state[Stack].slice(1) ] }
	}
}
export const InterruptGoto = Symbol('SSSM Interrupt Goto')
export class InterruptGotoNode extends GotoNode {
	static type = InterruptGoto
	static typeof(object, objectType, isAction) { return objectType === 'symbol' }
	static perform(action, state) {
		const lastOf = get_closest_path(this.process, state[Stack][0].slice(0,-1), parentNode => Boolean(parentNode && (typeof parentNode === 'object') && (action in parentNode)))
		if (!lastOf) return { ...state, [Return]: action }
		return { ...state, [Stack]: [ [...lastOf, action], ...state[Stack] ], [Interrupts]: [ action, ...state[Interrupts] ] }
	}
	static proceed(nodeInfo, state) {
		const { [Stack]: stack, [Interrupts]: interrupts, [Return]: interruptReturn, ...proceedPrevious } = S._proceed(this, { ...state, [Stack]: state[Stack].slice(1), [Interrupts]: state[Interrupts].slice(1) }, { action: true })
		return { ...proceedPrevious, [Stack]: [ state[Stack][0], ...stack ], [Interrupts]: [ state[Interrupts][0], ...interrupts ], }
	}
}
export const AbsoluteGoto = Symbol('SSSM Absolute Goto')
export class AbsoluteGotoNode extends GotoNode {
	static type = AbsoluteGoto
	static typeof(object, objectType, isAction) { return isAction && Array.isArray(object) }
	static perform(action, state) { return { ...state, [Stack]: [ action, ...state[Stack].slice(1) ] } }
}
export const Return = Symbol('SSSM Return')
export class ReturnNode extends GotoNode {
	static type = Return
	static typeof(object, objectType) { return object === Return || Boolean(object && objectType === 'object' && (Return in object)) }
	static perform(action, state) { return { ...state, [Return]: !action || action === Return ? undefined : action[Return], } }
	static proceed = Node.proceed
}
export const Continue = Symbol('SSSM Continue')
export class ContinueNode extends GotoNode {
	static type = Continue
	static typeof(object, objectType) { return object === Continue }
	static perform(action, state) {
		const lastOf = S._closest(this, state[Stack][0].slice(0,-1), WhileNode.type)
		if (!lastOf) throw new PathReferenceError(`A Continue has been used, but no while exists that this Continue could refer to. From path [ ${state[Stack][0].map(key => key.toString()).join(', ')} ].`, { instance: this, state, data: { action } })
		return { ...state, [Stack]: [ lastOf, ...state[Stack].slice(1) ] }
	}
}
export const Break = Symbol('SSSM Break')
export class BreakNode extends GotoNode {
	static type = Break
	static typeof(object, objectType, isAction) { return object === Break }
	static proceed (nodeInfo, state) {
		const lastOf = S._closest(this, state[Stack][0].slice(0,-1), WhileNode.type)
		if (!lastOf) throw new PathReferenceError(`A Break has been used, but no while exists that this Break could refer to. From path [ ${state[Stack][0].map(key => key.toString()).join(', ')} ].`, { instance: this, state, data: { nodeInfo } })
		return S._proceed(this, { ...state, [Stack]: [lastOf.slice(0,-1), ...state[Stack].slice(1)] }, { node: get_path_object(this.process, lastOf.slice(0,-1)), action: false, index: lastOf[lastOf.length-1] })
	}
	static perform = Node.perform
}
export const Wait = Symbol("SSSM Wait")
export class WaitNode extends Node {
	static type = Wait
	static typeof(object, objectType) { return object === Wait }
}
export const uninterruptable = (...actions) => ({ [Uninterruptable]: actions.length === 1 ? actions[0] : actions })
export const Uninterruptable = Symbol("SSSM Uninterruptable")
export class UninterruptableNode extends Node {
    static type = Uninterruptable
    static typeof(object, objectType) { return object && (objectType === 'object') && (Uninterruptable in object) }
    static perform(action, state) {
        return {
            ...state,
            [Stack]: [  [ ...state[Stack][0], Uninterruptable ], ...state[Stack].slice(1) ],
            [Uninterruptable]: state[Uninterruptable] + 1,
        }
    }
    static proceed(nodeInfo, state) {
        if (nodeInfo.action) return state;
        const proceedAsNormal = Node.proceed.call(this, nodeInfo, state)
        return { ...proceedAsNormal, [Uninterruptable]: proceedAsNormal[Uninterruptable] - 1 }
    }
}
export class Interruptable extends Promise {
	#interruptor = () => {}
	#settled = false
	constructor(executorOrPromise, interruptor) {
		const settle = f => (...args) => {
			this.#settled = true
			f(...args)
		}
		if (typeof executorOrPromise === 'function') super((resolve, reject) => executorOrPromise(settle(resolve), settle(reject)))
		else super((resolve, reject) => { Promise.resolve(executorOrPromise).then(settle(resolve)).catch(settle(reject)) })
		this.#interruptor = interruptor
	}
	interrupt(...interruptions) {
		if (this.#settled) throw new Error('A settled Interruptable cannot be interrupted.')
		return this.#interruptor(...interruptions)
	}
}
export const Interrupt = Symbol("SSSM Interrupt")

export class ExtensibleFunction extends Function {
	constructor(f) { super(); return Object.setPrototypeOf(f, new.target.prototype) }
}
export class SuperSmallStateMachineCore extends ExtensibleFunction {
	static config = {
		defaults: {},
		input: (state = {}) => state,
		output:  state => state[Return],
		strict: false,
		iterations: 10000,
		until: state => Return in state,
		trace: false,
		deep: false,
		override: null,
		nodes: new Nodes(ChangesNode, SequenceNode, FunctionNode, ConditionNode, SwitchNode, WhileNode, MachineNode, GotoNode, InterruptGotoNode, AbsoluteGotoNode, MachineGotoNode, SequenceGotoNode, ErrorNode, UndefinedNode, EmptyNode, ContinueNode, BreakNode, ReturnNode, WaitNode, UninterruptableNode),
		adapt: [],
		before: [],
		after: [],
	}
	static _closest (instance, path = [], ...nodeTypes) {
		const flatTypes = nodeTypes.flat(Infinity)
		return get_closest_path(instance.process, path, i => {
			const nodeType = instance.config.nodes.typeof(i)
			return Boolean(nodeType && flatTypes.includes(nodeType))
		})
	}
	static _changes (instance, state = {}, changes = {}) {
		if (instance.config.strict && Object.entries(changes).some(([property]) => !(property in state)))
			throw new StateReferenceError(`Only properties that exist on the initial context may be updated.\nYou changed [ ${Object.keys(changes).filter(property => !(property in state)).map(key => key.toString()).join(', ')} ], which ${Object.keys(changes).filter(property => !(property in state)).length === 1 ? 'is' : 'are'} not in: [ ${Object.keys(state).map(key => key.toString()).join(', ')} ].\nPath: [ ${state[Stack][0].map(key => key.toString()).join(' / ')} ]`, { instance, state, data: { changes } })
		if (instance.config.strict === StrictTypes && Object.entries(changes).some(([property,value]) => typeof value !== typeof state[property]))
			throw new StateTypeError(`Properties must have the same type as their initial value. ${Object.entries(changes).filter(([property,value]) => typeof value !== typeof state[property]).map(([property,value]) => `${typeof value} given for '${property}', should be ${typeof state[property]}`).join('. ')}.`, { instance, state, data: { changes } })
		const merge = instance.config.deep ? deep_merge_object : shallow_merge_object
		const allChanges = merge(state[Changes] || {}, changes)
		return {
			...state,
			...merge(state, allChanges),
			[Changes]: allChanges
		}
	}
	static _proceed (instance, state = {}, nodeInfo = { node: undefined, action: false, index: undefined }) {
		const nodeType = instance.config.nodes.typeof(nodeInfo.node, typeof nodeInfo.node, nodeInfo.action)
		if (!nodeType) throw new NodeTypeError(`Unknown action type: ${typeof nodeInfo.node}${nodeType ? `, nodeType: ${String(nodeType)}` : ''}`, { instance, state, data: { nodeInfo } })
		return instance.config.nodes.get(nodeType).proceed.call(instance, nodeInfo, state)
	}
	static _perform (instance, state = {}, action = null) {
		const nodeType = instance.config.nodes.typeof(action, typeof action, true)
		if (!nodeType) throw new NodeTypeError(`Unknown action type: ${typeof action}${nodeType ? `, nodeType: ${String(nodeType)}` : ''}.`, { instance, state, data: { action } })
		return instance.config.nodes.get(nodeType).perform.call(instance, action, state)
	}
	static _execute (instance, state = {}, node = get_path_object(instance.process, state[Stack][0])) {
		const nodeType = instance.config.nodes.typeof(node)
		if (!nodeType) throw new NodeTypeError(`Unknown node type: ${typeof node}${nodeType ? `, nodeType: ${String(nodeType)}` : ''}.`, { instance, state, data: { node } })
		return instance.config.nodes.get(nodeType).execute.call(instance, node, state)
	}
	static _traverse(instance, iterator = ident) {
		const iterate = (path = []) => {
			const node = get_path_object(instance.process, path)
			const nodeType = instance.config.nodes.typeof(node)
			if (!nodeType) throw new NodeTypeError(`Unknown node type: ${typeof node}${nodeType ? `, nodeType: ${String(nodeType)}` : ''} at [ ${path.map(key => key.toString()).join(', ')} ]`, { instance, data: { node } })
			return iterator.call(instance, instance.config.nodes.get(nodeType).traverse.call(instance, node, path, iterate), path, instance.process, nodeType)
		}
		return iterate()
	}
	static _run (instance, ...input) {
        if (typeof instance.process !== 'object')
            throw new Error(`The top-level of an asynchronous state machine must be an object so that system interrupts may be performed.`)
        let interruptionStack = []
        let interruptionResolve = noop
        const waitForInterruption = resolve => {interruptionResolve = () => {resolve();interruptionResolve = noop}}
    
        const executor = async () => {
            const { until, iterations, input: adaptInput, output: adaptOutput, before, after, defaults, trace } = { ...S.config, ...instance.config }
            const modifiedInput = (await adaptInput.apply(instance, input)) || {}
            let r = 0, currentState = { ...before.reduce((prev, modifier) => modifier.call(instance, prev), S._changes(instance, {
                [Changes]: {},
                ...defaults,
                [Stack]: modifiedInput[Stack] || [[]],
                [Interrupts]: modifiedInput[Interrupts] || [],
                [Trace]: modifiedInput[Trace] || [],
                [Uninterruptable]: 0,
                [Interrupt]: (...args) => interruptable.interrupt(...args),
                ...(Return in modifiedInput ? {[Return]: modifiedInput[Return]} : {})
            }, modifiedInput)), [Changes]: {} }
            while (r < iterations) {
                if (await until.call(instance, currentState, r)) break;
                if (++r >= iterations) throw new MaxIterationsError(`Maximum iterations of ${iterations} reached at path [ ${currentState[Stack][0].map(key => key.toString()).join(', ')} ]`, { instance: instance, state: currentState, data: { iterations } })
                if (trace) currentState = { ...currentState, [Trace]: [ ...currentState[Trace], currentState[Stack] ] }
                if (interruptionStack.length && currentState[Uninterruptable] <= 0) {
                    while (interruptionStack.length)
                        currentState = await S._perform(instance, currentState, interruptionStack.shift())
                } else {
                    const action = await S._execute(instance, currentState)
                    if (action === Wait && !interruptionStack.length) await new Promise(waitForInterruption)
                    currentState = await S._perform(instance, currentState, action)
                    currentState = await S._proceed(instance, currentState, { node: action, action: true })
                }
            }
            return adaptOutput.call(instance, after.reduce((prev, modifier) => modifier.call(instance, prev), currentState))
        }
        const interrupter = (...interruptions) => new Promise(resolve => {
            const systemInterruption = Symbol("System Interruption")
            const interruption = Symbol("User Interruption")
            const lastInterruption = (interruptions.length && instance.config.nodes.typeof(interruptions[interruptions.length - 1]) === InterruptGotoNode.type)
                ? interruptions[interruptions.length - 1] : interruption
            const resolveInterruption = ({ [lastInterruption]: returnVal }) => resolve(returnVal)
            instance.process[systemInterruption] = [interruption, resolveInterruption]
            instance.process[interruption] = instance.config.adapt.reduce((prev, adapter) => adapter.call(instance, prev), interruptions)
            interruptionStack.push(systemInterruption)
            interruptionResolve()
        })
        const interruptable = new Interruptable(executor(), interrupter)
        return interruptable
	}
}
export class SuperSmallStateMachineChain extends SuperSmallStateMachineCore {
	static closest(path, ...nodeTypes) { return instance => this._closest(instance, path, ...nodeTypes) }
	static changes(state, changes)     { return instance => this._changes(instance, state, changes) }
	static proceed(state, nodeInfo)    { return instance => this._proceed(instance, state, nodeInfo) }
	static perform(state, action)      { return instance => this._perform(instance, state, action) }
	static execute(state, node)        { return instance => this._execute(instance, state, node) }
	static traverse(iterator)          { return instance => this._traverse(instance, iterator) }
	static run(...input)               { return instance => this._run(instance, ...input) }
	static do(process = null)                    { return instance => ({ process: instance.config.adapt.reduce((prev, modifier) => modifier.call(instance, prev), process), config: instance.config }) }
	static defaults(defaults = S.config.defaults){ return instance => ({ process: instance.process, config: { ...instance.config, defaults }, }) }
	static input(input = S.config.input)         { return instance => ({ process: instance.process, config: { ...instance.config, input }, }) }
	static output(output = S.config.output)      { return instance => ({ process: instance.process, config: { ...instance.config, output }, }) }
	static untrace                                (instance) { return ({ process: instance.process, config: { ...instance.config, trace: false }, }) }
	static trace                                  (instance) { return ({ process: instance.process, config: { ...instance.config, trace: true }, }) }
	static shallow                                (instance) { return ({ process: instance.process, config: { ...instance.config, deep: false }, }) }
	static deep                                   (instance) { return ({ process: instance.process, config: { ...instance.config, deep: true }, }) }
	static unstrict                               (instance) { return ({ process: instance.process, config: { ...instance.config, strict: false }, }) }
	static strict                                 (instance) { return ({ process: instance.process, config: { ...instance.config, strict: true }, }) }
	static strictTypes                            (instance) { return ({ process: instance.process, config: { ...instance.config, strict: StrictTypes }, }) }
	static for(iterations = S.config.iterations) { return instance => ({ process: instance.process, config: { ...instance.config, iterations }, }) }
	static until(until = S.config.until)         { return instance => ({ process: instance.process, config: { ...instance.config, until }, }) }
	static forever                                (instance) { return ({ process: instance.process, config: { ...instance.config, iterations: Infinity }, }) }
	static override(override = S.config.override){ return instance => ({ process: instance.process, config: { ...instance.config, override } }) }
	static addNode(...nodes)                     { return instance => ({ process: instance.process, config: { ...instance.config, nodes: new Nodes(...instance.config.nodes.values(),...nodes) }, }) }
	static adapt(...adapters)                    { return instance => ({ process: adapters.reduce((prev, adapter) => adapter.call(instance, prev), instance.process), config: { ...instance.config, adapt: [ ...instance.config.adapt, ...adapters ] }, }) }
	static before(...adapters)                   { return instance => ({ process: instance.process, config: { ...instance.config, before: [ ...instance.config.before, ...adapters ] }, }) }
	static after(...adapters)                    { return instance => ({ process: instance.process, config: { ...instance.config, after: [ ...instance.config.after, ...adapters ] }, }) }
	static with(...adapters) {
		const flatAdapters = adapters.flat(Infinity)
		return instance => {
			const adapted = flatAdapters.reduce((prev, adapter) => adapter.call(instance, prev), instance)
			return adapted instanceof S ? adapted : new S(adapted.process, adapted.config)
		}
	}
}
export default class S extends SuperSmallStateMachineChain {
	process = null
	#config = S.config
	get config() { return { ...this.#config } }
	constructor(process = null, config = S.config) {
		super((...input) => (config.override || this.run).apply(this, input))
		this.#config = { ...this.#config, ...config }
		this.process = process
	}
	closest(path, ...nodeTypes) { return S._closest(this, path, ...nodeTypes) }
	changes(state, changes) { return S._changes(this, state, changes) }
	proceed(state, nodeInfo){ return S._proceed(this, state, nodeInfo) }
	perform(state, action)  { return S._perform(this, state, action) }
	execute(state, node)    { return S._execute(this, state, node) }
	traverse(iterator)      { return S._traverse(this, iterator) }
	run     (...input)      { return S._run(this, ...input) }
	do(process)             { return this.with(S.do(process)) }
	defaults(defaults)      { return this.with(S.defaults(defaults)) }
	input(input)            { return this.with(S.input(input)) }
	output(output)          { return this.with(S.output(output)) }
	get untrace()           { return this.with(S.untrace) }
	get trace()             { return this.with(S.trace) }
	get shallow()           { return this.with(S.shallow) }
	get deep()              { return this.with(S.deep) }
	get unstrict()          { return this.with(S.unstrict) }
	get strict()            { return this.with(S.strict) }
	get strictTypes()       { return this.with(S.strictTypes) }
	for(iterations)         { return this.with(S.for(iterations)) }
	until(until)            { return this.with(S.until(until)) }
	get forever()           { return this.with(S.forever) }
	override(override)      { return this.with(S.override(override)) }
	addNode(...nodes)       { return this.with(S.addNode(...nodes)) }
	adapt(...adapters)      { return this.with(S.adapt(...adapters)) }
	before(...adapters)     { return this.with(S.before(...adapters)) }
	after(...adapters)      { return this.with(S.after(...adapters)) }
	with(...transformers)   { return S.with(...transformers)(this) }
}
export const StateMachine = S
export const SuperSmallStateMachine = S
export const NodeDefinition = Node
export const NodeDefinitions = Nodes
