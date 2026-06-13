import { Subject, SubjectPriority } from './subject.entity';

describe('Subject', () => {
  it('rejects priorities outside the supported range', () => {
    const input = {
      id: 'subject-1',
      studentId: 'student-1',
      name: 'Anatomie',
      priority: 0 as 1,
      createdAt: new Date('2026-06-12T10:00:00.000Z'),
    };
    const invalidPriorities = [0, 6, 3.5, Number.NaN, Number.POSITIVE_INFINITY];

    for (const priority of invalidPriorities) {
      expect(
        () => new Subject({ ...input, priority: priority as SubjectPriority }),
      ).toThrow('Subject priority must be between 1 and 5');
    }
  });
});
