import { useEffect, useState } from "react";
import { useSealedStore } from "./store/sealedStore";
import SetPicker from "./components/SetPicker";
import PackOpener from "./components/PackOpener";
import DeckBuilder from "./components/DeckBuilder";
import FairUseFooter from "./components/FairUseFooter";
import "./App.css";

type Tab = "packs" | "deck";

function App() {
  const setCode = useSealedStore((s) => s.setCode);
  const setName = useSealedStore((s) => s.setName);
  const packCount = useSealedStore((s) => s.packCount);
  const openedPacks = useSealedStore((s) => s.openedPacks);
  const resetSealedPool = useSealedStore((s) => s.resetSealedPool);

  const [tab, setTab] = useState<Tab>("packs");

  // Re-derive which tab to land on whenever a sealed pool starts (fresh or
  // resumed from a persisted session) - without this, starting a new event
  // from the Deck Builder tab left you stranded there instead of on Open
  // Packs, since local tab state otherwise never resyncs on its own.
  useEffect(() => {
    if (setCode) setTab(openedPacks.length >= packCount ? "deck" : "packs");
    // Deliberately only on setCode change - not on every pack opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setCode]);

  return (
    <div className="app">
      {setCode && (
        <nav className="app__nav">
          <span className="app__nav-title">{setName}</span>
          <div className="app__nav-tabs">
            <button
              type="button"
              className={`app__nav-tab ${tab === "packs" ? "app__nav-tab--active" : ""}`}
              onClick={() => setTab("packs")}
            >
              Open Packs ({Math.min(openedPacks.length, packCount)}/{packCount})
            </button>
            <button
              type="button"
              className={`app__nav-tab ${tab === "deck" ? "app__nav-tab--active" : ""}`}
              onClick={() => setTab("deck")}
            >
              Deck Builder
            </button>
          </div>
          <button
            type="button"
            className="app__nav-reset"
            onClick={() => {
              if (confirm("Start a new sealed pool? This discards your current pool and deck.")) {
                resetSealedPool();
              }
            }}
          >
            New sealed pool
          </button>
        </nav>
      )}

      <main className="app__main">
        {!setCode && <SetPicker />}
        {setCode && tab === "packs" && <PackOpener />}
        {setCode && tab === "deck" && <DeckBuilder />}
      </main>

      <FairUseFooter />
    </div>
  );
}

export default App;
