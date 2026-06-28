// Re-export the verified tournament data with TypeScript types.
// The source JS files are never modified — Node requires them as CJS.
export {
  TEAMS, GROUPS, GROUP_LETTERS, HOSTS, BRACKET, THIRD_SLOTS,
  THIRD_COMBO_HDR, THIRD_COMBINATIONS, ROUND_META,
} from '../../public/shared/data.js'
