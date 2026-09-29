/* ----------------------------------------------------------------------------
   交线连续性示意图（程序页的"把最难段落变成图"）

   原文里最费解的一句是：「某处若有更年轻的界面压在下面，这张面在那一处就透明」，
   规则用「连续的有符号场」实现，而不是逐顶点的开关。这段文字要读三遍才懂，
   一张图一眼就懂：

     · 两条地层界面的交线（玫瑰实线）
     · 一个连续变化的有符号场，从正到负平滑穿过零值（冰蓝等值线，越密变化越快）
     · 透明区域从零值线开始——不是阶梯，所以不会出现网格状锯齿
     · 对照组：阶梯式开关（虚线）会偏离真实交线，标出偏差

   纯手写 SVG，不引图标库（skill 明确禁止手搓图标路径来冒充图标，
   但示意图不是图标，这里画的是真实几何关系，属于正当用途）。
   -------------------------------------------------------------------------- */

export default function FieldDiagram({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 640 340"
      className={className}
      role="img"
      aria-label="连续有符号场沿两条地层界面的交线平滑穿过零值，透明边界因此精确落在交线上；阶梯式开关则会产生锯齿偏差。"
    >
      <defs>
        {/* 有符号场的渐变：正区偏玫瑰，负区偏冰蓝，中间过渡带略亮 */}
        <linearGradient id="fieldGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#e0708f" stopOpacity="0.30" />
          <stop offset="42%" stopColor="#e0708f" stopOpacity="0.06" />
          <stop offset="58%" stopColor="#7fa8d8" stopOpacity="0.06" />
          <stop offset="100%" stopColor="#7fa8d8" stopOpacity="0.30" />
        </linearGradient>
        <linearGradient id="seamGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#e0708f" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#e0708f" stopOpacity="0.35" />
        </linearGradient>
      </defs>

      {/* 有符号场底纹 */}
      <rect x="40" y="60" width="560" height="180" fill="url(#fieldGrad)" />

      {/* 网格：暗示这是"离散格点"，而规则是定义在格点之上的连续场 */}
      <g stroke="#232329" strokeWidth="1">
        {Array.from({ length: 15 }, (_, i) => (
          <line key={`v${i}`} x1={40 + i * 40} y1="60" x2={40 + i * 40} y2="240" />
        ))}
        {Array.from({ length: 5 }, (_, i) => (
          <line key={`h${i}`} x1="40" y1={60 + i * 45} x2="600" y2={60 + i * 45} />
        ))}
      </g>

      {/* 等值线：越靠近零值越密 —— 这正是"连续场"的视觉特征 */}
      <g stroke="#7fa8d8" fill="none">
        {[
          { x: 118, o: 0.5 },
          { x: 176, o: 0.42 },
          { x: 232, o: 0.34 },
          { x: 282, o: 0.24 },
          { x: 320, o: 0.18 },
          { x: 358, o: 0.24 },
          { x: 408, o: 0.34 },
          { x: 464, o: 0.42 },
          { x: 522, o: 0.5 },
        ].map((c, i) => (
          <line
            key={i}
            x1={c.x}
            y1={240 - 180 * c.o}
            x2={c.x}
            y2={240 + 180 * c.o - 60}
            strokeWidth={1}
            strokeOpacity={0.35 + 0.35 * c.o}
          />
        ))}
      </g>

      {/* 零值线 = 透明边界：明确落在交线上 */}
      <line x1="320" y1="52" x2="320" y2="248" stroke="#ededf0" strokeWidth="1.5" strokeDasharray="3 4" strokeOpacity="0.75" />

      {/* 两条地层界面（俯视看是两条线，它们的交点就是交线） */}
      <line x1="40" y1="150" x2="600" y2="118" stroke="url(#seamGrad)" strokeWidth="2.5" />
      <line x1="40" y1="196" x2="600" y2="224" stroke="url(#seamGrad)" strokeWidth="2.5" />
      <circle cx="320" cy="176" r="5" fill="#e0708f" />
      <circle cx="320" cy="176" r="11" fill="none" stroke="#e0708f" strokeOpacity="0.45" />

      {/* 对照组：阶梯式开关会偏离交线 */}
      <g stroke="#5c5c64" strokeWidth="1.4" strokeDasharray="6 5">
        <line x1="40" y1="150" x2="280" y2="150" />
        <line x1="280" y1="150" x2="280" y2="204" />
        <line x1="280" y1="204" x2="600" y2="204" />
      </g>

      {/* 标注 */}
      <g
        fontFamily="'JetBrains Mono', monospace"
        fontSize="12"
        letterSpacing="0.06em"
        fill="#8b8b93"
      >
        <text x="40" y="34">CONTINUOUS SIGNED FIELD</text>
        <text x="600" y="34" textAnchor="end" fill="#e0708f">
          SEAM · EXACT
        </text>
      </g>

      <g fontFamily="'JetBrains Mono', monospace" fontSize="11.5" fill="#5c5c64">
        <text x="336" y="272">零值线 = 透明边界，精确落在交线上</text>
        <text x="600" y="300" textAnchor="end" fill="#5c5c64">
          虚线：逐顶点开关的阶梯近似，偏离交线 ▲
        </text>
        <text x="40" y="300">positive</text>
        <text x="40" y="322">negative</text>
      </g>

      <line x1="40" y1="306" x2="600" y2="306" stroke="#232329" strokeWidth="1" />
      <rect x="40" y="60" width="560" height="180" fill="none" stroke="#232329" strokeWidth="1" />
    </svg>
  );
}
