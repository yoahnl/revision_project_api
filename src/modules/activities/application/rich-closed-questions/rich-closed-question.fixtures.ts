import {
  RICH_CLOSED_EXERCISE_VERSION,
  type RichClosedExercise,
  type RichClosedQuestion,
  type RichClosedCognitiveSkill,
  type RichClosedQuestionKind,
} from './rich-closed-question.types';

type RichClosedBaseQuestionFields<K extends RichClosedQuestionKind> = Pick<
  Extract<RichClosedQuestion, { questionKind: K }>,
  'id' | 'questionKind' | 'difficulty' | 'cognitiveSkill' | 'sourceChunkIds'
>;

export function richClosedExerciseFixture(): RichClosedExercise {
  return {
    id: 'rich-exercise-1',
    version: RICH_CLOSED_EXERCISE_VERSION,
    title: 'Droit constitutionnel - exercice riche fermé',
    subjectId: 'subject-1',
    documentId: 'document-1',
    knowledgeUnitId: 'unit-1',
    questions: [
      richClosedQuestionFixture('single_choice'),
      richClosedQuestionFixture('multiple_choice'),
      richClosedQuestionFixture('matching'),
      richClosedQuestionFixture('ordering'),
      richClosedQuestionFixture('case_qualification'),
      richClosedQuestionFixture('error_detection'),
    ],
  };
}

export function richClosedV1BExerciseFixture(): RichClosedExercise {
  const v1aFixture = richClosedExerciseFixture();

  return {
    ...v1aFixture,
    id: 'rich-exercise-v1b-1',
    title: 'Droit constitutionnel - exercice riche fermé V1-B',
    questions: [
      ...v1aFixture.questions,
      richClosedQuestionFixture('timeline'),
      richClosedQuestionFixture('date_slider'),
    ],
  };
}

