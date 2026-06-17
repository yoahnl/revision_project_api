export type RichClosedImageAssetKind =
  | 'historical_figure'
  | 'institution'
  | 'symbol'
  | 'document';

export type RichClosedImageAssetLicense =
  | 'public_domain'
  | 'own_generated'
  | 'open_license'
  | 'internal_placeholder';

export interface RichClosedImageAsset {
  id: string;
  kind: RichClosedImageAssetKind;
  semanticLabel: string;
  publicAltText: string;
  creditLabel?: string | null;
  license: RichClosedImageAssetLicense;
}

export const RICH_CLOSED_IMAGE_ASSETS = [
  {
    id: 'image-choice-historical-figure-001-v1',
    kind: 'historical_figure',
    semanticLabel: 'Charles de Gaulle',
    publicAltText:
      'Portrait historique en noir et blanc d’un homme en uniforme.',
    creditLabel: 'Asset de démonstration contrôlé',
    license: 'internal_placeholder',
  },
  {
    id: 'image-choice-historical-figure-002-v1',
    kind: 'historical_figure',
    semanticLabel: 'Napoléon Bonaparte',
    publicAltText: 'Portrait peint d’un homme en tenue impériale.',
    creditLabel: 'Asset de démonstration contrôlé',
    license: 'internal_placeholder',
  },
  {
    id: 'image-choice-historical-figure-003-v1',
    kind: 'historical_figure',
    semanticLabel: 'Simone Veil',
    publicAltText: 'Portrait historique d’une femme politique.',
    creditLabel: 'Asset de démonstration contrôlé',
    license: 'internal_placeholder',
  },
] as const satisfies readonly RichClosedImageAsset[];

export const RICH_CLOSED_IMAGE_ASSET_IDS = RICH_CLOSED_IMAGE_ASSETS.map(
  (asset) => asset.id,
) as [string, ...string[]];

const RICH_CLOSED_IMAGE_ASSETS_BY_ID = new Map<string, RichClosedImageAsset>(
  RICH_CLOSED_IMAGE_ASSETS.map((asset) => [asset.id, asset]),
);

export function isRichClosedImageAssetId(value: string): boolean {
  return RICH_CLOSED_IMAGE_ASSETS_BY_ID.has(value);
}

export function getRichClosedImageAsset(
  id: string,
): RichClosedImageAsset | null {
  return RICH_CLOSED_IMAGE_ASSETS_BY_ID.get(id) ?? null;
}
