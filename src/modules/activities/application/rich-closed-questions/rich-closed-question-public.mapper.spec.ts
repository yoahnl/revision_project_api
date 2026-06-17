import {
  toRichClosedPublicExercise,
  toRichClosedPublicQuestion,
} from './rich-closed-question-public.mapper';
import {
  richClosedExerciseFixture,
  richClosedQuestionFixture,
  richClosedV1BExerciseFixture,
  richClosedV1BFullExerciseFixture,
  richClosedV1CCalculationExerciseFixture,
  richClosedV1CExerciseFixture,
  richClosedV1CFullExerciseFixture,
} from './rich-closed-question.fixtures';
import type { RichClosedCalculationMcqQuestion } from './rich-closed-question.types';

describe('rich closed question public mapper', () => {
  it.each([
    'single_choice',
    'multiple_choice',
    'matching',
    'ordering',
    'case_qualification',
    'error_detection',
    'timeline',
    'date_slider',
    'true_false_grid',
    'cause_consequence',
    'institution_matrix',
    'diagram_labeling',
    'calculation_mcq',
  ] as const)('maps %s without leaking correction fields', (questionKind) => {
    const publicQuestion = toRichClosedPublicQuestion(
      richClosedQuestionFixture(questionKind),
    );
    const serialized = JSON.stringify(publicQuestion);

    expect(publicQuestion.questionKind).toBe(questionKind);
    expect(serialized).not.toContain('correctChoiceId');
    expect(serialized).not.toContain('correctChoiceIds');
    expect(serialized).not.toContain('correctPairs');
    expect(serialized).not.toContain('correctOrder');
    expect(serialized).not.toContain('correctValues');
    expect(serialized).not.toContain('correctErrorId');
    expect(serialized).not.toContain('expectedValue');
    expect(serialized).not.toContain('workedSteps');
    expect(serialized).not.toContain('correctYear');
    expect(serialized).not.toContain('correctionPayload');
    expect(serialized).not.toContain('explanation');
    expect(serialized).not.toContain('rawSvg');
    expect(serialized).not.toContain('mermaid');
    expect(serialized).not.toContain('renderPayload');
  });

  it('maps a full exercise without leaking private correction data', () => {
    const publicExercise = toRichClosedPublicExercise(
      richClosedExerciseFixture(),
    );
    const serialized = JSON.stringify(publicExercise);

    expect(publicExercise.version).toBe('rich-closed-question-v1');
    expect(publicExercise.questions).toHaveLength(6);
    expect(serialized).not.toContain('correct');
    expect(serialized).not.toContain('correctionPayload');
    expect(serialized).not.toContain('explanation');
    expect(serialized).not.toContain('score');
  });

  it('maps a V1-B exercise without leaking private correction data', () => {
    const publicExercise = toRichClosedPublicExercise(
      richClosedV1BExerciseFixture(),
    );
    const serialized = JSON.stringify(publicExercise);

    expect(publicExercise.questions).toHaveLength(8);
    expect(
      publicExercise.questions.map((question) => question.questionKind),
    ).toEqual([
      'single_choice',
      'multiple_choice',
      'matching',
      'ordering',
      'case_qualification',
      'error_detection',
      'timeline',
      'date_slider',
    ]);
    expect(serialized).not.toContain('correctOrder');
    expect(serialized).not.toContain('correctYear');
    expect(serialized).not.toContain('explanation');
    expect(serialized).not.toContain('correction');
    expect(serialized).not.toContain('score');
  });

  it('maps a V1-B full exercise without leaking private correction data', () => {
    const publicExercise = toRichClosedPublicExercise(
      richClosedV1BFullExerciseFixture(),
    );
    const serialized = JSON.stringify(publicExercise);

    expect(publicExercise.questions).toHaveLength(10);
    expect(
      publicExercise.questions.map((question) => question.questionKind),
    ).toEqual([
      'single_choice',
      'multiple_choice',
      'matching',
      'ordering',
      'case_qualification',
      'error_detection',
      'timeline',
      'date_slider',
      'true_false_grid',
      'cause_consequence',
    ]);
    expect(serialized).not.toContain('correctValues');
    expect(serialized).not.toContain('correctPairs');
    expect(serialized).not.toContain('correctOrder');
    expect(serialized).not.toContain('correctYear');
    expect(serialized).not.toContain('explanation');
    expect(serialized).not.toContain('correction');
    expect(serialized).not.toContain('score');
  });

  it('maps a V1-C exercise without leaking private correction data', () => {
    const publicExercise = toRichClosedPublicExercise(
      richClosedV1CExerciseFixture(),
    );
    const serialized = JSON.stringify(publicExercise);

    expect(publicExercise.questions).toHaveLength(11);
    expect(
      publicExercise.questions.map((question) => question.questionKind),
    ).toEqual([
      'single_choice',
      'multiple_choice',
      'matching',
      'ordering',
      'case_qualification',
      'error_detection',
      'timeline',
      'date_slider',
      'true_false_grid',
      'cause_consequence',
      'institution_matrix',
    ]);
    expect(serialized).toContain('cells');
    expect(serialized).not.toContain('correctValues');
    expect(serialized).not.toContain('correctPairs');
    expect(serialized).not.toContain('correctOrder');
    expect(serialized).not.toContain('correctYear');
    expect(serialized).not.toContain('explanation');
    expect(serialized).not.toContain('correction');
    expect(serialized).not.toContain('score');
  });

  it('maps a V1-C full diagram exercise without leaking private correction or render payloads', () => {
    const publicExercise = toRichClosedPublicExercise(
      richClosedV1CFullExerciseFixture(),
    );
    const serialized = JSON.stringify(publicExercise);

    expect(publicExercise.questions).toHaveLength(12);
    expect(
      publicExercise.questions.map((question) => question.questionKind),
    ).toEqual([
      'single_choice',
      'multiple_choice',
      'matching',
      'ordering',
      'case_qualification',
      'error_detection',
      'timeline',
      'date_slider',
      'true_false_grid',
      'cause_consequence',
      'institution_matrix',
      'diagram_labeling',
    ]);
    expect(serialized).toContain('diagram');
    expect(serialized).toContain('slots');
    expect(serialized).not.toContain('correctValues');
    expect(serialized).not.toContain('explanation');
    expect(serialized).not.toContain('correction');
    expect(serialized).not.toContain('score');
    expect(serialized).not.toContain('rawSvg');
    expect(serialized).not.toContain('mermaid');
    expect(serialized).not.toContain('widget');
    expect(serialized).not.toContain('renderPayload');
  });

  it('maps a V1-C calculation exercise without leaking private calculations or formulas', () => {
    const publicExercise = toRichClosedPublicExercise(
      richClosedV1CCalculationExerciseFixture(),
    );
    const serialized = JSON.stringify(publicExercise);

    expect(publicExercise.questions).toHaveLength(13);
    expect(
      publicExercise.questions.map((question) => question.questionKind),
    ).toContain('calculation_mcq');
    expect(serialized).toContain('scenario');
    expect(serialized).toContain('calculation');
    expect(serialized).toContain('choices');
    expect(serialized).toContain('value');
    expect(serialized).not.toContain('correctChoiceId');
    expect(serialized).not.toContain('expectedValue');
    expect(serialized).not.toContain('workedSteps');
    expect(serialized).not.toContain('explanation');
    expect(serialized).not.toContain('formula');
    expect(serialized).not.toContain('expression');
    expect(serialized).not.toContain('calculationCode');
    expect(serialized).not.toContain('renderPayload');
    expect(serialized).not.toContain('score');
  });

  it('allowlists nested calculation fields before submit', () => {
    const fixture = richClosedQuestionFixture(
      'calculation_mcq',
    ) as RichClosedCalculationMcqQuestion;
    const calculation = {
      ...fixture.calculation,
      correctChoiceId: 'nested-correct-choice-leak',
      expectedValue: 999,
      formula: 'Math.floor(validVotes / 2) + 1',
      renderPayload: { widget: 'free' },
    } as RichClosedCalculationMcqQuestion['calculation'];
    const choices = fixture.choices.map((choice) => ({
      ...choice,
      correctChoiceId: 'choice-correction-leak',
      workedSteps: [{ id: 'private-step', label: 'Private step' }],
      expression: 'validVotes / 2',
    })) as RichClosedCalculationMcqQuestion['choices'];
    const question: RichClosedCalculationMcqQuestion = {
      ...fixture,
      calculation,
      choices,
    };

    const publicQuestion = toRichClosedPublicQuestion(question);
    const serialized = JSON.stringify(publicQuestion);

    expect(serialized).toContain('calculation');
    expect(serialized).toContain('choices');
    expect(serialized).toContain('value');
    expect(serialized).not.toContain('nested-correct-choice-leak');
    expect(serialized).not.toContain('choice-correction-leak');
    expect(serialized).not.toContain('correctChoiceId');
    expect(serialized).not.toContain('expectedValue');
    expect(serialized).not.toContain('workedSteps');
    expect(serialized).not.toContain('formula');
    expect(serialized).not.toContain('expression');
    expect(serialized).not.toContain('renderPayload');
    expect(serialized).not.toContain('widget');
  });

  it('removes internal choice feedback from public choice payloads', () => {
    const question = {
      ...richClosedQuestionFixture('single_choice'),
      choices: [
        {
          id: 'choice-a',
          label: 'La responsabilité politique',
          feedback: 'Ce feedback reste privé avant submit.',
        },
        {
          id: 'choice-b',
          label: 'La séparation totalement étanche',
          feedback: 'Feedback privé également.',
        },
      ],
    };

    const publicQuestion = toRichClosedPublicQuestion(question);
    const serialized = JSON.stringify(publicQuestion);

    expect(serialized).not.toContain('feedback');
    expect(serialized).not.toContain('Ce feedback reste privé avant submit.');
    expect(serialized).not.toContain('Feedback privé également.');
  });
});
