import S from './index.js'

export const actionMarker = Symbol('Super Small State Machine Action')
export const action = (name) => {
	return {
		[actionMarker]: true,
		name,
	}
}
export const a = action

export const conditionMarker = Symbol('Super Small State Machine Condition')
export const condition = (name) => {
	return {
		[conditionMarker]: true,
		name,
	}
}
export const c = condition

export const transitionMarker = Symbol('Super Small State Machine Transition')
export const transition = (name) => {
	return {
		[transitionMarker]: true,
		name,
	}
}
export const t = transition

const transformProcess = ({ actions, conditions, transitions }) =>  {
	const recur = S.traverse((item) => {
		if (item && typeof item === 'object'){
			let action;
			const name = item.name;
			if (item[actionMarker]) {
				action = actions[name]
			}
			else if (item[transitionMarker]) {
				action = transitions[name]
			}
			if (name && action) {
				const actionType = typeof action
				if (actionType === 'function')
					return action
				const processed = recur(action)
				if (typeof processed === 'object')
					processed.name = name
				return processed
			}
		}
		return item
	}, (conditional) => {
		if (typeof conditional === 'object') {
			if (S.kw.IF in conditional) {
				const conditionString = conditional[S.kw.IF]
				if (typeof conditionString === 'object' && conditionString[conditionMarker])
					return {
						...conditional,
						[S.kw.IF]: conditions[conditionString.name]
					}
			} else
			if (S.kw.SW in conditional) {
				const conditionString = conditional[S.kw.SW]
				if (typeof conditionString === 'object' && conditionString[conditionMarker])
					return {
						...conditional,
						[S.kw.SW]: conditions[conditionString.name]
					}
			}
		}
		return conditional
	})
	return recur
}

export default ({
	state: { actions = {}, conditions = {}, transitions = {}, ...state },
	process,
	runConfig
}) => ({
	state,
	process: transformProcess({ actions, conditions, transitions })(process),
	runConfig
})
