import type { ScryfallCard } from "../types";

export function cardImageUrl(card: ScryfallCard): string | undefined {
  return card.image_uris?.normal ?? card.card_faces?.[0]?.image_uris?.normal;
}

/**
 * Scryfall's "png" size (unlike normal/small/large, which are plain JPEG
 * rectangles) has real transparency in the card's rounded corners. On a
 * printed page those corners come out as clean white space blending into
 * the paper; the JPEG sizes fill that same area with a solid black wedge,
 * which reads as a visible defect once cards are cut out. Worth the extra
 * file size (745x1040px, larger than even "normal") for how it looks.
 */
export function printImageUrl(card: ScryfallCard): string | undefined {
  const uris = card.image_uris ?? card.card_faces?.[0]?.image_uris;
  if (!uris) return undefined;
  return uris.png ?? uris.large ?? uris.normal ?? uris.small;
}
