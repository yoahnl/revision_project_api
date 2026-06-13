export class KnowledgeUnit {
  readonly id: string;
  readonly subjectId: string;
  readonly title: string;
  readonly summary: string;

  constructor(input: {
    id: string;
    subjectId: string;
    title: string;
    summary: string;
  }) {
    if (input.title.trim().length < 2) {
      throw new Error(
        'Knowledge unit title must contain at least 2 characters',
      );
    }

    this.id = input.id;
    this.subjectId = input.subjectId;
    this.title = input.title.trim();
    this.summary = input.summary.trim();
  }
}
