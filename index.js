const clone_object = (obj) => {
    if (Array.isArray(obj))
        return obj.map(clone_object)
    if (obj === null) return null
    if (typeof obj !== 'object')
        return obj
    return Object.fromEntries(Object.entries(obj).map(([key,value]) => [
        key, clone_object(value)
    ]));
}
const unique_list_strings = (list, getId = item => item) => Object.values(Object.fromEntries(list.map(item=>[getId(item),item])));
const reduce_get_path_object = (obj, step) => obj[step]
const get_path_object = (object, path) => path.reduce(reduce_get_path_object, object)
const normalise_function = functOrReturn => (typeof functOrReturn === 'function') ? functOrReturn : () => functOrReturn
const reduce_deep_merge_object = (base, override) => {
    if (!((base && typeof base === 'object') && !Array.isArray(base) && (override && typeof override === 'object') && !Array.isArray(override)))
        return override;
    const allKeys = unique_list_strings(Object.keys(base).concat(Object.keys(override)));
    return Object.fromEntries(allKeys.map(key => [
        key, key in override ? deep_merge_object(base[key], override[key]) : base[key]
    ]));
}
const deep_merge_object = (base, ...overrides) => overrides.reduce(reduce_deep_merge_object, base)

class GoToReferenceError extends ReferenceError {}
class GoToTypeError extends ReferenceError {}
class ContextReferenceError extends ReferenceError {}

export default class S {
    static return = Symbol('Small State Machine Return')
    static goto = Symbol('Small State Machine Go-To')
    static path = Symbol('Small State Machine Path')
    static kw = {
        IF: 'if',
        TN: 'then',
        EL: 'else',
        SW: 'switch',
        CS: 'case',
        DF: 'default',
        IT: 'initial',
        RS: 'result',
    }
    static keywords = S.kw
    static runConfig = {
        iterations: 10000,
        result: true,
        until: result => S.return in result,
        inputModifier: a => a,
        outputModifier: a => a,

        // Timing settings for async
        delay: 0,
        allow: 1000,
        wait: 0,
    }

