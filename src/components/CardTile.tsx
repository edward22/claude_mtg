import type { ScryfallCard } from "../types";
import { cardImageUrl } from "../lib/cardImage";
import "./CardTile.css";

interface CardTileProps {
  card: ScryfallCard;
  foil?: boolean;
  onClick?: () => void;
  actionLabel?: string;
  size?: "small" | "normal";
}

export default function CardTile({ card, foil, onClick, actionLabel, size = "normal" }: CardTileProps) {
  const image = cardImageUrl(card);

  return (
    <button
      type="button"
      className={`card-tile card-tile--${size} ${foil ? "card-tile--foil" : ""}`}
      onClick={onClick}
      title={actionLabel ? `${card.name} - ${actionLabel}` : card.name}
    >
      {image ? (
        <img src={image} alt={card.name} loading="lazy" draggable={false} />
      ) : (
        <div className="card-tile__placeholder">
          <span className="card-tile__name">{card.name}</span>
          <span className="card-tile__type">{card.type_line}</span>
          {card.mana_cost && <span className="card-tile__mana">{card.mana_cost}</span>}
        </div>
      )}
      {actionLabel && <span className="card-tile__action">{actionLabel}</span>}
    </button>
  );
}