export function richClosedQuestionFixture(
  questionKind: RichClosedQuestionKind,
): RichClosedQuestion {
  switch (questionKind) {
    case 'single_choice':
      return {
        ...baseQuestion('single-1', 'single_choice'),
        prompt:
          'Quel critère institutionnel caractérise le mieux un régime parlementaire ?',
        choices: [
          { id: 'choice-a', label: 'La responsabilité politique' },
          { id: 'choice-b', label: 'La séparation totalement étanche' },
          { id: 'choice-c', label: 'La souveraineté des entités fédérées' },
        ],
        correctChoiceId: 'choice-a',
        explanation:
          'La responsabilité politique du gouvernement devant le Parlement est un critère central.',
      };
    case 'multiple_choice':
      return {
        ...baseQuestion('multiple-1', 'multiple_choice'),
        prompt: 'Quels indices peuvent orienter vers un régime parlementaire ?',
        choices: [
          { id: 'choice-a', label: 'Responsabilité du gouvernement' },
          { id: 'choice-b', label: 'Collaboration des pouvoirs' },
          { id: 'choice-c', label: 'Indépendance organique absolue' },
          { id: 'choice-d', label: 'Absence de Parlement' },
        ],
        minSelections: 2,
        maxSelections: 2,
        correctChoiceIds: ['choice-a', 'choice-b'],
        explanation:
          'Le parlementarisme repose sur la responsabilité et des moyens d’action réciproques.',
      };
    case 'matching':
      return {
        ...baseQuestion('matching-1', 'matching'),
        prompt: 'Associe chaque mécanisme à sa fonction principale.',
        leftItems: [
          { id: 'left-1', label: 'Motion de censure' },
          { id: 'left-2', label: 'Dissolution' },
          { id: 'left-3', label: 'Contrôle constitutionnel' },
        ],
        rightItems: [
          { id: 'right-1', label: 'Responsabilité politique' },
          { id: 'right-2', label: 'Fin anticipée d’une chambre' },
          { id: 'right-3', label: 'Vérification d’une norme' },
        ],
        correctPairs: [
          { leftId: 'left-1', rightId: 'right-1' },
          { leftId: 'left-2', rightId: 'right-2' },
          { leftId: 'left-3', rightId: 'right-3' },
        ],
        explanation:
          'Chaque mécanisme renvoie à une fonction institutionnelle différente.',
      };
    case 'ordering':
      return {
        ...baseQuestion('ordering-1', 'ordering'),
        prompt:
          'Remets dans l’ordre les étapes d’un raisonnement de qualification.',
        items: [
          { id: 'item-1', label: 'Repérer les organes' },
          { id: 'item-2', label: 'Analyser leurs moyens d’action' },
          { id: 'item-3', label: 'Qualifier le régime' },
        ],
        correctOrder: ['item-1', 'item-2', 'item-3'],
        explanation:
          'La qualification vient après l’identification des critères institutionnels.',
      };
    case 'timeline':
      return {
        ...baseQuestion('timeline-1', 'timeline'),
        prompt: 'Remets dans l’ordre ces étapes du contrôle parlementaire.',
        instruction:
          'Classe les événements de la première étape à la dernière.',
        events: [
          {
            id: 'event-1',
            label: 'Dépôt de la motion',
            description: 'Des parlementaires engagent la procédure.',
          },
          {
            id: 'event-2',
            label: 'Débat politique',
            description: 'La chambre discute la responsabilité engagée.',
          },
          {
            id: 'event-3',
            label: 'Vote de la chambre',
            description: 'La chambre décide si la motion est adoptée.',
          },
        ],
        correctOrder: ['event-1', 'event-2', 'event-3'],
        explanation:
          'Le contrôle suit une séquence procédurale : initiative, discussion, puis vote.',
      };
    case 'date_slider':
      return {
        ...baseQuestion('date-slider-1', 'date_slider'),
        prompt:
          'Place approximativement l’adoption de la Constitution de la Ve République.',
        instruction: 'Choisis une année entière dans la période proposée.',
        minYear: 1945,
        maxYear: 1970,
        step: 1,
        correctYear: 1958,
        toleranceYears: 0,
        explanation: 'La Constitution de la Ve République est adoptée en 1958.',
      };
    case 'case_qualification':
      return {
        ...baseQuestion('case-1', 'case_qualification'),
        prompt: 'Choisis la qualification juridique la plus pertinente.',
        caseText:
          'Un gouvernement doit conserver la confiance d’une chambre élue qui peut le renverser politiquement.',
        choices: [
          { id: 'choice-a', label: 'Régime parlementaire' },
          { id: 'choice-b', label: 'Régime présidentiel' },
          { id: 'choice-c', label: 'Confédération' },
        ],
        correctChoiceId: 'choice-a',
        explanation:
          'La responsabilité politique devant la chambre élue oriente vers le régime parlementaire.',
      };
    case 'error_detection':
      return {
        ...baseQuestion('error-1', 'error_detection'),
        prompt: 'Repère l’erreur dominante dans le raisonnement.',
        statement:
          'Un régime présidentiel se définit par la responsabilité politique du gouvernement devant le Parlement.',
        errorOptions: [
          { id: 'error-a', label: 'Confusion avec le régime parlementaire' },
          { id: 'error-b', label: 'Confusion avec l’État fédéral' },
          { id: 'error-c', label: 'Confusion avec le contrôle juridictionnel' },
        ],
        correctErrorId: 'error-a',
        explanation:
          'La responsabilité politique du gouvernement devant le Parlement est le critère du parlementarisme.',
      };
  }
}

function baseQuestion<K extends RichClosedQuestionKind>(
  id: string,
  questionKind: K,
): RichClosedBaseQuestionFields<K> {
  const cognitiveSkill: RichClosedCognitiveSkill = (() => {
    switch (questionKind) {
      case 'single_choice':
        return 'comparison';
      case 'timeline':
        return 'procedure';
      case 'date_slider':
        return 'comprehension';
      default:
        return 'case_application';
    }
  })();

  return {
    id,
    questionKind,
    difficulty: 'MEDIUM',
    cognitiveSkill,
    sourceChunkIds: ['chunk-1'],
  } as RichClosedBaseQuestionFields<K>;
}
