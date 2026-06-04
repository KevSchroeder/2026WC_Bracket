// Re-export scoring engine with a clone-safe prune() wrapper.
// The original prune() mutates its argument — fine for the server,
// but React requires immutable state updates, so we always clone first.
import { prune as _prune } from '../../public/shared/engine.js'
import type { Picks } from '../types'

export {
  POINTS, TEAM_GROUP, BY_NUM, matchesOf,
  thirdAssignment, resolveRef, reachSets,
  scoreBracket, matchCorrectness, isComplete, knockoutDecided, cheekyMessage,
} from '../../public/shared/engine.js'

export function prune(picks: Picks): Picks {
  const cloned = JSON.parse(JSON.stringify(picks)) as Picks
  _prune(cloned)
  return cloned
}
