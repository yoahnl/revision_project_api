import type {
  RevisionSheetDto,
  RevisionSheetSectionDto,
  StudyArtifactSourceDto,
  SummaryDto,
} from '../application/study-artifacts.repository';

export function toPublicSummary(summary: SummaryDto) {
  return {
    id: summary.id,
    documentId: summary.documentId,
    subjectId: summary.subjectId,
    status: summary.status,
    title: summary.title,
    content: summary.content,
    keyPoints: summary.keyPoints,
    limits: summary.limits,
    errorCode: summary.errorCode,
    sources: summary.sources.map(toPublicSource),
  };
}

export function toPublicRevisionSheet(revisionSheet: RevisionSheetDto) {
  return {
    id: revisionSheet.id,
    documentId: revisionSheet.documentId,
    subjectId: revisionSheet.subjectId,
    status: revisionSheet.status,
    title: revisionSheet.title,
    introduction: revisionSheet.introduction,
    keyPoints: revisionSheet.keyPoints,
    commonMistakes: revisionSheet.commonMistakes,
    mustKnow: revisionSheet.mustKnow,
    practiceSuggestions: revisionSheet.practiceSuggestions,
    errorCode: revisionSheet.errorCode,
    sections: revisionSheet.sections.map(toPublicRevisionSheetSection),
  };
}

function toPublicRevisionSheetSection(section: RevisionSheetSectionDto) {
  return {
    id: section.id,
    displayOrder: section.displayOrder,
    title: section.title,
    content: section.content,
    sources: section.sources.map(toPublicSource),
  };
}

function toPublicSource(source: StudyArtifactSourceDto) {
  return {
    chunkId: source.chunkId,
    text: source.text,
    pageNumber: source.pageNumber,
    index: source.index,
  };
}
