import { Inject, Injectable } from '@nestjs/common';
import {
  REVISION_REPOSITORY,
  type RevisionRepository,
} from '../../revision/application/revision.repository';
import type { KnowledgeUnit } from '../../revision/domain/knowledge-unit.entity';
import {
  ACTIVITIES_REPOSITORY,
  type ActivitiesRepository,
  type OpenQuestionActivity,
} from './activities.repository';

export const OPEN_QUESTION_MAX_ANSWER_LENGTH = 4000;
export const OPEN_QUESTION_INSTRUCTIONS =
  'Réponds en quelques phrases structurées, en t’appuyant uniquement sur le cours.';

@Injectable()
export class StartOpenQuestionActivityUseCase {
  constructor(
    @Inject(ACTIVITIES_REPOSITORY)
    private readonly activitiesRepository: ActivitiesRepository,
    @Inject(REVISION_REPOSITORY)
    private readonly revisionRepository: RevisionRepository,
  ) {}

  async execute(input: {
    studentId: string;
    subjectId: string;
    knowledgeUnitId: string;
  }): Promise<OpenQuestionActivity> {
    const knowledgeUnit = await this.findKnowledgeUnit(input);
    const generationContext =
      await this.activitiesRepository.findOpenQuestionGenerationContext({
        studentId: input.studentId,
        subjectId: input.subjectId,
        knowledgeUnitId: knowledgeUnit.id,
      });
    const sourceChunkIds = Array.from(
      new Set(generationContext?.knowledgeUnit.sourceChunkIds ?? []),
    );

    return this.activitiesRepository.createOpenQuestionActivity({
      studentId: input.studentId,
      subjectId: input.subjectId,
      knowledgeUnitId: knowledgeUnit.id,
      documentId: generationContext?.documentId ?? null,
      question: {
        prompt: buildOpenQuestionPrompt(knowledgeUnit),
        instructions: OPEN_QUESTION_INSTRUCTIONS,
        maxAnswerLength: OPEN_QUESTION_MAX_ANSWER_LENGTH,
        sourceChunkIds,
        version: 1,
      },
    });
  }

  private async findKnowledgeUnit(input: {
    studentId: string;
    subjectId: string;
    knowledgeUnitId: string;
  }): Promise<KnowledgeUnit> {
    const knowledgeUnits = await this.revisionRepository.findKnowledgeUnits(
      input.studentId,
    );
    const knowledgeUnit = knowledgeUnits.find(
      (unit) =>
        unit.id === input.knowledgeUnitId && unit.subjectId === input.subjectId,
    );

    if (!knowledgeUnit) {
      throw new Error('Knowledge unit does not belong to student subject');
    }

    return knowledgeUnit;
  }
}

function buildOpenQuestionPrompt(knowledgeUnit: KnowledgeUnit): string {
  return `Explique avec tes propres mots la notion suivante : ${knowledgeUnit.title}.`;
}
