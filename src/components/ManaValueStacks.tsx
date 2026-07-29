import type { PoolCard } from "../types";
import CardTile from "./CardTile";
import "./ManaValueStacks.css";

const STACK_OFFSET_PX = 30;
const CARD_HEIGHT_PX = (96 * 88) / 63; // matches CardTile--small's rendered height

function isLand(card: PoolCard["card"]) {
  return card.type_line?.includes("Land") ?? false;
}

interface Column {
  label: string;
  cards: PoolCard[];
}

function buildColumns(cards: PoolCard[]): Column[] {
  const buckets: PoolCard[][] = Array.from({ length: 8 }, () => []);
  const lands: PoolCard[] = [];

  for (const pc of cards) {
    if (isLand(pc.card)) {
      lands.push(pc);
      continue;
    }
    const cmc = Math.min(7, Math.max(0, Math.floor(pc.card.cmc ?? 0)));
    buckets[cmc].push(pc);
  }

  const columns: Column[] = buckets.map((bucketCards, cmc) => ({
    label: cmc === 7 ? "7+" : String(cmc),
    cards: bucketCards,
  }));
  columns.push({ label: "Land", cards: lands });
  return columns;
}

interface ManaValueStacksProps {
  cards: PoolCard[];
  onCardClick: (pc: PoolCard) => void;
}

export default function ManaValueStacks({ cards, onCardClick }: ManaValueStacksProps) {
  const columns = buildColumns(cards);

  return (
    <div className="mana-stacks">
      {columns.map((col) => (
        <div className="mana-stacks__column" key={col.label}>
          <div className="mana-stacks__header">
            {col.label} <span className="mana-stacks__count">({col.cards.length})</span>
          </div>
          <div
            className="mana-stacks__stack"
            style={{ height: col.cards.length ? (col.cards.length - 1) * STACK_OFFSET_PX + CARD_HEIGHT_PX : CARD_HEIGHT_PX }}
          >
            {col.cards.map((pc, i) => (
              <div className="mana-stacks__card" style={{ top: i * STACK_OFFSET_PX }} key={pc.uid}>
                <CardTile card={pc.card} foil={pc.foil} onClick={() => onCardClick(pc)} size="small" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
