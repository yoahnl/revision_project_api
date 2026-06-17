import { evaluateRichClosedExerciseQuality } from './rich-closed-question-quality-gate';
import {
  richClosedExerciseFixture,
  richClosedQuestionFixture,
} from './rich-closed-question.fixtures';
import { toRichClosedPublicExercise } from './rich-closed-question-public.mapper';

describe('rich closed question quality gate', () => {
  it('accepts a rich V1-A exercise and exposes deterministic metrics', () => {
    const exercise = richClosedExerciseFixture();

    const result = evaluateRichClosedExerciseQuality(exercise, {
      knownSourceChunkIds: ['chunk-1', 'chunk-2', 'chunk-3'],
      publicExercise: toRichClosedPublicExercise(exercise),
    });

    expect(result.accepted).toBe(true);
    expect(result.issues).toEqual([]);
    expect(result.metrics).toMatchObject({
      questionCount: 6,
      distinctQuestionKindCount: 6,
      advancedQuestionCount: 6,
      basicQuestionCount: 0,
      sourcedQuestionCount: 6,
      qualityGateStatus: 'accepted',
    });
    expect(result.metrics.questionKindCounts).toMatchObject({
      single_choice: 1,
      multiple_choice: 1,
      matching: 1,
      ordering: 1,
      case_qualification: 1,
      error_detection: 1,
    });
  });

  it('rejects a six-question exercise made only of single choice questions', () => {
    const exercise = {
      ...richClosedExerciseFixture(),
      questions: Array.from({ length: 6 }, (_value, index) => ({
        ...richClosedQuestionFixture('single_choice'),
        id: `single-${index + 1}`,
        prompt: `Question de choix unique ${index + 1}`,
      })),
    };

    const result = evaluateRichClosedExerciseQuality(exercise);

    expect(result.accepted).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'RICH_CLOSED_GATE_NOT_ENOUGH_KIND_DIVERSITY',
        }),
        expect.objectContaining({
          code: 'RICH_CLOSED_GATE_TOO_MANY_SINGLE_CHOICE',
        }),
      ]),
    );
  });

  it('rejects a six-question exercise without case qualification', () => {
    const exercise = {
      ...richClosedExerciseFixture(),
      questions: [
        richClosedQuestionFixture('single_choice'),
        richClosedQuestionFixture('multiple_choice'),
        richClosedQuestionFixture('matching'),
        richClosedQuestionFixture('ordering'),
        richClosedQuestionFixture('error_detection'),
        { ...richClosedQuestionFixture('matching'), id: 'matching-extra' },
      ],
    };

    const result = evaluateRichClosedExerciseQuality(exercise);

    expect(result.accepted).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: 'RICH_CLOSED_GATE_CASE_QUALIFICATION_REQUIRED',
      }),
    );
  });

  it('rejects a six-question exercise without error detection', () => {
    const exercise = {
      ...richClosedExerciseFixture(),
      questions: [
        richClosedQuestionFixture('single_choice'),
        richClosedQuestionFixture('multiple_choice'),
        richClosedQuestionFixture('matching'),
        richClosedQuestionFixture('ordering'),
        richClosedQuestionFixture('case_qualification'),
        { ...richClosedQuestionFixture('ordering'), id: 'ordering-extra' },
      ],
    };

    const result = evaluateRichClosedExerciseQuality(exercise);

    expect(result.accepted).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: 'RICH_CLOSED_GATE_ERROR_DETECTION_REQUIRED',
      }),
    );
  });

  it('rejects unknown sources', () => {
    const exercise = {
      ...richClosedExerciseFixture(),
      questions: [
        {
          ...richClosedQuestionFixture('single_choice'),
          sourceChunkIds: ['chunk-unknown'],
        },
        ...richClosedExerciseFixture().questions.slice(1),
      ],
    };

    const result = evaluateRichClosedExerciseQuality(exercise, {
      knownSourceChunkIds: ['chunk-1', 'chunk-2', 'chunk-3'],
    });

    expect(result.accepted).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: 'RICH_CLOSED_SOURCE_UNKNOWN' }),
    );
  });

  it('rejects an insufficient sourced ratio when source context is known', () => {
    const exercise = {
      ...richClosedExerciseFixture(),
      questions: richClosedExerciseFixture().questions.map((question, index) =>
        index < 2 ? question : { ...question, sourceChunkIds: [] },
      ),
    };

    const result = evaluateRichClosedExerciseQuality(exercise, {
      knownSourceChunkIds: ['chunk-1', 'chunk-2', 'chunk-3'],
    });

    expect(result.accepted).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: 'RICH_CLOSED_GATE_NOT_ENOUGH_SOURCED_QUESTIONS',
      }),
    );
  });

  it('rejects excessive basic prompts while keeping the heuristic bounded', () => {
    const exercise = {
      ...richClosedExerciseFixture(),
      questions: richClosedExerciseFixture().questions.map(
        (question, index) => ({
          ...question,
          prompt:
            index < 4
              ? `Qui est associé à la notion ${index + 1} ?`
              : question.prompt,
        }),
      ),
    };

    const result = evaluateRichClosedExerciseQuality(exercise);

    expect(result.accepted).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: 'RICH_CLOSED_GATE_TOO_MANY_BASIC_QUESTIONS',
      }),
    );
  });

  it('uses relaxed diversity rules for a small three-question exercise', () => {
    const exercise = {
      ...richClosedExerciseFixture(),
      questions: [
        richClosedQuestionFixture('single_choice'),
        richClosedQuestionFixture('multiple_choice'),
        richClosedQuestionFixture('case_qualification'),
      ],
    };

    const result = evaluateRichClosedExerciseQuality(exercise);

    expect(result.accepted).toBe(true);
    expect(result.warnings).toContainEqual(
      expect.objectContaining({
        code: 'RICH_CLOSED_GATE_SMALL_EXERCISE_RELAXED_RULES',
      }),
    );
  });

  it('rejects public pre-submit payloads that contain private correction fields', () => {
    const exercise = richClosedExerciseFixture();
    const publicExercise = {
      ...toRichClosedPublicExercise(exercise),
      questions: [
        {
          ...toRichClosedPublicExercise(exercise).questions[0],
          correctChoiceId: 'choice-a',
        },
      ],
    };

    const result = evaluateRichClosedExerciseQuality(exercise, {
      publicExercise,
    });

    expect(result.accepted).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: 'RICH_CLOSED_PUBLIC_CORRECTION_LEAK',
      }),
    );
  });

  it.each([
    ['feedback', 'Feedback pré-submit interdit'],
    ['choiceFeedback', 'Feedback de choix interdit'],
    ['modelAnswer', 'Réponse modèle interdite'],
    ['answerText', 'Réponse libre interdite'],
    ['expectedValue', 289],
    ['workedSteps', ['Étape révélatrice interdite']],
  ])('rejects public pre-submit payloads containing %s', (key, value) => {
    const exercise = richClosedExerciseFixture();
    const publicExercise = {
      ...toRichClosedPublicExercise(exercise),
      questions: [
        {
          ...toRichClosedPublicExercise(exercise).questions[0],
          metadata: {
            nested: {
              [key]: value,
            },
          },
        },
      ],
    };

    const result = evaluateRichClosedExerciseQuality(exercise, {
      publicExercise,
    });

    expect(result.accepted).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: 'RICH_CLOSED_PUBLIC_CORRECTION_LEAK',
      }),
    );
  });

  it.each([
    'html',
    'svg',
    'mermaid',
    'widget',
    'renderPayload',
    'imageUrl',
    'blob',
    'formula',
    'expression',
    'calculationCode',
    'script',
    'code',
  ])(
    'rejects public pre-submit payloads containing arbitrary render key %s',
    (key) => {
      const exercise = richClosedExerciseFixture();
      const publicExercise = {
        ...toRichClosedPublicExercise(exercise),
        questions: [
          {
            ...toRichClosedPublicExercise(exercise).questions[0],
            metadata: {
              nested: {
                [key]: '<unsafe>',
              },
            },
          },
        ],
      };

      const result = evaluateRichClosedExerciseQuality(exercise, {
        publicExercise,
      });

      expect(result.accepted).toBe(false);
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          code: 'RICH_CLOSED_PUBLIC_CORRECTION_LEAK',
        }),
      );
    },
  );

  it('detects basic definition prompts with or without accents', () => {
    const exercise = {
      ...richClosedExerciseFixture(),
      questions: richClosedExerciseFixture().questions.map(
        (question, index) => ({
          ...question,
          prompt:
            index < 2
              ? `Quelle est la définition de la notion ${index + 1} ?`
              : index < 4
                ? `Quelle est la definition de la notion ${index + 1} ?`
                : question.prompt,
        }),
      ),
    };

    const result = evaluateRichClosedExerciseQuality(exercise);

    expect(result.metrics.basicQuestionCount).toBe(4);
    expect(result.accepted).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: 'RICH_CLOSED_GATE_TOO_MANY_BASIC_QUESTIONS',
      }),
    );
  });
});
