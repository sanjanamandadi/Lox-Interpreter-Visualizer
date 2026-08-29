import { useState } from "react";
import { Binary } from "lucide-react";
import Panel from "./Panel.jsx";
import TokenStream from "./TokenStream.jsx";
import AstTree from "./AstTree.jsx";

const TABS = [
  { id: "tokens", label: "Token Stream" },
  { id: "ast", label: "AST" },
];

/**
 * SyntaxPanel (Panel 2) — syntax analysis: the token stream and the AST.
 *
 * Props:
 *   tokens             Scanner output, one { type, lexeme, literal, line } each
 *   ast                Parser output: the root node, or null if parsing failed
 *   phase              "scan" | "parse" | "interpret"
 *   activeTokenIndex   token to highlight during the scan phase
 *   activeLine         source line to highlight afterwards
 *   activeAstId        id of the AST node currently being visited
 *
 * `activeTab` lives here rather than in App, because nothing outside this panel
 * cares which tab is showing. Keep state as low in the tree as it will go: state
 * in App re-renders the whole app, state here re-renders one panel.
 *
 * The tab auto-follows the pipeline phase — scanning shows tokens, parsing shows
 * the tree — and only overrides a manual choice when the phase actually changes,
 * so clicking a tab isn't fought by the auto-switch.
 */
export default function SyntaxPanel({
  tokens,
  ast,
  phase,
  activeTokenIndex,
  activeLine,
  activeAstId,
}) {
  const [activeTab, setActiveTab] = useState("tokens");
  const [lastPhase, setLastPhase] = useState(phase);

  // Adjusting state during render (rather than in an effect) is React's
  // documented pattern for "derive state from a changed prop". React discards
  // this render and immediately re-runs it with the new value — no extra paint,
  // no flicker, and no useEffect needed.
  if (phase !== lastPhase) {
    setLastPhase(phase);
    setActiveTab(phase === "scan" ? "tokens" : "ast");
  }

  return (
    <Panel
      title="Syntax Analysis"
      icon={Binary}
      accent={phase === "scan" ? "scan" : "parse"}
      tabs={TABS}
      activeTab={activeTab}
      onTabChange={setActiveTab}
    >
      {activeTab === "tokens" ? (
        <TokenStream
          tokens={tokens}
          activeIndex={activeTokenIndex}
          activeLine={activeLine}
          phase={phase}
        />
      ) : (
        <AstTree ast={ast} activeId={activeAstId} />
      )}
    </Panel>
  );
}
