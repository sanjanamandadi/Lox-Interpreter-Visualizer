import { useState } from "react";
import { ChevronDown, ChevronRight, Dot } from "lucide-react";

/**
 * AstNode — a component that renders ITSELF for each child.
 *
 * This is the same shape as a recursive descent parser: one function handles one
 * node and calls itself for the sub-parts, and recursion handles arbitrary
 * depth. There is no loop over "levels" — you only describe one node correctly.
 *
 * Props:
 *   node      { id, type, label, detail, line, children[] }
 *   activeId  id of the node the interpreter is visiting right now
 *   depth     nesting level, used for indentation
 */
function AstNode({ node, activeId, depth }) {
  // State declared inside a component is per-instance, so 30 nodes means 30
  // independent collapsed flags with nothing to track centrally.
  const [collapsed, setCollapsed] = useState(false);

  const isActive = node.id === activeId;
  const children = node.children ?? [];
  const hasChildren = children.length > 0;

  // Statements vs. expressions get different accents, mirroring the two
  // separate Java files (Stmt.java and Expr.java) and two Visitor interfaces.
  const typeColor = node.type.startsWith("Stmt")
    ? "text-parse"
    : node.type.startsWith("Expr")
      ? "text-runtime"
      : "text-bright";

  return (
    <div>
      <div
        className={`group flex items-center gap-1 rounded px-1 py-px transition-colors ${
          isActive ? "bg-runtime/20 ring-1 ring-runtime/40" : "hover:bg-panel-hi"
        }`}
        // Indent by depth. An inline style is right here because the value is
        // genuinely dynamic — Tailwind can't generate a class for every depth.
        style={{ paddingLeft: `${depth * 14 + 4}px` }}
      >
        {hasChildren ? (
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="shrink-0 text-dim transition-colors hover:text-bright"
            aria-label={collapsed ? `Expand ${node.label}` : `Collapse ${node.label}`}
            aria-expanded={!collapsed}
          >
            {collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
          </button>
        ) : (
          <Dot size={12} className="shrink-0 text-dim/40" aria-hidden="true" />
        )}

        <span className={`text-[11px] ${typeColor} ${isActive ? "font-semibold" : ""}`}>
          {node.label}
        </span>

        {node.detail && (
          <span className="truncate text-[10px] text-dim">{node.detail}</span>
        )}

        {collapsed && (
          <span className="text-[10px] text-dim/60">({children.length} hidden)</span>
        )}

        <span className="ml-auto shrink-0 pl-2 text-[9px] text-dim/40 opacity-0 transition-opacity group-hover:opacity-100">
          ln {node.line}
        </span>
      </div>

      {/* The recursive step. `!collapsed &&` means a collapsed subtree isn't
          rendered at all — not merely hidden with CSS. */}
      {!collapsed &&
        children.map((child) => (
          <AstNode key={child.id} node={child} activeId={activeId} depth={depth + 1} />
        ))}
    </div>
  );
}

/**
 * AstTree (Panel 2, Tab 2) — the output of Parser.java.
 *
 * Props:
 *   ast       root node of the tree, or null when parsing produced nothing
 *   activeId  id of the node currently being visited
 */
export default function AstTree({ ast, activeId }) {
  if (!ast) {
    return (
      <div className="p-4 text-[11px] leading-relaxed text-dim">
        No syntax tree to show.
        <div className="mt-2">
          The parser stops at the first syntax error it can't recover from, so
          there is no tree to walk. Check the console for the message.
        </div>
      </div>
    );
  }

  return (
    <div className="p-2">
      <div className="mb-2 px-1 text-[10px] leading-relaxed text-dim">
        Output of <span className="text-parse">Parser.java</span>. Click a
        chevron to collapse. <span className="text-parse">Purple</span> = Stmt,{" "}
        <span className="text-runtime">blue</span> = Expr — the two Visitor
        interfaces.
      </div>
      <AstNode node={ast} activeId={activeId} depth={0} />
    </div>
  );
}
