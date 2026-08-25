import type { CandidateAsset, ReviewEvent, ReviewState } from "./model.js";

export function deriveReviewState(candidate: CandidateAsset, events: ReviewEvent[]): ReviewState {
  let state: ReviewState = candidate.initialState;
  const ordered = [...events].sort((left, right) => left.sequence - right.sequence);

  ordered.forEach((event, index) => {
    if (event.candidateAssetId !== candidate.id) throw new Error("review event references another candidate");
    if (event.sequence !== index + 1) throw new Error("review event sequence must be contiguous and start at 1");

    if (event.action === "approve") {
      if (state !== "candidate") throw new Error(`cannot approve a candidate in ${state} state`);
      if (!event.validationReportId) throw new Error("approval requires a validation report");
      state = "approved";
      return;
    }
    if (event.action === "reject") {
      if (state !== "candidate") throw new Error(`cannot reject a candidate in ${state} state`);
      state = "rejected";
      return;
    }
    if (event.action === "supersede") {
      if (state !== "candidate" && state !== "approved") {
        throw new Error(`cannot supersede a candidate in ${state} state`);
      }
      if (!event.replacementCandidateAssetId) throw new Error("supersession requires a replacement candidate");
      state = "superseded";
    }
  });

  return state;
}

export function assertProductionExportEligible(
  candidate: CandidateAsset,
  state: ReviewState,
  compatibilityOutcome: "pass" | "fail" | "unverified" | "not-applicable",
): void {
  if (state !== "approved") throw new Error("only an approved candidate can be considered for production export");
  if (candidate.identity.characterId.startsWith("TEST_") || candidate.identity.canonStatus === "non-canon") {
    throw new Error("TEST_ and non-canon assets are blocked from production/canon export");
  }
  if (compatibilityOutcome !== "pass") {
    throw new Error("production export requires explicitly passing compatibility validation");
  }
}
