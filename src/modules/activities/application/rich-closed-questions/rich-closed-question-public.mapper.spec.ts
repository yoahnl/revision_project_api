import {
  toRichClosedPublicExercise,
  toRichClosedPublicQuestion,
} from './rich-closed-question-public.mapper';
import {
  richClosedExerciseFixture,
  richClosedQuestionFixture,
  richClosedV1BExerciseFixture,
  richClosedV1BFullExerciseFixture,
  richClosedV1CExerciseFixture,
} from './rich-closed-question.fixtures';

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
    expect(serialized).not.toContain('correctYear');
    expect(serialized).not.toContain('correctionPayload');
    expect(serialized).not.toContain('explanation');
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
