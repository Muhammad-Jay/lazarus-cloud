import type { CommandSuggestion, DocumentationSearchResult } from '@lazarus/contracts';

/**
 * Suggestion ranking, computed once.
 *
 * §4.4 asks for ordering suggestions by usefulness and §6.3 for search that can
 * find a documented command, a task or a concept. Both are ranking problems, and
 * both belong here rather than in a component: a client that ranks its own list
 * will rank it differently, and the difference is invisible until two surfaces
 * disagree.
 *
 * ## Determinism is a requirement
 *
 * The ranking is a pure function of its inputs, with no clock and no randomness,
 * so the same draft produces the same order on every client. An unstable sort here
 * would make suggestions reshuffle between renders for reasons the reader cannot
 * perceive — which reads as the product being broken rather than as jitter.
 *
 * Ties break on `kind`, then label, then the composed command line. All three are
 * stable inputs, so the sort is total and the output reproducible.
 *
 * ## This is discovery, not policy
 *
 * Ranking decides what is *easy* to reach. It never decides what is *permitted*:
 * §4.5 and ADR-0015 both say a documented command's presence is discovery
 * information and not authorisation, and every command still passes a
 * `PolicyEvaluator` at execution time. Nothing here can widen access, so a reader
 * who types something unlisted is not blocked — the ranking simply does not surface
 * it.
 */

/** Weights per suggestion kind, before any text match. */
const KIND_WEIGHT: Readonly<Record<CommandSuggestion['kind'], number>> = {
  documentedCommand: 0.4,
  executableName: 0.3,
  taskStep: 0.25,
  historyEntry: 0.15,
};

/** Tie-break order for equal scores. Lower sorts first. */
const KIND_ORDER: Readonly<Record<CommandSuggestion['kind'], number>> = {
  documentedCommand: 0,
  executableName: 1,
  taskStep: 2,
  historyEntry: 3,
};

/**
 * Score one candidate against the text the reader has typed.
 *
 * Returns `null` when nothing matched. A separate null rather than a low score,
 * because "matched nothing" is not a weak preference — it is not a suggestion at
 * all, and folding it into the score meant a candidate survived on its kind weight
 * alone. `ls` scored 0.1 and `curl` 0.075 against the query `zzzz`, both above the
 * cutoff, so typing nonsense still surfaced two commands.
 *
 * @param suggestion the candidate
 * @param typed lower-cased prefix, or empty when the draft is empty
 */
function scoreCandidate(suggestion: CommandSuggestion, typed: string): number | null {
  const base = KIND_WEIGHT[suggestion.kind];

  // An empty draft lists what is available rather than nothing (§4.4).
  if (typed.length === 0) {
    return Math.min(1, base);
  }

  const label = suggestion.label.toLowerCase();
  const executable = suggestion.draft?.executable.toLowerCase() ?? '';
  let score = base;

  if (label === typed) {
    score += 0.5;
  } else if (label.startsWith(typed)) {
    score += 0.3;
  } else if (label.includes(typed)) {
    score += 0.15;
  } else if (executable === typed) {
    score += 0.35;
  } else if (executable.startsWith(typed)) {
    score += 0.25;
  } else if (executable.includes(typed)) {
    score += 0.1;
  } else {
    return null;
  }

  return Math.max(0, Math.min(1, score));
}

/** The command a suggestion would compose, used only as a sort key. */
const commandLine = (suggestion: CommandSuggestion): string =>
  suggestion.draft === undefined
    ? ''
    : [
        suggestion.draft.executable,
        ...suggestion.draft.arguments.map((argument) => argument.value),
      ].join(' ');

/**
 * Rank suggestions for the current draft.
 *
 * @param candidates what the experience offers, in any order
 * @param typed what the reader has typed so far; empty to rank without a query
 * @returns a new array ordered best-first, each item carrying its `score`
 */
export function rankSuggestions(
  candidates: readonly CommandSuggestion[],
  typed: string,
): CommandSuggestion[] {
  const query = typed.trim().toLowerCase();

  return candidates
    .flatMap((suggestion) => {
      const score = scoreCandidate(suggestion, query);
      return score === null ? [] : [{ ...suggestion, score }];
    })
    .sort((left, right) => {
      const byScore = (right.score ?? 0) - (left.score ?? 0);
      if (byScore !== 0) {
        return byScore;
      }
      const byKind = KIND_ORDER[left.kind] - KIND_ORDER[right.kind];
      if (byKind !== 0) {
        return byKind;
      }
      const byLabel = left.label.localeCompare(right.label);
      if (byLabel !== 0) {
        return byLabel;
      }
      return commandLine(left).localeCompare(commandLine(right));
    });
}

/** How a search result may be ranked. Mirrors the scoring shape above. */
const SEARCH_KIND_WEIGHT: Readonly<Record<DocumentationSearchResult['kind'], number>> = {
  command: 0.4,
  document: 0.35,
  task: 0.3,
  concept: 0.2,
};

/** Tie-break order for equal search scores. Lower sorts first. */
const SEARCH_KIND_ORDER: Readonly<Record<DocumentationSearchResult['kind'], number>> = {
  command: 0,
  document: 1,
  task: 2,
  concept: 3,
};

/**
 * Rank documentation search results.
 *
 * §6.3 asks for search that finds a documented command, a task or a concept. A
 * command hit outranks a concept hit, because the reader searching mid-task is
 * most often looking for the command to run next.
 *
 * Results arriving without a `score` are scored here rather than trusted, so a
 * client cannot ship an unranked list to the reader. A supplied `score` is treated
 * as the backend's relevance and blended with the kind weight rather than
 * overwritten, so the backend's own ranking still counts.
 *
 * @param results what the backend returned
 * @param query what the reader typed
 * @returns a new array ordered best-first
 */
export function rankSearchResults(
  results: readonly DocumentationSearchResult[],
  query: string,
): DocumentationSearchResult[] {
  const needle = query.trim().toLowerCase();

  return results
    .map((result) => {
      const kindWeight = SEARCH_KIND_WEIGHT[result.kind];
      const text = `${result.ref.title ?? ''} ${result.excerpt ?? ''}`.toLowerCase();
      const supplied = result.score;

      let score = supplied * 0.6 + kindWeight * 0.4;
      if (needle.length > 0 && text.includes(needle)) {
        score = Math.min(1, score + 0.2);
      }

      return { ...result, score };
    })
    .sort((left, right) => {
      const byScore = right.score - left.score;
      if (byScore !== 0) {
        return byScore;
      }
      const byKind = SEARCH_KIND_ORDER[left.kind] - SEARCH_KIND_ORDER[right.kind];
      if (byKind !== 0) {
        return byKind;
      }
      const byTitle = (left.ref.title ?? '').localeCompare(right.ref.title ?? '');
      if (byTitle !== 0) {
        return byTitle;
      }
      return left.ref.documentId.localeCompare(right.ref.documentId);
    });
}
