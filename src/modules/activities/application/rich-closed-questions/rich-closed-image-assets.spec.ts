import {
  RICH_CLOSED_IMAGE_ASSETS,
  getRichClosedImageAsset,
  isRichClosedImageAssetId,
} from './rich-closed-image-assets';

describe('rich closed image assets', () => {
  it('exposes a small allowlisted catalog without URL or storage fields', () => {
    expect(RICH_CLOSED_IMAGE_ASSETS).toHaveLength(3);

    for (const asset of RICH_CLOSED_IMAGE_ASSETS) {
      expect(asset.id).toMatch(/-v1$/);
      expect(asset.publicAltText.trim()).toBe(asset.publicAltText);
      expect(asset.publicAltText.length).toBeGreaterThan(10);
      expect(asset.license).toBe('internal_placeholder');
    }

    const serialized = JSON.stringify(RICH_CLOSED_IMAGE_ASSETS);
    expect(serialized).not.toContain('url');
    expect(serialized).not.toContain('storagePath');
    expect(serialized).not.toContain('base64');
    expect(serialized).not.toContain('dataUri');
    expect(serialized).not.toContain('blob');
    expect(serialized).not.toContain('assetPath');
    expect(serialized).not.toContain('de-gaulle');
    expect(serialized).not.toContain('napoleon');
    expect(serialized).not.toContain('simone');
  });

  it('resolves only known image asset ids', () => {
    expect(
      isRichClosedImageAssetId('image-choice-historical-figure-001-v1'),
    ).toBe(true);
    expect(
      getRichClosedImageAsset('image-choice-historical-figure-001-v1'),
    ).toEqual(
      expect.objectContaining({
        semanticLabel: 'Charles de Gaulle',
        publicAltText:
          'Portrait historique en noir et blanc d’un homme en uniforme.',
      }),
    );
    expect(isRichClosedImageAssetId('https://example.test/image.png')).toBe(
      false,
    );
    expect(getRichClosedImageAsset('unknown-asset')).toBeNull();
  });
});
