import { useState } from "react";
import { Cpu } from "lucide-react";
import Panel from "./Panel.jsx";
import VisitorStack from "./VisitorStack.jsx";
import ScopeStack from "./ScopeStack.jsx";

const TABS = [
  { id: "visitor", label: "Visitor Stack" },
  { id: "scopes", label: "Scope Stack" },
];

/**
 * RuntimePanel (Panel 3) — runtime execution: the visitor stack and the
 * environment chain.
 *
 * Props:
 *   stack   visitor call stack, outermost first
 *   scopes  environment chain, index 0 = global
 *   phase   "scan" | "parse" | "interpret"
 *
 * Structurally identical to SyntaxPanel: local tab state, delegate to one child
 * per tab. With only two tabbed panels, factoring out a shared "TabbedPanel"
 * would cost more indirection than it saves.
 */
export default function RuntimePanel({ stack, scopes, phase }) {
  const [activeTab, setActiveTab] = useState("visitor");

  return (
    <Panel
      title="Runtime Execution"
      icon={Cpu}
      accent="runtime"
      tabs={TABS}
      activeTab={activeTab}
      onTabChange={setActiveTab}
    >
      {activeTab === "visitor" ? (
        <VisitorStack stack={stack} phase={phase} />
      ) : (
        <ScopeStack scopes={scopes} phase={phase} />
      )}
    </Panel>
  );
}
