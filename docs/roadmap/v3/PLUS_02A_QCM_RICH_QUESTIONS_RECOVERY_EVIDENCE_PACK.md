# PLUS-02A - Evidence pack

Version commune API/App. Miroir attendu côté App : `revision_project_app/docs/roadmap/v3/PLUS_02A_QCM_RICH_QUESTIONS_RECOVERY_EVIDENCE_PACK.md`.

## API - date_slider validator

Fichier : `src/modules/activities/application/rich-closed-questions/rich-closed-question.validator.ts`

```ts
if (
  !isDateSliderCorrectionReachable({
    minYear,
    maxYear,
    step,
    correctYear,
  })
) {
  issues.push(
    issue(
      'RICH_CLOSED_DATE_SLIDER_CORRECTION_INVALID',
      'Date slider correction must be within the public year range and align with the configured step',
      'correctYear',
    ),
  );
}
```

```ts
function isDateSliderCorrectionReachable(input: {
  minYear: number | null;
  maxYear: number | null;
  step: number | null;
  correctYear: number | null;
}): boolean {
  if (
    input.minYear === null ||
    input.maxYear === null ||
    input.step === null ||
    input.correctYear === null ||
    input.minYear >= input.maxYear ||
    input.step < 1 ||
    input.correctYear < input.minYear ||
    input.correctYear > input.maxYear
  ) {
    return false;
  }

  return (input.correctYear - input.minYear) % input.step === 0;
}
```

## API - test ajouté

Fichier : `src/modules/activities/application/rich-closed-questions/rich-closed-question.validator.spec.ts`

```ts
const unreachableCorrection = {
  ...richClosedQuestionFixture('date_slider'),
  minYear: 1945,
  maxYear: 1970,
  step: 2,
  correctYear: 1958,
};
```

```ts
expect(validateRichClosedQuestion(unreachableCorrection).issues).toContainEqual(
  expect.objectContaining({
    code: 'RICH_CLOSED_DATE_SLIDER_CORRECTION_INVALID',
  }),
);
```

## App - garde anti-fuite

Fichier : `lib/features/activities/domain/rich_closed_exercise.dart`

```dart
const _forbiddenPreSubmitKeys = {
  'correctionPayload',
  'correction',
  'explanation',
  'feedback',
  'choiceFeedback',
  'modelAnswer',
  'answerText',
  'freeTextAnswer',
  'textAnswer',
  'score',
  'partialScore',
  'minAcceptedYear',
  'maxAcceptedYear',
  'workedSteps',
  'expectedValue',
  'answersPayload',
  'expectedAnswer',
  'expectedAnswers',
  'semanticLabel',
  'answerHint',
};
```

## App - test ajouté

Fichier : `test/features/activities/rich_closed_exercise_test.dart`

```dart
test('rejects every forbidden pre-submit correction field', () {
  for (final field in [
    'correctChoiceId',
    'correctChoiceIds',
    'correctPairs',
    'correctOrder',
    'correctValues',
    'correctErrorId',
    'correctYear',
    'minAcceptedYear',
    'maxAcceptedYear',
    'explanation',
    'score',
    'modelAnswer',
    'answerText',
    'freeTextAnswer',
    'textAnswer',
    'answersPayload',
    'expectedValue',
    'workedSteps',
  ]) {
    // La suite du test injecte chaque champ interdit dans le payload public
    // et attend une RichClosedExerciseParseException.
  }
});
```

## Trackers V3

`EXECUTION_LOT_TRACKER_V3.md` marque `PLUS-02A` en `DONE` avec validation :

```text
Inventaire 14 types, contrat rich closed borné, correction date slider, garde anti-fuite App, tests API/App ciblés et validations demandées.
```

`LOT_TRACKER_V3.md` marque le parent `PLUS-02` en `IN_PROGRESS` :

```text
PLUS-02A a récupéré le contrat et le rendu rich closed ; PLUS-02B doit encore intégrer result/correction/history QCM riche.
```

## Commandes vertes finales

API :

```bash
npm run build
npm run lint:check
npm test -- rich-closed --runInBand
npm test -- activities --runInBand
npm test -- revision-sessions --runInBand
npm test -- question-bank --runInBand
git diff --check
```

App :

```bash
dart analyze lib test
flutter test test/features/activities --reporter compact
flutter test test/features/revision_sessions --reporter compact
flutter test test/features/courses --reporter compact
git diff --check
```

## Contraintes vérifiées

- Pas de commit.
- Pas de push.
- Pas de merge, rebase ou tag.
- Pas de déploiement.
- Pas de migration Prisma.
- Pas de changement provider IA.
- Pas de changement prompt IA.
- Pas de feature examen, quality pool, Rena, Today, deep revision, fiches complètes ou release.