    static lastArray(sequence, path) {
        const item = get_path_object(sequence, path)
        if (Array.isArray(item)) return path
        if (path.length === 0) return null
        return this.lastArray(sequence, path.slice(0,-1))
    }
    static lastMachine(sequence, path) {
        const item = get_path_object(sequence, path)
        if (item && typeof item === 'object' && (this.kw.IT in item)) return path
        if (path.length === 0) return null
        return this.lastMachine(sequence, path.slice(0,-1))
    }
    static nextPath(sequence, path) {
        const childItem = path[path.length-1]
        const parentPath = path.slice(0,-1)
        const parActs = get_path_object(sequence, parentPath)
        const acts = get_path_object(sequence, path)
        if (Array.isArray(acts) && acts.length !== 0)
            return [ ...path, 0 ]
        if (Array.isArray(parActs) && childItem+1 < parActs.length)
            return [ ...parentPath, childItem+1 ]
        if (parentPath.length === 0)
            return null
        // TODO: use lastArray instead
        const lastNumber = parentPath.findLastIndex(p => typeof p === 'number')
        return parentPath.slice(0, lastNumber).concat([parentPath[lastNumber]+1])
    }
    static execute(state, method, path) {
        switch (typeof method) {
            case 'number':
            case 'string':
                return { [S.goto]: method }
            case 'object': {
                if (!method) break;
                if (Array.isArray(method)) {
                    return { [S.goto]: [...path,0] }
                }
                if (S.kw.IF in method) {
                    if (normalise_function(method[S.kw.IF])(state))
                        return { [S.goto]: [...path,S.kw.TN] }
                    else return { [S.goto]: [...path,S.kw.EL] }
                }
                if (S.kw.SW in method) {
                    const key = normalise_function(method[S.kw.SW])(state)
                    const fallbackKey = key in (method[S.kw.CS]) ? key : S.kw.DF
                    return { [S.goto]: [...path,S.kw.CS,fallbackKey] }
                }
                if (S.kw.IT in method) {
                    return { [S.goto]: [...path,S.kw.IT] }
                }
                break;
            }
            case 'function': {
                const output = method(state)
                switch (typeof output) {
                    case 'number':
                    case 'string':
                        return { [S.goto]: output }
                    case 'object': {
                        if (!output) break;
                        if (Array.isArray(output))
                            return { [S.goto]: output }

                        if (S.return in output || S.goto in output)
                            return output
                        const newState = S.applyChanges(state, output)
                        return newState
                    }
                    case 'symbol': {
                        switch (output) {
                            case S.return:
                                return { [S.return]: state.result }
                        }
                        break;
                    }
                }
                break;
            }
            case 'symbol': {
                switch (method) {
                    case S.return:
                        return { [S.return]: state.result }
                }
            }
        }
    }
    static advance(state, process, path, output) {
        let currentState = state
        if (output) {
            if (S.return in output)
                return {
                    ...currentState,
                    [S.return]: true,
                    [S.kw.RS]: output[S.return],
                    [S.path]: path
                }
            if (S.goto in output) {
                const goto = output[S.goto]
                if (Array.isArray(goto))
                    return {
                        ...currentState,
                        [S.path]: goto
                    }
                const gotoType = typeof goto
                switch (gotoType) {
                    case 'number':{
                        const lastArray = S.lastArray(process, path.slice(0,-1))
                        if (!lastArray)
                            throw new GoToReferenceError(`A relative goto has been provided as a number (${goto}), but no list exists that this number could be an index of.`)
                        return {
                            ...currentState,
                            [S.path]: [...lastArray, goto]
                        }
                    }
                    case 'string':{
                        const lastMachine = S.lastMachine(process, path.slice(0,-1))
                        if (!lastMachine)
                            throw new GoToReferenceError(`A relative goto has been provided as a string (${goto}), but no state machine exists that this string could be a state of.`)
                        return {
                            ...currentState,
                            [S.path]: [...lastMachine, goto]
                        }
                    }
                    default:
                        throw new GoToTypeError(`A relative goto has been provided as a ${gotoType}, only strings and numbers are acceptable.`)
                }
            }

            currentState = output
        }

        const nextPath = S.nextPath(process, path)
        if (! nextPath)
            return {
                ...currentState,
                [S.return]: true,
            }
        return {
            ...currentState,
            [S.path]: nextPath
        }
    }
    static executeAdvance(state, process, path) {
        const method = get_path_object(process, path)
        const output = S.execute(state, method, path)
        return this.advance(state, process, path, output)
    }
    static applyChanges(state, changes) {
        const invalidChanges = Object.entries(changes).find(([name]) => !(name in state))
        if (invalidChanges)
            throw new ContextReferenceError(`Only properties that exist on the initial context may be updated.\nYou changed '${invalidChanges[0]}', which is not one of: ${Object.keys(state).join(', ')}`)
        return deep_merge_object(state, changes)
    }
    // TODO: async
    constructor({ ...state } = {}, process, runConfig = S.runConfig) {
        const defaultRunConfig = deep_merge_object(S.runConfig, runConfig)
        const initialState = deep_merge_object({
            [S.kw.RS]: null
        }, state)
        const exec = (input = {}, runConfig = defaultRunConfig) => {
            const { until, result, iterations, inputModifier, outputModifier } = deep_merge_object(defaultRunConfig, runConfig)

            const modifiedInput = inputModifier(input) || {}
            const { [S.path]: path = [], ...pureInput } = modifiedInput

            let currentPath = path
            let currentState = S.applyChanges(initialState, pureInput)
            let r = 0
            while (r < iterations) {
                if (until(currentState))
                    break;
                r++
                currentState = S.executeAdvance(currentState, process, currentPath)
                currentPath = currentState[S.path]
            }
            return outputModifier(result ? currentState[S.kw.RS] : currentState)
        }
        return new Proxy(() => {}, {
            apply(target, thisArg, argumentsList) {
                return exec(...argumentsList)
            },
            get(target, name) {
                switch (name) {
                    case 'input':
                        return inputModifier => new S(initialState, process, {
                            ...defaultRunConfig,
                            inputModifier: input => inputModifier(defaultRunConfig.inputModifier(input))
                        })
                    case 'output':
                        return outputModifier => new S(initialState, process, {
                            ...defaultRunConfig,
                            outputModifier: output => outputModifier(defaultRunConfig.outputModifier(output))
                        })
                    case 'step':
                        return new S(state, process, { iterations: 1, result: false })
                    case 'actionName':
                        return path => {
                            const method = get_path_object(process, path)
                            return method && method.name
                        }
                    default:
                        return target[name]
                }
            }
        })
    }
}

export const SuperSmallStateMachine = S
