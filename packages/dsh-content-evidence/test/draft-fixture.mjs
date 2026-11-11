export function draftInput(evidence, target, body, claimIds = []) {
  return { body, claimIds, expectedRevision: evidence.drafts[target]?.revision ?? 0, evidenceHash: evidence.evidenceHash }
}
