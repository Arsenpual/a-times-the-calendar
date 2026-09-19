import React from "react";

const categories = [
  { name: "Work", color: "#4D83A8" },
  { name: "Personal", color: "#A66A45" },
  { name: "Health", color: "#C76532" },
  { name: "Cleaning", color: "#6E9B63" },
  { name: "Exercise", color: "#3E78B2" },
];

const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Mock stream shapes. Replace with real chart data later.
const streams = [
  {
    name: "Work",
    color: "#4D83A8",
    path: "M70 240 C145 220 205 210 270 205 C335 198 395 165 460 175 C525 184 590 150 655 155 C720 160 785 125 850 140 C915 155 980 118 1050 130 C1120 142 1175 110 1230 120 L1230 180 C1170 170 1120 195 1050 180 C980 165 915 195 850 185 C785 172 720 205 655 198 C590 190 525 215 460 208 C395 200 335 225 270 230 C205 236 145 245 70 255 Z",
  },
  {
    name: "Personal",
    color: "#A66A45",
    path: "M70 255 C145 250 205 245 270 230 C335 225 395 200 460 208 C525 215 590 190 655 198 C720 205 785 172 850 185 C915 195 980 165 1050 180 C1120 195 1170 170 1230 180 L1230 230 C1170 215 1120 225 1050 215 C980 205 915 230 850 220 C785 208 720 238 655 230 C590 220 525 240 460 235 C395 228 335 245 270 250 C205 255 145 262 70 268 Z",
  },
  {
    name: "Health",
    color: "#C76532",
    path: "M70 268 C145 262 205 255 270 250 C335 245 395 228 460 235 C525 240 590 220 655 230 C720 238 785 208 850 220 C915 230 980 205 1050 215 C1120 225 1170 215 1230 230 L1230 260 C1170 250 1120 252 1050 245 C980 238 915 255 850 248 C785 238 720 265 655 255 C590 248 525 265 460 258 C395 250 335 265 270 268 C205 270 145 274 70 276 Z",
  },
  {
    name: "Cleaning",
    color: "#6E9B63",
    path: "M70 276 C145 274 205 270 270 268 C335 265 395 250 460 258 C525 265 590 248 655 255 C720 265 785 238 850 248 C915 255 980 238 1050 245 C1120 252 1170 250 1230 260 L1230 278 C1170 270 1120 270 1050 265 C980 260 915 272 850 266 C785 258 720 282 655 272 C590 266 525 282 460 274 C395 267 335 280 270 280 C205 282 145 282 70 284 Z",
  },
  {
    name: "Exercise",
    color: "#3E78B2",
    path: "M70 284 C145 282 205 282 270 280 C335 280 395 267 460 274 C525 282 590 266 655 272 C720 282 785 258 850 266 C915 272 980 260 1050 265 C1120 270 1170 270 1230 278 L1230 288 C1170 282 1120 284 1050 278 C980 274 915 282 850 278 C785 270 720 290 655 282 C590 278 525 292 460 284 C395 278 335 290 270 289 C205 290 145 290 70 292 Z",
  },
];

