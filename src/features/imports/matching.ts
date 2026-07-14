import type {
  CnpjMatch,
  CnpjSourceEntry,
  CourierAggregate,
} from "@/features/imports/types";
import {
  nameSimilarity,
  significantNameTokens,
} from "@/features/imports/normalization";

interface Candidate {
  normalizedName: string;
  cnpj: string;
  sourceName: string;
  sourceKeys: string[];
  tokens: string[];
  tokenSet: Set<string>;
}

function buildCandidates(entries: CnpjSourceEntry[]): Candidate[] {
  const groups = new Map<string, Candidate>();
  for (const entry of entries) {
    const key = `${entry.normalizedName}\u0000${entry.cnpj}`;
    const existing = groups.get(key);
    if (existing) {
      existing.sourceKeys.push(entry.sourceKey);
      continue;
    }
    const tokens = significantNameTokens(entry.normalizedName);
    groups.set(key, {
      normalizedName: entry.normalizedName,
      cnpj: entry.cnpj,
      sourceName: entry.sourceName,
      sourceKeys: [entry.sourceKey],
      tokens,
      tokenSet: new Set(tokens),
    });
  }
  return [...groups.values()];
}

function allowsConservativeFuzzy(
  leftTokens: string[],
  leftSet: Set<string>,
  rightTokens: string[],
  rightSet: Set<string>,
): boolean {
  if (leftTokens.length < 2 || rightTokens.length < 2) return false;

  const sameFirst = leftTokens[0] === rightTokens[0];
  const sameLast = leftTokens.at(-1) === rightTokens.at(-1);
  if (sameFirst && sameLast) return true;
  let intersection = 0;
  for (const token of leftSet) if (rightSet.has(token)) intersection += 1;
  return intersection / Math.max(leftSet.size, rightSet.size) >= 0.75;
}

export function matchCouriersToCnpj(
  couriers: CourierAggregate[],
  entries: CnpjSourceEntry[],
): Map<string, CnpjMatch> {
  const candidates = buildCandidates(entries);
  const byName = new Map<string, Candidate[]>();
  for (const candidate of candidates) {
    const values = byName.get(candidate.normalizedName) ?? [];
    values.push(candidate);
    byName.set(candidate.normalizedName, values);
  }

  const result = new Map<string, CnpjMatch>();

  for (const courier of couriers) {
    const exactCandidates = byName.get(courier.normalizedName) ?? [];
    const exactDocuments = new Set(exactCandidates.map((candidate) => candidate.cnpj));

    if (exactDocuments.size === 1) {
      const chosen = exactCandidates[0];
      result.set(courier.externalCourierId, {
        externalCourierId: courier.externalCourierId,
        kind: "EXACT",
        score: 1,
        cnpj: chosen.cnpj,
        sourceName: chosen.sourceName,
        sourceKeys: exactCandidates.flatMap((candidate) => candidate.sourceKeys),
      });
      continue;
    }

    if (exactDocuments.size > 1) {
      result.set(courier.externalCourierId, {
        externalCourierId: courier.externalCourierId,
        kind: "AMBIGUOUS",
        score: 1,
        cnpj: null,
        sourceName: null,
        sourceKeys: exactCandidates.flatMap((candidate) => candidate.sourceKeys),
      });
      continue;
    }

    const courierTokens = significantNameTokens(courier.normalizedName);
    const courierTokenSet = new Set(courierTokens);
    const scored = candidates
      .filter((candidate) =>
        allowsConservativeFuzzy(courierTokens, courierTokenSet, candidate.tokens, candidate.tokenSet),
      )
      .map((candidate) => ({
        candidate,
        score: nameSimilarity(courier.normalizedName, candidate.normalizedName),
      }))
      .sort((left, right) => right.score - left.score);

    const best = scored[0];
    const second = scored.find(
      ({ candidate }) => !best || candidate.cnpj !== best.candidate.cnpj,
    );
    const margin = best ? best.score - (second?.score ?? 0) : 0;

    if (best && best.score >= 0.94 && margin >= 0.04) {
      const equivalent = scored.filter(
        ({ candidate, score }) =>
          candidate.cnpj === best.candidate.cnpj && Math.abs(score - best.score) < 0.0001,
      );
      result.set(courier.externalCourierId, {
        externalCourierId: courier.externalCourierId,
        kind: "FUZZY",
        score: best.score,
        cnpj: best.candidate.cnpj,
        sourceName: best.candidate.sourceName,
        sourceKeys: equivalent.flatMap(({ candidate }) => candidate.sourceKeys),
      });
      continue;
    }

    result.set(courier.externalCourierId, {
      externalCourierId: courier.externalCourierId,
      kind: best && best.score >= 0.86 ? "AMBIGUOUS" : "NOT_FOUND",
      score: best?.score ?? null,
      cnpj: null,
      sourceName: null,
      sourceKeys: best ? best.candidate.sourceKeys : [],
    });
  }

  // A document proposed for more than one courier is never accepted automatically.
  const proposalsByCnpj = new Map<string, CnpjMatch[]>();
  for (const match of result.values()) {
    if (!match.cnpj) continue;
    const proposals = proposalsByCnpj.get(match.cnpj) ?? [];
    proposals.push(match);
    proposalsByCnpj.set(match.cnpj, proposals);
  }
  for (const proposals of proposalsByCnpj.values()) {
    if (proposals.length < 2) continue;
    for (const proposal of proposals) {
      result.set(proposal.externalCourierId, {
        ...proposal,
        kind: "AMBIGUOUS",
        cnpj: null,
        sourceName: null,
      });
    }
  }

  return result;
}
