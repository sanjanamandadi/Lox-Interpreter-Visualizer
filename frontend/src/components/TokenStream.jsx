/**
 * Render a number the way Java's Double.toString would: whole values keep a
 * trailing ".0", everything else prints in full. Every Lox number is a Java
 * double, and seeing `3.0` rather than `3` is the point of showing the literal
 * column at all — but rounding 3.14159 to 3.1 would be a lie.
 */
function javaDouble(value) {
  return Number.isInteger(value) ? value.toFixed(1) : String(value);
}

/**
 * Colour tokens by category so the stream is skimmable. Grouping by role rather
 * than giving 30 token types 30 different colours is the point — a reader should
 * see "keyword, name, literal, punctuation" at a glance.
 */
function tokenColor(type) {
  if (["VAR", "IF", "ELSE", "WHILE", "FOR", "PRINT", "AND", "OR", "TRUE", "FALSE", "NIL"].includes(type))
    return "text-parse";
  if (type === "IDENTIFIER") return "text-bright";
  if (type === "NUMBER") return "text-num";
  if (type === "STRING") return "text-str";
  if (type === "EOF") return "text-dim";
  return "text-scan"; // operators and punctuation
}

/**
 * TokenStream (Panel 2, Tab 1) — the flat output of Scanner.java.
 *
 * Props:
 *   tokens       [{ type, lexeme, literal, line }], mirroring the Token class
 *   activeIndex  token being produced right now (scan phase only)
 *   activeLine   source line to highlight during parse / interpret
 *   phase        "scan" | "parse" | "interpret"
 *
 * Two kinds of highlight, which is a deliberate teaching device:
 *   - During the SCAN phase we highlight one token at a time (`activeIndex`),
 *     because scanning genuinely produces them one at a time.
 *   - Afterwards we highlight every token on the current source line, since
 *     parsing and interpreting work with whole statements, not single tokens.
 *
 * That shift is the visual argument for why the pipeline has separate stages.
 */
export default function TokenStream({ tokens = [], activeIndex, activeLine, phase }) {
  return (
    <div className="p-2">
      <div className="mb-2 px-1 text-[10px] leading-relaxed text-dim">
        {tokens.length} tokens from <span className="text-scan">Scanner.java</span>.
        Fields mirror the <span className="text-bright">Token</span> class:
        type, lexeme, literal, line.
      </div>

      <table className="w-full border-collapse text-[11px]">
        <thead>
          <tr className="text-left text-[10px] uppercase tracking-wider text-dim">
            <th className="px-2 py-1 font-normal">#</th>
            <th className="px-2 py-1 font-normal">Type</th>
            <th className="px-2 py-1 font-normal">Lexeme</th>
            <th className="px-2 py-1 font-normal">Literal</th>
            <th className="px-2 py-1 font-normal">Ln</th>
          </tr>
        </thead>
        <tbody>
          {tokens.map((token, index) => {
            const isScanTarget = phase === "scan" && index === activeIndex;
            const isOnActiveLine = phase !== "scan" && token.line === activeLine;

            return (
              <tr
                key={index}
                className={`border-l-2 transition-colors ${
                  isScanTarget
                    ? "border-scan bg-scan/15"
                    : isOnActiveLine
                      ? "border-runtime/60 bg-runtime/10"
                      : "border-transparent hover:bg-panel-hi"
                }`}
              >
                <td className="px-2 py-0.5 text-dim/60">{index}</td>
                <td className={`px-2 py-0.5 whitespace-nowrap ${tokenColor(token.type)}`}>
                  {token.type}
                </td>
                <td className="px-2 py-0.5 text-bright">
                  {token.lexeme === "" ? (
                    <span className="text-dim italic">ε</span>
                  ) : (
                    token.lexeme
                  )}
                </td>
                <td className="px-2 py-0.5">
                  {/* Nearly every token has a null literal. Rendering it in a
                      muted style rather than hiding it makes the pattern
                      visible: only NUMBER and STRING carry runtime values. */}
                  {token.literal === null || token.literal === undefined ? (
                    <span className="text-dim/40">null</span>
                  ) : (
                    <span className={typeof token.literal === "number" ? "text-num" : "text-str"}>
                      {typeof token.literal === "number"
                        ? javaDouble(token.literal)
                        : `"${token.literal}"`}
                    </span>
                  )}
                </td>
                <td className="px-2 py-0.5 text-dim">{token.line}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
