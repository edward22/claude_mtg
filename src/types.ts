// Subset of the Scryfall card object we actually use.
// https://scryfall.com/docs/api/cards
export interface ScryfallImageUris {
  small?: string;
  normal?: string;
  large?: string;
  png?: string;
  art_crop?: string;
  border_crop?: string;
}

export interface ScryfallCardFace {
  name: string;
  mana_cost?: string;
  cmc?: number;
  type_line?: string;
  image_uris?: ScryfallImageUris;
  colors?: string[];
}

export type Rarity = "common" | "uncommon" | "rare" | "mythic" | "special" | "bonus";

export interface ScryfallCard {
  id: string;
  oracle_id?: string;
  name: string;
  set: string;
  set_name: string;
  collector_number: string;
  rarity: Rarity;
  mana_cost?: string;
  cmc: number;
  type_line: string;
  colors?: string[];
  color_identity?: string[];
  image_uris?: ScryfallImageUris;
  card_faces?: ScryfallCardFace[];
  booster: boolean;
  layout: string;
  lang: string;
  digital: boolean;
  full_art?: boolean;
  textless?: boolean;
  promo?: boolean;
  variation?: boolean;
  foil?: boolean;
  nonfoil?: boolean;
  frame_effects?: string[];
  border_color?: string;
  security_stamp?: string;
}

export interface ScryfallSet {
  id: string;
  code: string;
  name: string;
  set_type: string;
  released_at?: string;
  digital: boolean;
  nonfoil_only?: boolean;
  foil_only?: boolean;
  card_count: number;
  icon_svg_uri?: string;
  parent_set_code?: string;
}

export interface ScryfallList<T> {
  object: "list";
  data: T[];
  has_more: boolean;
  next_page?: string;
  total_cards?: number;
}

// A card instance sitting in the player's opened pool/deck. Cards can repeat
// across packs, so each copy gets its own uid distinct from the Scryfall id.
export interface PoolCard {
  uid: string;
  card: ScryfallCard;
  foil: boolean;
  fromLand: boolean; // true for lands added by the player outside of packs
}

export type BasicLandName = "Plains" | "Island" | "Swamp" | "Mountain" | "Forest" | "Wastes";

export interface SealedState {
  setCode: string | null;
  setName: string | null;
  packCount: number;
  pool: PoolCard[];
  deckUids: string[];
  openedPacks: PoolCard[][];
}
