import type { ScryfallCard } from "../types";

export function cardImageUrl(card: ScryfallCard): string | undefined {
  return card.image_uris?.normal ?? card.card_faces?.[0]?.image_uris?.normal;
}
