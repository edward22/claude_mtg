import type { ScryfallCard } from "../types";

export function cardImageUrl(card: ScryfallCard): string | undefined {
  return card.image_uris?.normal ?? card.card_faces?.[0]?.image_uris?.normal;
}

/**
 * Picks the smallest Scryfall image size that still looks sharp at the
 * printed card size, instead of always using "normal" (488x680px).
 *
 * Browsers' print/PDF pipelines generally embed the source image at its
 * full native resolution with a scale transform, rather than downsampling
 * it to the size it's actually displayed at - so a printer has to decode
 * and rescale every full-size image itself. For denser layouts (smaller
 * printed cards), that's far more pixel data than the page needs: even
 * the sparsest "9 per page" preset only prints a card ~2.6in wide, which
 * "normal" already renders at ~190 DPI, and the denser presets print
 * cards under 2in wide where Scryfall's "small" (146x204px) size is
 * still ~75-95 DPI - plenty for a proxy card, at roughly 1/11th the pixel
 * count of "normal".
 */
export function printImageUrl(card: ScryfallCard, cardsPerPage: number): string | undefined {
  const uris = card.image_uris ?? card.card_faces?.[0]?.image_uris;
  if (!uris) return undefined;
  const preferSmall = cardsPerPage >= 16;
  return (preferSmall ? uris.small ?? uris.normal : uris.normal ?? uris.small) ?? undefined;
}
