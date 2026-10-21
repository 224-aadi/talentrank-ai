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
