export function messageIdentity(agent: string | undefined, model: string, demo: boolean) {
  if (demo) return []
  return [agent ? agent[0]?.toUpperCase() + agent.slice(1) : "", model].filter(Boolean)
}
