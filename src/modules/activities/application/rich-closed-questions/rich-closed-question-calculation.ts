import type {
  RichClosedCalculationData,
  RichClosedCalculationWorkedStep,
  RichClosedLargestRemainderTargetPartySeatsCalculation,
} from './rich-closed-question.types';

export const RICH_CLOSED_CALCULATION_INVALID =
  'RICH_CLOSED_CALCULATION_INVALID';

export interface RichClosedCalculationEvaluation {
  expectedValue: number;
  workedSteps: RichClosedCalculationWorkedStep[];
}

export function evaluateRichClosedCalculationMcq(
  calculation: RichClosedCalculationData,
): RichClosedCalculationEvaluation {
  switch (calculation.mode) {
    case 'absolute_majority_threshold':
      return evaluateAbsoluteMajorityThreshold(calculation.validVotes);
    case 'largest_remainder_target_party_seats':
      return evaluateLargestRemainderTargetPartySeats(calculation);
  }
}

function evaluateAbsoluteMajorityThreshold(
  validVotes: number,
): RichClosedCalculationEvaluation {
  const expectedValue = Math.floor(validVotes / 2) + 1;

  return {
    expectedValue,
    workedSteps: [
      {
        id: 'valid-votes',
        label: 'Suffrages exprimés',
        detail: `Suffrages exprimés : ${validVotes}.`,
        value: validVotes,
      },
      {
        id: 'majority-rule',
        label: 'Majorité absolue',
        detail: `Majorité absolue : partie entière de ${validVotes} / 2, puis + 1.`,
      },
      {
        id: 'threshold',
        label: 'Seuil attendu',
        detail: `Seuil attendu : ${expectedValue}.`,
        value: expectedValue,
      },
    ],
  };
}

function evaluateLargestRemainderTargetPartySeats(
  calculation: RichClosedLargestRemainderTargetPartySeatsCalculation,
): RichClosedCalculationEvaluation {
  const totalVotes = calculation.parties.reduce(
    (sum, party) => sum + party.votes,
    0,
  );

  if (totalVotes <= 0) {
    throw new Error(RICH_CLOSED_CALCULATION_INVALID);
  }

  const allocations = calculation.parties.map((party) => {
    const weightedVotes = party.votes * calculation.totalSeats;
    const initialSeats = Math.floor(weightedVotes / totalVotes);

    return {
      party,
      initialSeats,
      remainderNumerator: weightedVotes - initialSeats * totalVotes,
      extraSeat: 0,
    };
  });
  const allocatedSeats = allocations.reduce(
    (sum, allocation) => sum + allocation.initialSeats,
    0,
  );
  const remainingSeats = calculation.totalSeats - allocatedSeats;
  const byRemainder = [...allocations].sort((left, right) => {
    const remainderDelta = right.remainderNumerator - left.remainderNumerator;

    if (remainderDelta !== 0) {
      return remainderDelta;
    }

    return left.party.id.localeCompare(right.party.id);
  });

  // V1-021 rejects ties only when the tie crosses the last awarded seat.
  // Ties fully inside or outside the awarded block do not change the result.
  if (
    remainingSeats > 0 &&
    remainingSeats < byRemainder.length &&
    byRemainder[remainingSeats - 1].remainderNumerator ===
      byRemainder[remainingSeats].remainderNumerator
  ) {
    throw new Error(RICH_CLOSED_CALCULATION_INVALID);
  }

  for (let index = 0; index < remainingSeats; index += 1) {
    byRemainder[index].extraSeat = 1;
  }

  const targetAllocation = allocations.find(
    (allocation) => allocation.party.id === calculation.targetPartyId,
  );

  if (!targetAllocation) {
    throw new Error(RICH_CLOSED_CALCULATION_INVALID);
  }

  const expectedValue =
    targetAllocation.initialSeats + targetAllocation.extraSeat;
  const targetPartyLabel = targetAllocation.party.label;

  return {
    expectedValue,
    workedSteps: [
      {
        id: 'total-votes',
        label: 'Total des voix',
        detail: `Total des voix : ${totalVotes}.`,
        value: totalVotes,
      },
      {
        id: 'total-seats',
        label: 'Nombre de sièges',
        detail: `Nombre de sièges à répartir : ${calculation.totalSeats}.`,
        value: calculation.totalSeats,
      },
      {
        id: 'hare-quota',
        label: 'Quota de Hare',
        detail: `Quota de Hare : ${totalVotes} / ${calculation.totalSeats}.`,
      },
      {
        id: 'initial-allocation',
        label: 'Attribution initiale',
        detail: allocations
          .map(
            (allocation) =>
              `${allocation.party.label} : ${allocation.initialSeats}`,
          )
          .join(' ; '),
      },
      {
        id: 'remaining-seats',
        label: 'Plus forts restes',
        detail: `Sièges restants attribués aux plus forts restes : ${remainingSeats}.`,
        value: remainingSeats,
      },
      {
        id: 'target-result',
        label: `Résultat pour ${targetPartyLabel}`,
        detail: `${targetPartyLabel} obtient ${expectedValue} siège${
          expectedValue > 1 ? 's' : ''
        }.`,
        value: expectedValue,
      },
    ],
  };
}