export default function StreamgraphMockup() {
  return (
    <div style={styles.page}>
      <div style={styles.shell}>
        <header style={styles.header}>
          <div>
            <div style={styles.eyebrow}>CYCLE SUMMARY</div>
            <h1 style={styles.title}>Life Flow</h1>
            <div style={styles.subtitle}>September 14 – September 20, 2026 · 7 Days</div>
          </div>
          <button style={styles.scaleButton}>7 Days <span>⌄</span></button>
        </header>

        <section style={styles.chartCard}>
          <div style={styles.chartTop}>
            <div>
              <div style={styles.chartLabel}>ACCUMULATED TIME</div>
              <div style={styles.chartHint}>How your time flowed through the week</div>
            </div>
            <div style={styles.readOnly}>READ ONLY</div>
          </div>

          <div style={styles.chart}>
            <div style={styles.yAxis}>
              {["16h", "12h", "8h", "4h", "0h"].map((v) => (
                <span key={v}>{v}</span>
              ))}
            </div>

            <div style={styles.plot}>
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} style={{ ...styles.grid, top: `${i * 25}%` }} />
              ))}

              {streams.map((stream) => (
                <svg
                  key={stream.name}
                  viewBox="0 0 1300 300"
                  preserveAspectRatio="none"
                  style={styles.streamSvg}
                >
                  <path d={stream.path} fill={stream.color} opacity="0.92" />
                </svg>
              ))}

              <div style={styles.hoverLine} />
              <div style={styles.hoverDot} />
              <div style={styles.tooltip}>
                <strong>Wednesday · Sep 16</strong>
                <div style={styles.tipRow}><span>Work</span><b>7h 30m</b></div>
                <div style={styles.tipRow}><span>Personal</span><b>2h 00m</b></div>
                <div style={styles.tipRow}><span>Health</span><b>1h 00m</b></div>
                <div style={styles.tipRow}><span>Cleaning</span><b>0h 45m</b></div>
                <div style={styles.tipTotal}><span>Total</span><b>12h 15m</b></div>
              </div>

              <div style={styles.xAxis}>
                {days.map((day) => <span key={day}>{day}</span>)}
              </div>
            </div>
          </div>

          <div style={styles.legend}>
            {categories.map((cat) => (
              <div key={cat.name} style={styles.legendItem}>
                <span style={{ ...styles.dot, background: cat.color }} />
                {cat.name}
              </div>
            ))}
          </div>
        </section>

        <section style={styles.stats}>
          <div><span>Total tracked</span><strong>84h 20m</strong></div>
          <div><span>Most time</span><strong>Work · 42h</strong></div>
          <div><span>Active days</span><strong>7 / 7</strong></div>
          <div><span>Categories</span><strong>5</strong></div>
        </section>

        <div style={styles.insight}>
          <span style={styles.insightMark}>↗</span>
          <div>
            <strong>Wednesday had the lowest tracked time.</strong>
            <p>Tap a day to inspect its time composition.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#101110",
    color: "#F2F1ED",
    fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
    padding: 32,
    boxSizing: "border-box",
  },
  shell: {
    maxWidth: 1320,
    margin: "0 auto",
  },
  header: {
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  eyebrow: {
    fontSize: 11,
    letterSpacing: "0.18em",
    opacity: 0.5,
    marginBottom: 8,
  },
  title: {
    fontSize: 34,
    lineHeight: 1,
    margin: 0,
    fontWeight: 650,
    letterSpacing: "-0.03em",
  },
  subtitle: {
    marginTop: 9,
    fontSize: 13,
    opacity: 0.58,
  },
  scaleButton: {
    background: "#1C1D1B",
    color: "#F2F1ED",
    border: "1px solid rgba(242,241,237,.12)",
    borderRadius: 12,
    padding: "11px 15px",
    fontSize: 13,
  },
  chartCard: {
    background: "#171817",
    border: "1px solid rgba(242,241,237,.08)",
    borderRadius: 22,
    padding: 24,
    boxShadow: "0 20px 60px rgba(0,0,0,.22)",
  },
  chartTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 18,
  },
  chartLabel: {
    fontSize: 10,
    letterSpacing: "0.16em",
    opacity: 0.45,
  },
  chartHint: {
    marginTop: 6,
    fontSize: 14,
    opacity: 0.72,
  },
  readOnly: {
    fontSize: 10,
    letterSpacing: "0.12em",
    padding: "6px 9px",
    borderRadius: 99,
    border: "1px solid rgba(242,241,237,.1)",
    opacity: 0.45,
  },
  chart: {
    height: 390,
    display: "flex",
  },
  yAxis: {
    width: 45,
    paddingTop: 4,
    paddingBottom: 38,
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    fontSize: 10,
    opacity: 0.38,
  },
  plot: {
    position: "relative",
    flex: 1,
    overflow: "hidden",
    borderRadius: 12,
  },
  grid: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 1,
    background: "rgba(242,241,237,.06)",
    zIndex: 0,
  },
  streamSvg: {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    zIndex: 1,
  },
  hoverLine: {
    position: "absolute",
    top: 0,
    bottom: 38,
    left: "44%",
    width: 1,
    borderLeft: "1px dashed rgba(242,241,237,.4)",
    zIndex: 3,
  },
  hoverDot: {
    position: "absolute",
    width: 8,
    height: 8,
    borderRadius: "50%",
    left: "calc(44% - 4px)",
    top: "34%",
    background: "#F2F1ED",
    boxShadow: "0 0 0 4px rgba(242,241,237,.14)",
    zIndex: 4,
  },
  tooltip: {
    position: "absolute",
    zIndex: 5,
    top: 28,
    left: "calc(44% + 15px)",
    width: 180,
    background: "#222421",
    border: "1px solid rgba(242,241,237,.12)",
    borderRadius: 13,
    padding: 12,
    fontSize: 11,
    boxShadow: "0 14px 30px rgba(0,0,0,.35)",
  },
  tipRow: {
    display: "flex",
    justifyContent: "space-between",
    marginTop: 7,
    opacity: 0.72,
  },
  tipTotal: {
    display: "flex",
    justifyContent: "space-between",
    marginTop: 10,
    paddingTop: 8,
    borderTop: "1px solid rgba(242,241,237,.08)",
  },
  xAxis: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 30,
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "space-between",
    fontSize: 10,
    opacity: 0.42,
    zIndex: 6,
  },
  legend: {
    display: "flex",
    flexWrap: "wrap",
    gap: 18,
    marginTop: 16,
    paddingLeft: 45,
    fontSize: 11,
    opacity: 0.72,
  },
  legendItem: {
    display: "flex",
    alignItems: "center",
    gap: 7,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    display: "inline-block",
  },
  stats: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 12,
    marginTop: 14,
  },
  statCard: {
    display: "flex",
    flexDirection: "column",
    gap: 7,
    padding: "13px 15px",
    borderRadius: 15,
    background: "#171817",
    border: "1px solid rgba(242,241,237,.07)",
  },
  statsLabel: {},
  insight: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginTop: 14,
    padding: "14px 16px",
    borderRadius: 15,
    background: "#171817",
    border: "1px solid rgba(242,241,237,.07)",
  },
  insightMark: {
    fontSize: 20,
    opacity: 0.65,
  },
};

styles.stats = {
  ...styles.stats,
};
