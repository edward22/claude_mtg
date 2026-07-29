import { useMemo } from "react";
import type { PoolCard } from "../types";
import "./ManaCurveChart.css";

const COLOR_BUCKETS = ["W", "U", "B", "R", "G", "M", "C"] as const;
type ColorBucket = (typeof COLOR_BUCKETS)[number];

const BUCKET_COLOR: Record<ColorBucket, string> = {
  W: "#f8f6d8",
  U: "#8fc7f2",
  B: "#b0a8a0",
  R: "#f6977a",
  G: "#8fcea8",
  M: "#e0c26b",
  C: "#c9c9d1",
};

const BUCKET_LABEL: Record<ColorBucket, string> = {
  W: "White",
  U: "Blue",
  B: "Black",
  R: "Red",
  G: "Green",
  M: "Multicolor",
  C: "Colorless",
};

function bucketFor(card: PoolCard["card"]): ColorBucket {
  const colors = card.colors ?? card.card_faces?.flatMap((f) => f.colors ?? []) ?? [];
  const unique = [...new Set(colors)];
  if (unique.length === 0) return "C";
  if (unique.length > 1) return "M";
  return unique[0] as ColorBucket;
}

function isLand(card: PoolCard["card"]) {
  return card.type_line?.includes("Land") ?? false;
}

export default function ManaCurveChart({ cards }: { cards: PoolCard[] }) {
  const { buckets, maxCount, total } = useMemo(() => {
    const spellCards = cards.filter((pc) => !isLand(pc.card));
    const cmcBuckets: Record<number, Record<ColorBucket, number>> = {};
    for (let i = 0; i <= 7; i++) {
      cmcBuckets[i] = { W: 0, U: 0, B: 0, R: 0, G: 0, M: 0, C: 0 };
    }
    for (const pc of spellCards) {
      const cmc = Math.min(7, Math.floor(pc.card.cmc ?? 0));
      cmcBuckets[cmc][bucketFor(pc.card)] += 1;
    }
    const counts = Object.values(cmcBuckets).map((b) => COLOR_BUCKETS.reduce((sum, k) => sum + b[k], 0));
    return { buckets: cmcBuckets, maxCount: Math.max(1, ...counts), total: spellCards.length };
  }, [cards]);

  return (
    <div className="mana-curve">
      <div className="mana-curve__header">
        <h3>Mana curve</h3>
        <span className="mana-curve__total">{total} nonland cards</span>
      </div>
      <div className="mana-curve__chart">
        {Object.entries(buckets).map(([cmc, colorCounts]) => {
          const columnTotal = COLOR_BUCKETS.reduce((sum, k) => sum + colorCounts[k], 0);
          return (
            <div className="mana-curve__col" key={cmc}>
              <div className="mana-curve__count">{columnTotal || ""}</div>
              <div className="mana-curve__bar" style={{ height: `${(columnTotal / maxCount) * 100}%` }}>
                {COLOR_BUCKETS.filter((k) => colorCounts[k] > 0).map((k) => (
                  <div
                    key={k}
                    className="mana-curve__segment"
                    title={`${BUCKET_LABEL[k]}: ${colorCounts[k]}`}
                    style={{
                      flexGrow: colorCounts[k],
                      background: BUCKET_COLOR[k],
                    }}
                  />
                ))}
              </div>
              <div className="mana-curve__label">{cmc === "7" ? "7+" : cmc}</div>
            </div>
          );
        })}
      </div>
      <div className="mana-curve__legend">
        {COLOR_BUCKETS.map((k) => (
          <span key={k} className="mana-curve__legend-item">
            <span className="mana-curve__swatch" style={{ background: BUCKET_COLOR[k] }} />
            {BUCKET_LABEL[k]}
          </span>
        ))}
      </div>
    </div>
  );
}
