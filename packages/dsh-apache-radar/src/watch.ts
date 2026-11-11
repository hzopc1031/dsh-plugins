export const DEFAULT_WATCH_LIST: readonly string[] = Object.freeze(['kafka', 'hadoop', 'flink'])

// Config order is display order; replacing the array adds, removes or reorders projects.
export function resolveWatchList(value: unknown = DEFAULT_WATCH_LIST): string[] {
  if (!Array.isArray(value)) throw new Error('watchList must be an array of Apache project ids')
  const result = value.map(id => {
    if (typeof id !== 'string' || !/^[a-z][a-z0-9-]*$/i.test(id.trim())) {
      throw new Error('Invalid watch-list project id')
    }
    return id.trim().toLowerCase()
  })
  if (new Set(result).size !== result.length) throw new Error('Duplicate watch-list project id')
  return result
}
