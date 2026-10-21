/** Export ranks must describe fit, not the order files happened to upload. */
export function rankExportCandidates<T extends { candidate: { id: string; name: string } }>(
  rows: T[],
  matches: ReadonlyMap<string, { score: number; confidence: number }>,
): T[] {
  return [...rows].sort((left, right) => {
    const a = matches.get(left.candidate.id);
    const b = matches.get(right.candidate.id);
    return (b?.score ?? -1) - (a?.score ?? -1)
      || (b?.confidence ?? -1) - (a?.confidence ?? -1)
      || left.candidate.name.localeCompare(right.candidate.name)
      || left.candidate.id.localeCompare(right.candidate.id);
  });
}

export function decisionsForExport<T extends { candidateId: string; jobId: string }>(
  matches: ReadonlyMap<string, { jobId: string }>,
  newestFirst: T[],
): Map<string, T> {
  const selected = new Map<string, T>();
  for (const decision of newestFirst) {
    if (!selected.has(decision.candidateId) && matches.get(decision.candidateId)?.jobId === decision.jobId) {
      selected.set(decision.candidateId, decision);
    }
  }
  return selected;
}
