"use client";

import { useState } from "react";
import ArenaTabs from "./ArenaTabs";
import ExperimentLedger from "./ExperimentLedger";

// Client wrapper for the full /arena view: the arena drives comparisons, the
// ledger reviews them. A bumped refreshKey reloads the ledger after each save.

export default function ArenaWorkspace() {
  const [refreshKey, setRefreshKey] = useState(0);
  return (
    <div className="flex flex-col gap-10">
      <ArenaTabs onSaved={() => setRefreshKey((k) => k + 1)} />
      <ExperimentLedger refreshKey={refreshKey} />
    </div>
  );
}
