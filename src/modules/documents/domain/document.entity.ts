import { StudentId } from '../../../shared/domain/student-id';

export const DOCUMENT_KINDS = ['COURSE_PDF', 'EXAM_PDF', 'EXAM_IMAGE'] as const;

export type DocumentKind = (typeof DOCUMENT_KINDS)[number];
export type DocumentStatus = 'UPLOADED' | 'PROCESSING' | 'READY' | 'FAILED';

export class RevisionDocument {
  readonly id: string;
  readonly studentId: StudentId;
  readonly subjectId: string;
  readonly kind: DocumentKind;
  readonly fileName: string;
  readonly storagePath: string;
  readonly mimeType: string;
  readonly status: DocumentStatus;

  constructor(input: {
    id: string;
    studentId: StudentId;
    subjectId: string;
    kind: DocumentKind;
    fileName: string;
    storagePath: string;
    mimeType: string;
    status: DocumentStatus;
  }) {
    if (!DOCUMENT_KINDS.includes(input.kind)) {
      throw new Error(
        'Document kind must be COURSE_PDF, EXAM_PDF, or EXAM_IMAGE',
      );
    }

    const fileName = input.fileName.trim();
    if (!fileName) {
      throw new Error('Document file name is required');
    }

    const storagePath = input.storagePath.trim();
    if (!storagePath) {
      throw new Error('Document storage path is required');
    }

    const mimeType = input.mimeType.trim();
    if (!mimeType) {
      throw new Error('Document mime type is required');
    }

    if (
      (input.kind === 'COURSE_PDF' || input.kind === 'EXAM_PDF') &&
      mimeType !== 'application/pdf'
    ) {
      throw new Error('PDF documents must use application/pdf');
    }

    if (input.kind === 'EXAM_IMAGE' && !mimeType.startsWith('image/')) {
      throw new Error('Exam images must use an image mime type');
    }

    this.id = input.id;
    this.studentId = input.studentId;
    this.subjectId = input.subjectId;
    this.kind = input.kind;
    this.fileName = fileName;
    this.storagePath = storagePath;
    this.mimeType = mimeType;
    this.status = input.status;
  }
}
