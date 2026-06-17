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

export function richClosedV1BFullExerciseFixture(): RichClosedExercise {
  const v1bFixture = richClosedV1BExerciseFixture();

  return {
    ...v1bFixture,
    id: 'rich-exercise-v1b-full-1',
    title: 'Droit constitutionnel - exercice riche fermé V1-B complet',
    questions: [
      ...v1bFixture.questions,
      richClosedQuestionFixture('true_false_grid'),
      richClosedQuestionFixture('cause_consequence'),
    ],
  };
}

export function richClosedV1CExerciseFixture(): RichClosedExercise {
  const v1bFullFixture = richClosedV1BFullExerciseFixture();

  return {
    ...v1bFullFixture,
    id: 'rich-exercise-v1c-1',
    title: 'Droit constitutionnel - exercice riche fermé V1-C',
    questions: [
      ...v1bFullFixture.questions,
      richClosedQuestionFixture('institution_matrix'),
    ],
  };
}

export function richClosedV1CFullExerciseFixture(): RichClosedExercise {
  const v1cFixture = richClosedV1CExerciseFixture();

  return {
    ...v1cFixture,
    id: 'rich-exercise-v1c-full-1',
    title: 'Droit constitutionnel - exercice riche fermé V1-C complet',
    questions: [
      ...v1cFixture.questions,
      richClosedQuestionFixture('diagram_labeling'),
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
    case 'true_false_grid':
      return {
        ...baseQuestion('true-false-grid-1', 'true_false_grid'),
        prompt:
          'Indique si chaque affirmation sur le régime parlementaire est vraie ou fausse.',
        instruction:
          'Choisis vrai ou faux pour chaque ligne sans laisser de ligne vide.',
        rows: [
          {
            id: 'row-1',
            statement:
              'Le gouvernement peut être politiquement responsable devant le Parlement.',
            context: 'Critère classique du régime parlementaire.',
          },
          {
            id: 'row-2',
            statement:
              'La séparation des pouvoirs y interdit toute collaboration institutionnelle.',
            context: 'Attention à la distinction avec la séparation stricte.',
          },
          {
            id: 'row-3',
            statement: 'La dissolution peut être un moyen d’action réciproque.',
            context: 'Elle équilibre la responsabilité politique.',
          },
        ],
        correctValues: [
          { rowId: 'row-1', value: true },
          { rowId: 'row-2', value: false },
          { rowId: 'row-3', value: true },
        ],
        explanation:
          'Le parlementarisme combine responsabilité politique et collaboration des pouvoirs, dont la dissolution peut faire partie.',
      };
    case 'cause_consequence':
      return {
        ...baseQuestion('cause-consequence-1', 'cause_consequence'),
        prompt:
          'Associe chaque mécanisme institutionnel à sa conséquence politique.',
        instruction:
          'Sélectionne une conséquence différente pour chaque cause proposée.',
        causes: [
          {
            id: 'cause-1',
            label: 'Motion de censure adoptée',
            description: 'La chambre retire sa confiance au gouvernement.',
          },
          {
            id: 'cause-2',
            label: 'Dissolution de l’Assemblée',
            description: 'Le mandat de la chambre prend fin avant terme.',
          },
          {
            id: 'cause-3',
            label: 'Question de confiance rejetée',
            description: 'Le gouvernement engage sa responsabilité.',
          },
        ],
        consequences: [
          {
            id: 'consequence-1',
            label: 'Démission du gouvernement',
            description:
              'La responsabilité politique entraîne la sortie du gouvernement.',
          },
          {
            id: 'consequence-2',
            label: 'Nouvelles élections législatives',
            description: 'Le corps électoral renouvelle la chambre.',
          },
          {
            id: 'consequence-3',
            label: 'Crise politique ou départ du gouvernement',
            description:
              'Le rejet manifeste une perte de confiance parlementaire.',
          },
        ],
        correctPairs: [
          { causeId: 'cause-1', consequenceId: 'consequence-1' },
          { causeId: 'cause-2', consequenceId: 'consequence-2' },
          { causeId: 'cause-3', consequenceId: 'consequence-3' },
        ],
        explanation:
          'Chaque cause active une conséquence institutionnelle distincte dans la logique parlementaire.',
      };
    case 'institution_matrix':
      return {
        ...baseQuestion('institution-matrix-1', 'institution_matrix'),
        prompt:
          'Complète la matrice comparant trois institutions de la Ve République.',
        instruction:
          'Choisis une option fermée pour chaque cellule demandée, sans réponse libre.',
        rows: [
          {
            id: 'row-president',
            label: 'Président de la République',
            description: 'Chef de l’État sous la Ve République.',
          },
          {
            id: 'row-government',
            label: 'Gouvernement',
            description: 'Organe qui conduit la politique de la Nation.',
          },
          {
            id: 'row-assembly',
            label: 'Assemblée nationale',
            description: 'Chambre élue au suffrage universel direct.',
          },
        ],
        columns: [
          {
            id: 'column-legitimacy',
            label: 'Mode de légitimité',
          },
          {
            id: 'column-action',
            label: 'Moyen d’action',
          },
          {
            id: 'column-responsibility',
            label: 'Responsabilité politique',
          },
        ],
        cells: [
          {
            id: 'cell-president-legitimacy',
            rowId: 'row-president',
            columnId: 'column-legitimacy',
            prompt: 'Quelle légitimité caractérise le Président ?',
            options: [
              {
                id: 'option-legitimacy-election',
                label: 'Élection au suffrage universel',
              },
              {
                id: 'option-legitimacy-confidence',
                label: 'Confiance parlementaire',
              },
              {
                id: 'option-legitimacy-nomination',
                label: 'Nomination par le Gouvernement',
              },
            ],
          },
          {
            id: 'cell-government-responsibility',
            rowId: 'row-government',
            columnId: 'column-responsibility',
            prompt: 'Devant qui le Gouvernement est-il responsable ?',
            options: [
              {
                id: 'option-responsibility-assembly',
                label: 'Assemblée nationale',
              },
              {
                id: 'option-responsibility-senate',
                label: 'Sénat seul',
              },
              {
                id: 'option-responsibility-none',
                label: 'Aucune responsabilité politique',
              },
            ],
          },
          {
            id: 'cell-assembly-action',
            rowId: 'row-assembly',
            columnId: 'column-action',
            prompt: 'Quel moyen d’action appartient à l’Assemblée nationale ?',
            options: [
              {
                id: 'option-action-censure',
                label: 'Motion de censure',
              },
              {
                id: 'option-action-dissolution',
                label: 'Dissolution de sa propre chambre',
              },
              {
                id: 'option-action-promulgation',
                label: 'Promulgation des lois',
              },
            ],
          },
        ],
        correctValues: [
          {
            cellId: 'cell-president-legitimacy',
            optionId: 'option-legitimacy-election',
          },
          {
            cellId: 'cell-government-responsibility',
            optionId: 'option-responsibility-assembly',
          },
          {
            cellId: 'cell-assembly-action',
            optionId: 'option-action-censure',
          },
        ],
        explanation:
          'La matrice distingue la légitimité présidentielle, la responsabilité du Gouvernement devant l’Assemblée nationale et le moyen de contrôle parlementaire.',
      };
    case 'diagram_labeling':
      return {
        ...baseQuestion('diagram-labeling-1', 'diagram_labeling'),
        prompt:
          'Complète les étiquettes manquantes dans le schéma des rapports institutionnels.',
        instruction:
          'Choisis une option fermée pour chaque emplacement du schéma.',
        diagram: {
          title: 'Rapports institutionnels sous la Ve République',
          description:
            'Schéma sémantique borné entre Président, Gouvernement et Parlement.',
          layout: 'vertical_flow',
          nodes: [
            {
              id: 'node-president',
              label: 'Président de la République',
              description: 'Chef de l’État.',
              groupId: 'group-executive',
            },
            {
              id: 'node-government',
              label: 'Gouvernement',
              description: 'Conduit la politique de la Nation.',
              groupId: 'group-executive',
            },
            {
              id: 'node-assembly',
              label: 'Assemblée nationale',
              description: 'Chambre politiquement déterminante.',
              groupId: 'group-parliament',
            },
            {
              id: 'node-senate',
              label: 'Sénat',
              description: 'Chambre représentant les collectivités.',
              groupId: 'group-parliament',
            },
          ],
          groups: [
            {
              id: 'group-executive',
              label: 'Exécutif',
            },
            {
              id: 'group-parliament',
              label: 'Parlement',
            },
          ],
          edges: [
            {
              id: 'edge-president-government',
              fromNodeId: 'node-president',
              toNodeId: 'node-government',
              label: 'nomination',
            },
            {
              id: 'edge-government-assembly',
              fromNodeId: 'node-government',
              toNodeId: 'node-assembly',
              label: 'responsabilité politique',
            },
            {
              id: 'edge-assembly-government',
              fromNodeId: 'node-assembly',
              toNodeId: 'node-government',
              label: 'contrôle',
            },
          ],
        },
        slots: [
          {
            id: 'slot-government-role',
            anchorType: 'node',
            anchorId: 'node-government',
            prompt: 'Quel organe conduit la politique de la Nation ?',
            options: [
              { id: 'option-government', label: 'Gouvernement' },
              { id: 'option-president', label: 'Président de la République' },
              { id: 'option-senate', label: 'Sénat' },
            ],
          },
          {
            id: 'slot-censure',
            anchorType: 'edge',
            anchorId: 'edge-assembly-government',
            prompt:
              'Quel mécanisme peut renverser politiquement le Gouvernement ?',
            options: [
              { id: 'option-motion-censure', label: 'Motion de censure' },
              { id: 'option-promulgation', label: 'Promulgation' },
              { id: 'option-referendum', label: 'Référendum' },
            ],
          },
          {
            id: 'slot-nomination',
            anchorType: 'edge',
            anchorId: 'edge-president-government',
            prompt: 'Quel pouvoir intervient dans la nomination ?',
            options: [
              { id: 'option-nomination', label: 'Pouvoir de nomination' },
              { id: 'option-censure', label: 'Motion de censure' },
              { id: 'option-amendment', label: 'Droit d’amendement' },
            ],
          },
        ],
        correctValues: [
          {
            slotId: 'slot-government-role',
            optionId: 'option-government',
          },
          {
            slotId: 'slot-censure',
            optionId: 'option-motion-censure',
          },
          {
            slotId: 'slot-nomination',
            optionId: 'option-nomination',
          },
        ],
        explanation:
          'Le schéma relie le rôle du Gouvernement, sa responsabilité devant l’Assemblée nationale et le pouvoir de nomination présidentielle.',
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
      case 'true_false_grid':
        return 'classification';
      case 'cause_consequence':
        return 'causality';
      case 'institution_matrix':
        return 'comparison';
      case 'diagram_labeling':
        return 'classification';
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
