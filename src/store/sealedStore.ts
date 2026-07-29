import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { BasicLandName, PoolCard, ScryfallCard, SealedState } from "../types";

function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36) + Math.random().toString(36).slice(2);
}

interface SealedStore extends SealedState {
  startSealedPool: (setCode: string, setName: string, packCount: number) => void;
  addOpenedPacks: (packs: PoolCard[][]) => void;
  moveToDeck: (uid: string) => void;
  moveToSideboard: (uid: string) => void;
  addBasicLand: (card: ScryfallCard, landName: BasicLandName) => void;
  removeLand: (uid: string) => void;
  resetSealedPool: () => void;
}

const initialState: SealedState = {
  setCode: null,
  setName: null,
  packCount: 6,
  pool: [],
  deckUids: [],
  openedPacks: [],
};

export const useSealedStore = create<SealedStore>()(
  persist(
    (set) => ({
      ...initialState,

      startSealedPool: (setCode, setName, packCount) =>
        set({ setCode, setName, packCount, pool: [], deckUids: [], openedPacks: [] }),

      addOpenedPacks: (packs) =>
        set((state) => ({
          openedPacks: [...state.openedPacks, ...packs],
          pool: [...state.pool, ...packs.flat()],
        })),

      moveToDeck: (cardUid) =>
        set((state) =>
          state.deckUids.includes(cardUid) ? state : { deckUids: [...state.deckUids, cardUid] }
        ),

      moveToSideboard: (cardUid) =>
        set((state) => ({ deckUids: state.deckUids.filter((u) => u !== cardUid) })),

      addBasicLand: (card, landName) => {
        const newUid = uid();
        const poolCard: PoolCard = { uid: newUid, card: { ...card, name: card.name || landName }, foil: false, fromLand: true };
        set((state) => ({ pool: [...state.pool, poolCard], deckUids: [...state.deckUids, newUid] }));
      },

      removeLand: (cardUid) =>
        set((state) => ({
          pool: state.pool.filter((p) => !(p.uid === cardUid && p.fromLand)),
          deckUids: state.deckUids.filter((u) => u !== cardUid),
        })),

      resetSealedPool: () => set(initialState),
    }),
    {
      name: "mtg-sealed-sim-state",
      version: 1,
    }
  )
);
