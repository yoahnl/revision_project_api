const mockDownload = jest.fn();
const mockFile = jest.fn(() => ({ download: mockDownload }));
const mockBucket = jest.fn(() => ({ file: mockFile }));
const mockGetStorage = jest.fn(() => ({ bucket: mockBucket }));
const mockGetApps = jest.fn(() => []);
const mockInitializeApp = jest.fn();

jest.mock('firebase-admin/app', () => ({
  getApps: mockGetApps,
  initializeApp: mockInitializeApp,
}));

jest.mock('firebase-admin/storage', () => ({
  getStorage: mockGetStorage,
}));

import { FirebaseStorageDocumentReader } from './firebase-storage-document.reader';

describe('FirebaseStorageDocumentReader', () => {
  const originalBucket = process.env.FIREBASE_STORAGE_BUCKET;

  beforeEach(() => {
    mockDownload.mockReset();
    mockFile.mockClear();
    mockBucket.mockClear();
    mockGetStorage.mockClear();
    mockGetApps.mockReset();
    mockInitializeApp.mockClear();
    mockGetApps.mockReturnValue([]);
    mockDownload.mockResolvedValue([Buffer.from('pdf-content')]);
  });

  afterEach(() => {
    if (originalBucket === undefined) {
      delete process.env.FIREBASE_STORAGE_BUCKET;
    } else {
      process.env.FIREBASE_STORAGE_BUCKET = originalBucket;
    }
  });

  it('initializes Firebase Admin and downloads the storage object', async () => {
    process.env.FIREBASE_STORAGE_BUCKET = 'revision-bucket';

    const content = await new FirebaseStorageDocumentReader().read({
      storagePath: 'students/firebase-1/subjects/subject-1/cours.pdf',
    });

    expect(mockInitializeApp).toHaveBeenCalledTimes(1);
    expect(mockBucket).toHaveBeenCalledWith('revision-bucket');
    expect(mockFile).toHaveBeenCalledWith(
      'students/firebase-1/subjects/subject-1/cours.pdf',
    );
    expect(content).toEqual(Buffer.from('pdf-content'));
  });

  it('does not initialize Firebase Admin when an app already exists', () => {
    mockGetApps.mockReturnValue([{}]);

    new FirebaseStorageDocumentReader();

    expect(mockInitializeApp).not.toHaveBeenCalled();
  });
});
