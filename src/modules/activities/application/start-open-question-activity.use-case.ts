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
import {
  OPEN_QUESTION_GENERATOR,
  type OpenQuestionGenerator,
} from './open-question-generator';

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
    @Inject(OPEN_QUESTION_GENERATOR)
    private readonly openQuestionGenerator: OpenQuestionGenerator,
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
    const generatedQuestion = await this.openQuestionGenerator.generate(
      generationContext
        ? {
            studentId: input.studentId,
            subjectId: input.subjectId,
            documentId: generationContext.documentId,
            knowledgeUnit: generationContext.knowledgeUnit,
            chunks: generationContext.chunks,
          }
        : {
            studentId: input.studentId,
            subjectId: input.subjectId,
            documentId: null,
            knowledgeUnit: Object.assign(knowledgeUnit, {
              sourceChunkIds: [],
            }),
            chunks: [],
          },
    );

    return this.activitiesRepository.createOpenQuestionActivity({
      studentId: input.studentId,
      subjectId: input.subjectId,
      knowledgeUnitId: knowledgeUnit.id,
      documentId: generationContext?.documentId ?? null,
      question: generatedQuestion,
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
