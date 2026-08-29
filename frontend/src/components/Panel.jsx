/**
 * Panel — the shared chrome around each of the dashboard's sections: header bar,
 * border, optional tab strip, and independent scrolling.
 *
 * Props:
 *   title      heading text
 *   icon       a lucide-react component, passed as `icon={CodeXml}` rather than
 *              `icon={<CodeXml/>}` — we want the component itself, so we can
 *              render it with our own size and colour below
 *   accent     theme colour name: "scan" | "parse" | "runtime"
 *   tabs       optional [{ id, label }] — omit for a panel with no tabs
 *   activeTab / onTabChange   which tab is selected, and how to change it
 *   children   panel body
 *   className  extra classes for the outer <section>
 */
export default function Panel({
  title,
  icon: Icon,
  accent = "runtime",
  tabs,
  activeTab,
  onTabChange,
  children,
  className = "",
}) {
  // Tailwind generates CSS by scanning for complete class strings, so it cannot
  // see a class built at runtime like `text-${accent}`. Mapping the options
  // explicitly keeps every class name literal and therefore findable.
  const accentText = { scan: "text-scan", parse: "text-parse", runtime: "text-runtime" }[accent];
  const accentBorder = { scan: "border-scan", parse: "border-parse", runtime: "border-runtime" }[accent];

  return (
    <section
      className={`flex min-h-0 flex-col overflow-hidden rounded-lg border border-edge bg-panel ${className}`}
    >
      <header className="flex shrink-0 items-center gap-2 border-b border-edge px-3 py-2">
        {Icon && <Icon size={14} className={accentText} aria-hidden="true" />}
        <h2 className="text-[11px] font-semibold tracking-wider text-dim uppercase">
          {title}
        </h2>
      </header>

      {/* Tabs render only when a `tabs` array was passed. */}
      {tabs && (
        <div role="tablist" className="flex shrink-0 border-b border-edge">
          {tabs.map((tab) => {
            const isActive = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                onClick={() => onTabChange(tab.id)}
                className={`-mb-px border-b-2 px-3 py-1.5 text-xs transition-colors ${
                  isActive
                    ? `${accentBorder} ${accentText} bg-panel-hi`
                    : "border-transparent text-dim hover:text-bright"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      )}

      {/* min-h-0 is the fix for a classic flexbox trap: a flex child refuses to
          shrink below its content's size by default, so `overflow-auto` never
          kicks in and the whole page grows instead of the panel scrolling. */}
      <div className="min-h-0 flex-1 overflow-auto">{children}</div>
    </section>
  );
}
