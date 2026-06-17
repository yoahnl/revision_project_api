import {
  RICH_CLOSED_CALCULATION_INVALID,
  evaluateRichClosedCalculationMcq,
} from './rich-closed-question-calculation';

describe('evaluateRichClosedCalculationMcq', () => {
  it('calculates odd and even absolute majority thresholds', () => {
    const result = evaluateRichClosedCalculationMcq({
      mode: 'absolute_majority_threshold',
      validVotes: 577,
    });

    expect(result.expectedValue).toBe(289);
    expect(result.workedSteps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'threshold', value: 289 }),
      ]),
    );

    expect(
      evaluateRichClosedCalculationMcq({
        mode: 'absolute_majority_threshold',
        validVotes: 100,
      }).expectedValue,
    ).toBe(51);
  });

  it('calculates target seats with Hare largest remainder using integer remainders', () => {
    const result = evaluateRichClosedCalculationMcq({
      mode: 'largest_remainder_target_party_seats',
      totalSeats: 10,
      targetPartyId: 'party-a',
      parties: [
        { id: 'party-a', label: 'Liste A', votes: 4300 },
        { id: 'party-b', label: 'Liste B', votes: 3100 },
        { id: 'party-c', label: 'Liste C', votes: 1600 },
        { id: 'party-d', label: 'Liste D', votes: 1000 },
      ],
    });

    expect(result.expectedValue).toBe(4);
    expect(result.workedSteps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'total-votes', value: 10000 }),
        expect.objectContaining({ id: 'target-result', value: 4 }),
      ]),
    );
  });

  it('rejects remainder ties that cross the awarded-seat boundary', () => {
    expect(() =>
      evaluateRichClosedCalculationMcq({
        mode: 'largest_remainder_target_party_seats',
        totalSeats: 2,
        targetPartyId: 'party-a',
        parties: [
          { id: 'party-a', label: 'Liste A', votes: 100 },
          { id: 'party-b', label: 'Liste B', votes: 100 },
          { id: 'party-c', label: 'Liste C', votes: 100 },
        ],
      }),
    ).toThrow(RICH_CLOSED_CALCULATION_INVALID);
  });

  it('handles party ids containing separators without tuple flattening', () => {
    const result = evaluateRichClosedCalculationMcq({
      mode: 'largest_remainder_target_party_seats',
      totalSeats: 5,
      targetPartyId: 'party:a',
      parties: [
        { id: 'party:a', label: 'Liste A', votes: 450 },
        { id: 'party:a:b', label: 'Liste AB', votes: 310 },
        { id: 'party:c', label: 'Liste C', votes: 240 },
      ],
    });

    expect(result.expectedValue).toBe(2);
  });
});
