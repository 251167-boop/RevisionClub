"use client";

import renderer from "@/lib/club/visual-renderer.cjs";

const { buildVisualModel } = renderer;
const ink = "#263c30",
  muted = "#718071",
  pale = "#eef2e9",
  accent = "#8fa47b";

function label(value, fallback) {
  return value || fallback;
}
function ArrowMarker() {
  return (
    <defs>
      <marker
        id="figure-arrow"
        viewBox="0 0 10 10"
        refX="8"
        refY="5"
        markerWidth="6"
        markerHeight="6"
        orient="auto-start-reverse"
      >
        <path d="M 0 0 L 10 5 L 0 10 z" fill={ink} />
      </marker>
    </defs>
  );
}
function EmptySpecification({ model }) {
  return (
    <g>
      <rect
        x="35"
        y="45"
        width="450"
        height="175"
        rx="8"
        fill={pale}
        stroke={accent}
      />
      <text
        x="260"
        y="115"
        textAnchor="middle"
        fontSize="17"
        fontWeight="700"
        fill={ink}
      >
        {model.title}
      </text>
      <foreignObject x="65" y="135" width="390" height="62">
        <div
          xmlns="http://www.w3.org/1999/xhtml"
          className="figure-description"
        >
          {model.description}
        </div>
      </foreignObject>
    </g>
  );
}
function CartesianFigure({ model }) {
  if (model.type === "number_line") {
    const min = model.xMin,
      max = model.xMax,
      count = Math.min(20, Math.max(2, max - min));
    return (
      <svg viewBox="0 0 520 160" role="img" aria-label={model.altText}>
        <ArrowMarker />
        <text x="260" y="25" textAnchor="middle" className="figure-title">
          {model.title}
        </text>
        <line
          x1="40"
          y1="82"
          x2="480"
          y2="82"
          stroke={ink}
          strokeWidth="2"
          markerStart="url(#figure-arrow)"
          markerEnd="url(#figure-arrow)"
        />
        {Array.from({ length: count + 1 }, (_, index) => {
          const x = 50 + (index / count) * 420,
            value = min + ((max - min) * index) / count;
          return (
            <g key={index}>
              <line x1={x} y1="74" x2={x} y2="90" stroke={ink} />
              <text x={x} y="110" textAnchor="middle" fontSize="11">
                {Number(value.toFixed(1))}
              </text>
            </g>
          );
        })}
      </svg>
    );
  }
  const left = 55,
    top = 30,
    width = 420,
    height = 210,
    xMin = model.xMin < model.xMax ? model.xMin : -5,
    xMax = model.xMin < model.xMax ? model.xMax : 5,
    yMin = model.yMin < model.yMax ? model.yMin : -5,
    yMax = model.yMin < model.yMax ? model.yMax : 5,
    sx = (x) => left + ((x - xMin) / (xMax - xMin)) * width,
    sy = (y) => top + height - ((y - yMin) / (yMax - yMin)) * height,
    xAxis = Math.max(top, Math.min(top + height, sy(0))),
    yAxis = Math.max(left, Math.min(left + width, sx(0)));
  let points = model.points;
  if (!points.length && model.equation) {
    points = Array.from({ length: 81 }, (_, index) => {
      const x = xMin + ((xMax - xMin) * index) / 80,
        equation = model.equation,
        y =
          equation.kind === "quadratic"
            ? equation.a * x * x + (equation.b || 0) * x + equation.c
            : equation.m * x + equation.b;
      return { x, y };
    }).filter((point) => point.y >= yMin - 1 && point.y <= yMax + 1);
  }
  const path = points
    .map(
      (point, index) =>
        `${index ? "L" : "M"}${sx(point.x).toFixed(1)},${sy(point.y).toFixed(1)}`,
    )
    .join(" ");
  return (
    <svg viewBox="0 0 520 270" role="img" aria-label={model.altText}>
      <ArrowMarker />
      {Array.from({ length: 11 }, (_, index) => (
        <line
          key={`v${index}`}
          x1={left + index * 42}
          y1={top}
          x2={left + index * 42}
          y2={top + height}
          stroke="#dce2d7"
        />
      ))}
      {Array.from({ length: 11 }, (_, index) => (
        <line
          key={`h${index}`}
          x1={left}
          y1={top + index * 21}
          x2={left + width}
          y2={top + index * 21}
          stroke="#dce2d7"
        />
      ))}
      <rect
        x={left}
        y={top}
        width={width}
        height={height}
        fill="none"
        stroke={muted}
      />
      <line
        x1={left}
        y1={xAxis}
        x2={left + width}
        y2={xAxis}
        stroke={ink}
        strokeWidth="1.5"
        markerEnd="url(#figure-arrow)"
      />
      <line
        x1={yAxis}
        y1={top + height}
        x2={yAxis}
        y2={top}
        stroke={ink}
        strokeWidth="1.5"
        markerEnd="url(#figure-arrow)"
      />
      <text x={left + width + 12} y={xAxis + 4} fontSize="12">
        {model.xLabel}
      </text>
      <text x={yAxis + 8} y={top - 8} fontSize="12">
        {model.yLabel}
      </text>
      <text x={left} y={top + height + 18} fontSize="10">
        {xMin}
      </text>
      <text
        x={left + width}
        y={top + height + 18}
        textAnchor="end"
        fontSize="10"
      >
        {xMax}
      </text>
      <text x={left - 8} y={top + 5} textAnchor="end" fontSize="10">
        {yMax}
      </text>
      <text x={left - 8} y={top + height} textAnchor="end" fontSize="10">
        {yMin}
      </text>
      {path && <path d={path} fill="none" stroke="#416d58" strokeWidth="2.5" />}
      {model.points.map((point, index) => (
        <circle key={index} cx={sx(point.x)} cy={sy(point.y)} r="4" fill={ink}>
          <title>{point.label || `${point.x}, ${point.y}`}</title>
        </circle>
      ))}
    </svg>
  );
}
function pieSlicePath(cx, cy, radius, start, end) {
  const point = (angle) => [
      cx + radius * Math.cos(angle),
      cy + radius * Math.sin(angle),
    ],
    [x1, y1] = point(start),
    [x2, y2] = point(end),
    large = end - start > Math.PI ? 1 : 0;
  return `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${large} 1 ${x2} ${y2} Z`;
}
function ChartFigure({ model }) {
  const values = model.values,
    labels = model.labels,
    ready = values.length && labels.length,
    colors = ["#385f4c", "#78916a", "#aab99a", "#c9d2bd", "#657c70", "#94a88a"];
  if (!ready)
    return (
      <svg viewBox="0 0 520 260" role="img" aria-label={model.altText}>
        <EmptySpecification model={model} />
      </svg>
    );
  if (model.type === "pie_chart") {
    const total =
        values.reduce((sum, value) => sum + Math.max(0, value), 0) || 1,
      slices = values.map((value, index) => {
        const before = values
            .slice(0, index)
            .reduce((sum, item) => sum + Math.max(0, item), 0),
          start = -Math.PI / 2 + (before / total) * Math.PI * 2,
          end = start + (Math.max(0, value) / total) * Math.PI * 2;
        return pieSlicePath(175, 145, 90, start, end);
      });
    return (
      <svg viewBox="0 0 520 280" role="img" aria-label={model.altText}>
        <text x="260" y="22" textAnchor="middle" className="figure-title">
          {model.title}
        </text>
        {values.map((value, index) => (
          <path
            key={index}
            d={slices[index]}
            fill={colors[index % colors.length]}
            stroke="#fff"
          >
            <title>
              {labels[index]}: {value}
            </title>
          </path>
        ))}
        {labels.map((item, index) => (
          <g key={item} transform={`translate(310 ${70 + index * 25})`}>
            <rect width="14" height="14" fill={colors[index % colors.length]} />
            <text x="22" y="12" fontSize="12">
              {item}: {values[index]}
            </text>
          </g>
        ))}
      </svg>
    );
  }
  const max = Math.max(
      ...values.map(Math.abs),
      ...model.secondaryValues.map(Math.abs),
      1,
    ),
    chartWidth = 400,
    step = chartWidth / values.length,
    lineValues =
      model.type === "climate_graph" && model.secondaryValues.length
        ? model.secondaryValues
        : values,
    linePoints = lineValues
      .map(
        (value, index) =>
          `${70 + step * (index + 0.5)},${220 - (Math.max(0, value) / max) * 160}`,
      )
      .join(" ");
  if (model.type === "population_pyramid") {
    const center = 260,
      half = 175;
    return (
      <svg viewBox="0 0 520 285" role="img" aria-label={model.altText}>
        <text x="260" y="22" textAnchor="middle" className="figure-title">
          {model.title}
        </text>
        <line x1={center} y1="45" x2={center} y2="245" stroke={ink} />
        {values.map((value, index) => {
          const right = model.secondaryValues[index] ?? value,
            y = 55 + index * (180 / values.length),
            leftWidth = (Math.abs(value) / max) * half,
            rightWidth = (Math.abs(right) / max) * half;
          return (
            <g key={index}>
              <rect
                x={center - leftWidth}
                y={y}
                width={leftWidth}
                height={Math.max(8, 150 / values.length)}
                fill="#78916a"
              />
              <rect
                x={center}
                y={y}
                width={rightWidth}
                height={Math.max(8, 150 / values.length)}
                fill="#385f4c"
              />
              <text
                x={center}
                y={y + 9}
                textAnchor="middle"
                fontSize="9"
                fill="#fff"
              >
                {labels[index]}
              </text>
            </g>
          );
        })}
      </svg>
    );
  }
  const drawBars = !["line_graph", "scatter_plot"].includes(model.type),
    drawLine = model.type === "line_graph" || model.type === "climate_graph";
  return (
    <svg viewBox="0 0 520 270" role="img" aria-label={model.altText}>
      <text x="260" y="22" textAnchor="middle" className="figure-title">
        {model.title}
      </text>
      <line x1="55" y1="220" x2="480" y2="220" stroke={ink} />
      <line x1="55" y1="45" x2="55" y2="220" stroke={ink} />
      {drawLine && (
        <polyline
          points={linePoints}
          fill="none"
          stroke="#416d58"
          strokeWidth="3"
        />
      )}
      {values.map((value, index) => {
        const height = (Math.max(0, value) / max) * 160,
          x = 70 + index * step,
          pointValue =
            model.type === "climate_graph" ? lineValues[index] : value,
          pointHeight = (Math.max(0, pointValue || 0) / max) * 160;
        return (
          <g key={index}>
            {drawBars && (
              <rect
                x={x}
                y={220 - height}
                width={
                  model.type === "histogram" ? step : Math.max(8, step - 12)
                }
                height={height}
                fill={colors[index % colors.length]}
              />
            )}
            {(drawLine || model.type === "scatter_plot") && (
              <circle
                cx={x + step / 2}
                cy={220 - pointHeight}
                r="4"
                fill={ink}
              />
            )}
            <text x={x + step / 2} y="240" textAnchor="middle" fontSize="10">
              {labels[index]}
            </text>
            <text
              x={x + step / 2}
              y={Math.max(40, 214 - height)}
              textAnchor="middle"
              fontSize="10"
            >
              {value}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
function GeometryFigure({ model }) {
  const labels = model.labels;
  return (
    <svg viewBox="0 0 520 270" role="img" aria-label={model.altText}>
      <ArrowMarker />
      <text x="260" y="24" textAnchor="middle" className="figure-title">
        {model.title}
      </text>
      {model.type === "circle" ? (
        <g>
          <circle
            cx="260"
            cy="142"
            r="85"
            fill="none"
            stroke={ink}
            strokeWidth="2"
          />
          <line x1="260" y1="142" x2="345" y2="142" stroke={ink} />
          <circle cx="260" cy="142" r="3" fill={ink} />
          <text x="300" y="134" fontSize="12">
            {label(labels[0], "r")}
          </text>
        </g>
      ) : model.type === "angle" ? (
        <g>
          <line
            x1="180"
            y1="205"
            x2="260"
            y2="120"
            stroke={ink}
            strokeWidth="2"
          />
          <line
            x1="260"
            y1="120"
            x2="390"
            y2="175"
            stroke={ink}
            strokeWidth="2"
          />
          <path
            d="M 230 152 A 42 42 0 0 1 299 137"
            fill="none"
            stroke={accent}
            strokeWidth="2"
          />
          <text x="278" y="158" fontSize="12">
            {label(labels[0], "θ")}
          </text>
        </g>
      ) : model.type === "solid_3d" ? (
        <g>
          <path
            d="M160 90 L330 90 L390 135 L220 135 Z M160 90 V200 L220 240 V135 M220 240 H390 V135 M330 90 V200 L390 240"
            fill="none"
            stroke={ink}
            strokeWidth="2"
          />
          <line
            x1="160"
            y1="200"
            x2="330"
            y2="200"
            stroke={muted}
            strokeDasharray="5 4"
          />
          <line
            x1="330"
            y1="200"
            x2="390"
            y2="240"
            stroke={muted}
            strokeDasharray="5 4"
          />
        </g>
      ) : model.type === "net" ? (
        <g fill="none" stroke={ink} strokeWidth="2">
          <rect x="210" y="95" width="70" height="70" />
          <rect x="140" y="95" width="70" height="70" />
          <rect x="280" y="95" width="70" height="70" />
          <rect x="350" y="95" width="70" height="70" />
          <rect x="210" y="25" width="70" height="70" />
          <rect x="210" y="165" width="70" height="70" />
        </g>
      ) : model.type === "symmetry" || model.type === "transformation" ? (
        <g>
          <path
            d="M125 205 L205 70 L250 205 Z"
            fill={pale}
            stroke={ink}
            strokeWidth="2"
          />
          <line
            x1="275"
            y1="45"
            x2="275"
            y2="230"
            stroke={muted}
            strokeDasharray="6 5"
          />
          <path
            d="M400 205 L320 70 L275 205 Z"
            fill="none"
            stroke={ink}
            strokeWidth="2"
          />
          <text x="290" y="60" fontSize="11">
            mirror line
          </text>
        </g>
      ) : (
        <g>
          <polygon
            points={
              model.type === "quadrilateral"
                ? "145,205 175,70 370,95 395,205"
                : model.type === "polygon"
                  ? "260,52 365,110 325,220 195,220 155,110"
                  : "130,210 260,55 405,210"
            }
            fill={pale}
            stroke={ink}
            strokeWidth="2"
          />
          {labels.slice(0, 5).map((item, index) => (
            <text
              key={item}
              x={[120, 255, 410, 365, 155][index]}
              y={[225, 47, 225, 105, 105][index]}
              fontSize="12"
            >
              {item}
            </text>
          ))}
        </g>
      )}
    </svg>
  );
}
function DocumentFigure({ model }) {
  const items = model.labels.length
    ? model.labels
    : ["Heading", "Key information", "Details"];
  if (
    model.type === "table" ||
    model.type === "timetable" ||
    model.type === "menu"
  )
    return (
      <svg viewBox="0 0 520 270" role="img" aria-label={model.altText}>
        <text x="260" y="24" textAnchor="middle" className="figure-title">
          {model.title}
        </text>
        <rect x="55" y="45" width="410" height="185" fill="#fff" stroke={ink} />
        {Array.from({ length: Math.min(5, items.length + 1) }, (_, index) => (
          <line
            key={index}
            x1="55"
            y1={45 + index * 37}
            x2="465"
            y2={45 + index * 37}
            stroke={muted}
          />
        ))}
        <line x1="190" y1="45" x2="190" y2="230" stroke={muted} />
        {items.slice(0, 5).map((item, index) => (
          <text key={item} x="70" y={69 + index * 37} fontSize="12">
            {item}
          </text>
        ))}
      </svg>
    );
  return (
    <svg viewBox="0 0 520 270" role="img" aria-label={model.altText}>
      <rect
        x="55"
        y="25"
        width="410"
        height="220"
        rx="5"
        fill="#fff"
        stroke={ink}
        strokeWidth="2"
      />
      <rect x="75" y="48" width="370" height="48" fill={pale} />
      <text x="260" y="78" textAnchor="middle" fontSize="19" fontWeight="700">
        {model.title}
      </text>
      {items.slice(0, 4).map((item, index) => (
        <g key={item}>
          <circle cx="93" cy={125 + index * 28} r="5" fill={accent} />
          <text x="110" y={130 + index * 28} fontSize="12">
            {item}
          </text>
        </g>
      ))}
    </svg>
  );
}
function ScienceFigure({ model }) {
  const items = model.labels.length ? model.labels : ["A", "B", "C"];
  if (model.type === "particle_diagram")
    return (
      <svg viewBox="0 0 520 250" role="img" aria-label={model.altText}>
        <text x="260" y="24" textAnchor="middle" className="figure-title">
          {model.title}
        </text>
        {[85, 260, 435].map((cx, group) => (
          <g key={cx}>
            <rect
              x={cx - 62}
              y="55"
              width="124"
              height="145"
              fill="none"
              stroke={ink}
            />
            {Array.from({ length: 12 }, (_, index) => {
              const tight = group === 0,
                x = tight
                  ? cx - 42 + (index % 4) * 28
                  : cx - 48 + ((index * 37) % 96),
                y = tight
                  ? 90 + Math.floor(index / 4) * 28
                  : 70 + ((index * 53) % 112);
              return (
                <circle
                  key={index}
                  cx={x}
                  cy={y}
                  r="7"
                  fill={group === 2 && index % 2 ? accent : ink}
                />
              );
            })}
            <text x={cx} y="220" textAnchor="middle" fontSize="11">
              {items[group] || `State ${group + 1}`}
            </text>
          </g>
        ))}
      </svg>
    );
  if (model.type === "electric_circuit")
    return (
      <svg viewBox="0 0 520 250" role="img" aria-label={model.altText}>
        <text x="260" y="24" textAnchor="middle" className="figure-title">
          {model.title}
        </text>
        <path
          d="M110 70 H410 V190 H110 Z"
          fill="none"
          stroke={ink}
          strokeWidth="2"
        />
        <line x1="225" y1="62" x2="225" y2="78" stroke={ink} strokeWidth="2" />
        <line x1="240" y1="55" x2="240" y2="85" stroke={ink} strokeWidth="3" />
        <circle
          cx="330"
          cy="70"
          r="27"
          fill="#fff"
          stroke={ink}
          strokeWidth="2"
        />
        <path d="M312 52 L348 88 M348 52 L312 88" stroke={ink} />
        <path d="M175 190 L210 165" stroke={ink} strokeWidth="2" />
        <circle cx="170" cy="190" r="4" fill={ink} />
        <circle cx="215" cy="190" r="4" fill={ink} />
      </svg>
    );
  if (model.type === "force_diagram")
    return (
      <svg viewBox="0 0 520 260" role="img" aria-label={model.altText}>
        <ArrowMarker />
        <text x="260" y="24" textAnchor="middle" className="figure-title">
          {model.title}
        </text>
        <rect
          x="210"
          y="105"
          width="100"
          height="65"
          fill={pale}
          stroke={ink}
          strokeWidth="2"
        />
        <line
          x1="260"
          y1="105"
          x2="260"
          y2="48"
          stroke={ink}
          strokeWidth="2"
          markerEnd="url(#figure-arrow)"
        />
        <line
          x1="260"
          y1="170"
          x2="260"
          y2="230"
          stroke={ink}
          strokeWidth="2"
          markerEnd="url(#figure-arrow)"
        />
        <line
          x1="210"
          y1="138"
          x2="125"
          y2="138"
          stroke={ink}
          strokeWidth="2"
          markerEnd="url(#figure-arrow)"
        />
        <line
          x1="310"
          y1="138"
          x2="395"
          y2="138"
          stroke={ink}
          strokeWidth="2"
          markerEnd="url(#figure-arrow)"
        />
        <text x="270" y="55" fontSize="11">
          {label(items[0], "normal")}
        </text>
        <text x="270" y="226" fontSize="11">
          {label(items[1], "weight")}
        </text>
        <text x="115" y="130" textAnchor="end" fontSize="11">
          {label(items[2], "resistance")}
        </text>
        <text x="405" y="130" fontSize="11">
          {label(items[3], "force")}
        </text>
      </svg>
    );
  if (model.type === "ray_diagram")
    return (
      <svg viewBox="0 0 520 260" role="img" aria-label={model.altText}>
        <ArrowMarker />
        <text x="260" y="24" textAnchor="middle" className="figure-title">
          {model.title}
        </text>
        <line x1="260" y1="45" x2="260" y2="230" stroke={ink} strokeWidth="3" />
        <line
          x1="70"
          y1="138"
          x2="450"
          y2="138"
          stroke={muted}
          strokeDasharray="5 4"
        />
        <line
          x1="90"
          y1="70"
          x2="255"
          y2="135"
          stroke={ink}
          strokeWidth="2"
          markerEnd="url(#figure-arrow)"
        />
        <line
          x1="265"
          y1="135"
          x2="430"
          y2="70"
          stroke={ink}
          strokeWidth="2"
          markerEnd="url(#figure-arrow)"
        />
        <path
          d="M215 138 A45 45 0 0 1 220 120 M300 120 A45 45 0 0 1 305 138"
          fill="none"
          stroke={accent}
          strokeWidth="2"
        />
      </svg>
    );
  if (model.type === "apparatus" || model.type === "laboratory_setup")
    return (
      <svg viewBox="0 0 520 275" role="img" aria-label={model.altText}>
        <text x="260" y="24" textAnchor="middle" className="figure-title">
          {model.title}
        </text>
        <path
          d="M210 55 H310 M235 55 V135 L175 230 H345 L285 135 V55"
          fill="none"
          stroke={ink}
          strokeWidth="2"
        />
        <path
          d="M205 185 Q260 205 315 185 L338 225 H183 Z"
          fill="#dce8d5"
          stroke={accent}
        />
        <rect x="390" y="80" width="28" height="145" fill="none" stroke={ink} />
        <line x1="390" y1="115" x2="375" y2="115" stroke={ink} />
        <line x1="390" y1="150" x2="375" y2="150" stroke={ink} />
        <line x1="390" y1="185" x2="375" y2="185" stroke={ink} />
        {items.slice(0, 3).map((item, index) => (
          <text
            key={item}
            x={[95, 355, 425][index]}
            y={[105, 210, 85][index]}
            fontSize="11"
          >
            {item}
          </text>
        ))}
      </svg>
    );
  if (
    [
      "plant_cell",
      "animal_cell",
      "biology_diagram",
      "organ",
      "body_system",
    ].includes(model.type)
  )
    return (
      <svg viewBox="0 0 520 280" role="img" aria-label={model.altText}>
        <text x="260" y="24" textAnchor="middle" className="figure-title">
          {model.title}
        </text>
        <path
          d={
            model.type === "plant_cell"
              ? "M120 55 H395 Q420 55 420 80 V215 Q420 240 395 240 H120 Q95 240 95 215 V80 Q95 55 120 55 Z"
              : "M105 145 C105 55 185 35 260 60 C335 35 420 75 410 160 C405 235 320 245 255 220 C180 250 105 225 105 145 Z"
          }
          fill={pale}
          stroke={ink}
          strokeWidth="2"
        />
        <circle cx="250" cy="145" r="38" fill="#fff" stroke={ink} />
        <ellipse
          cx="160"
          cy="110"
          rx="34"
          ry="17"
          fill="#fff"
          stroke={accent}
        />
        <ellipse
          cx="345"
          cy="185"
          rx="36"
          ry="17"
          fill="#fff"
          stroke={accent}
        />
        {items.slice(0, 3).map((item, index) => (
          <g key={item}>
            <line
              x1={[220, 145, 360][index]}
              y1={[125, 105, 180][index]}
              x2={[70, 55, 455][index]}
              y2={[75, 125, 205][index]}
              stroke={muted}
            />
            <text
              x={[65, 50, 460][index]}
              y={[70, 120, 210][index]}
              textAnchor={index === 2 ? "start" : "end"}
              fontSize="11"
            >
              {item}
            </text>
          </g>
        ))}
      </svg>
    );
  return <FlowFigure model={model} />;
}
function MapFigure({ model }) {
  const items = model.labels.length ? model.labels : ["A", "B", "C"];
  return (
    <svg viewBox="0 0 520 275" role="img" aria-label={model.altText}>
      <ArrowMarker />
      <text x="260" y="24" textAnchor="middle" className="figure-title">
        {model.title}
      </text>
      {model.type === "contour_diagram" ? (
        <g fill="none" stroke={ink}>
          {[110, 85, 60, 35].map((radius, index) => (
            <ellipse
              key={radius}
              cx="260"
              cy="140"
              rx={radius * 1.45}
              ry={radius}
              strokeWidth={index === 3 ? 2 : 1}
            />
          ))}
          <line
            x1="115"
            y1="140"
            x2="405"
            y2="140"
            stroke={accent}
            strokeDasharray="5 4"
          />
        </g>
      ) : model.type === "cross_section" ||
        model.type === "river_profile" ||
        model.type === "landform_diagram" ? (
        <g>
          <path
            d="M55 220 C110 205 125 90 190 100 S260 210 320 160 S390 80 465 190 L465 230 H55 Z"
            fill={pale}
            stroke={ink}
            strokeWidth="2"
          />
          <line x1="55" y1="230" x2="465" y2="230" stroke={ink} />
        </g>
      ) : model.type === "drainage_basin" ? (
        <g fill="none" stroke={ink} strokeWidth="2">
          <path
            d="M85 65 C160 110 190 135 260 225"
            markerEnd="url(#figure-arrow)"
          />
          <path d="M170 55 C205 105 220 135 260 225" />
          <path d="M390 60 C320 115 300 155 260 225" />
          <path d="M440 120 C355 145 315 180 260 225" />
        </g>
      ) : (
        <g>
          <path
            d="M105 75 L175 48 L235 88 L305 55 L420 100 L390 215 L300 230 L210 205 L120 225 L75 145 Z"
            fill={pale}
            stroke={ink}
            strokeWidth="2"
          />
          {items.slice(0, 5).map((item, index) => (
            <g key={item}>
              <circle
                cx={[155, 235, 330, 190, 355][index]}
                cy={[115, 150, 120, 190, 190][index]}
                r="5"
                fill={ink}
              />
              <text
                x={[165, 245, 340, 200, 365][index]}
                y={[110, 145, 115, 185, 185][index]}
                fontSize="11"
              >
                {item}
              </text>
            </g>
          ))}
        </g>
      )}
    </svg>
  );
}
function FlowFigure({ model }) {
  const cycle = ["scientific_cycle", "water_cycle", "rock_cycle"].includes(
      model.type,
    ),
    items = (
      model.labels.length ? model.labels : ["Stage 1", "Stage 2", "Stage 3"]
    ).slice(0, 6);
  if (model.type === "venn_diagram")
    return (
      <svg viewBox="0 0 520 250" role="img" aria-label={model.altText}>
        <text x="260" y="24" textAnchor="middle" className="figure-title">
          {model.title}
        </text>
        <circle
          cx="215"
          cy="135"
          r="82"
          fill="#dce8d5"
          fillOpacity=".7"
          stroke={ink}
        />
        <circle
          cx="305"
          cy="135"
          r="82"
          fill="#bdceb4"
          fillOpacity=".7"
          stroke={ink}
        />
        <text x="170" y="135" textAnchor="middle">
          {label(items[0], "Set A")}
        </text>
        <text x="350" y="135" textAnchor="middle">
          {label(items[1], "Set B")}
        </text>
      </svg>
    );
  if (model.type === "probability_tree")
    return (
      <svg viewBox="0 0 520 270" role="img" aria-label={model.altText}>
        <text x="260" y="24" textAnchor="middle" className="figure-title">
          {model.title}
        </text>
        <circle cx="70" cy="140" r="4" fill={ink} />
        <path
          d="M74 138 L220 75 M74 142 L220 205 M224 73 L405 45 M224 77 L405 105 M224 203 L405 165 M224 207 L405 225"
          fill="none"
          stroke={ink}
          strokeWidth="2"
        />
        {items.slice(0, 6).map((item, index) => (
          <text
            key={item}
            x={index < 2 ? 150 : 420}
            y={index < 2 ? [92, 197][index] : [50, 110, 170, 230][index - 2]}
            fontSize="11"
          >
            {item}
          </text>
        ))}
      </svg>
    );
  if (model.type === "plate_tectonics")
    return (
      <svg viewBox="0 0 520 270" role="img" aria-label={model.altText}>
        <ArrowMarker />
        <text x="260" y="24" textAnchor="middle" className="figure-title">
          {model.title}
        </text>
        <path
          d="M45 135 H225 L260 165 L295 135 H475 V225 H45 Z"
          fill={pale}
          stroke={ink}
          strokeWidth="2"
        />
        <path d="M260 165 V235" stroke={ink} strokeDasharray="5 4" />
        <line
          x1="210"
          y1="105"
          x2="120"
          y2="105"
          stroke={ink}
          strokeWidth="2"
          markerEnd="url(#figure-arrow)"
        />
        <line
          x1="310"
          y1="105"
          x2="400"
          y2="105"
          stroke={ink}
          strokeWidth="2"
          markerEnd="url(#figure-arrow)"
        />
        <path
          d="M240 160 C230 125 245 95 260 70 C275 95 290 125 280 160"
          fill="#d7dfc9"
          stroke={accent}
        />
        <text x="120" y="95" textAnchor="middle" fontSize="11">
          {label(items[0], "Plate A")}
        </text>
        <text x="400" y="95" textAnchor="middle" fontSize="11">
          {label(items[1], "Plate B")}
        </text>
      </svg>
    );
  if (
    [
      "decision_tree",
      "relationship_diagram",
      "dynasty_relationship",
      "political_structure",
      "social_hierarchy",
      "government_structure",
      "concept_map",
      "family_tree",
    ].includes(model.type)
  ) {
    const root = items[0] || "Central idea",
      children = items.slice(1, 4),
      childXs = [130, 260, 390];
    return (
      <svg viewBox="0 0 520 280" role="img" aria-label={model.altText}>
        <text x="260" y="24" textAnchor="middle" className="figure-title">
          {model.title}
        </text>
        <rect
          x="200"
          y="50"
          width="120"
          height="44"
          rx="8"
          fill={pale}
          stroke={ink}
        />
        <text x="260" y="77" textAnchor="middle" fontSize="11">
          {root}
        </text>
        {children.map((item, index) => (
          <g key={item}>
            <path
              d={`M260 94 V125 H${childXs[index]} V158`}
              fill="none"
              stroke={ink}
            />
            <rect
              x={childXs[index] - 55}
              y="158"
              width="110"
              height="44"
              rx="7"
              fill="#fff"
              stroke={ink}
            />
            <text x={childXs[index]} y="184" textAnchor="middle" fontSize="10">
              {item}
            </text>
          </g>
        ))}
        {items.slice(4, 6).map((item, index) => (
          <g key={item}>
            <line
              x1={childXs[index]}
              y1="202"
              x2={childXs[index]}
              y2="225"
              stroke={ink}
            />
            <rect
              x={childXs[index] - 48}
              y="225"
              width="96"
              height="34"
              rx="6"
              fill={pale}
              stroke={muted}
            />
            <text x={childXs[index]} y="246" textAnchor="middle" fontSize="9">
              {item}
            </text>
          </g>
        ))}
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 520 270" role="img" aria-label={model.altText}>
      <ArrowMarker />
      <text x="260" y="24" textAnchor="middle" className="figure-title">
        {model.title}
      </text>
      {items.map((item, index) => {
        const angle = cycle
            ? (index / items.length) * Math.PI * 2 - Math.PI / 2
            : 0,
          x = cycle
            ? 260 + Math.cos(angle) * 155
            : 70 + index * (380 / Math.max(1, items.length - 1)),
          y = cycle ? 145 + Math.sin(angle) * 75 : 135;
        return (
          <g key={`${item}-${index}`}>
            <rect
              x={x - 55}
              y={y - 24}
              width="110"
              height="48"
              rx="9"
              fill={pale}
              stroke={ink}
            />
            <text x={x} y={y + 4} textAnchor="middle" fontSize="11">
              {item}
            </text>
            {index < items.length - 1 &&
              (() => {
                const nextAngle = cycle
                    ? ((index + 1) / items.length) * Math.PI * 2 - Math.PI / 2
                    : 0,
                  nx = cycle
                    ? 260 + Math.cos(nextAngle) * 155
                    : 70 + (index + 1) * (380 / Math.max(1, items.length - 1)),
                  ny = cycle ? 145 + Math.sin(nextAngle) * 75 : 135;
                return (
                  <line
                    x1={x + (cycle ? 0 : 55)}
                    y1={y + (cycle ? 24 : 0)}
                    x2={nx - (cycle ? 0 : 58)}
                    y2={ny - (cycle ? 24 : 0)}
                    stroke={ink}
                    markerEnd="url(#figure-arrow)"
                  />
                );
              })()}
          </g>
        );
      })}
    </svg>
  );
}

function HistoryFigure({ model }) {
  const items = (
      model.labels.length
        ? model.labels
        : ["Event 1", "Event 2", "Event 3", "Event 4"]
    ).slice(0, 6),
    values = model.values;
  return (
    <svg viewBox="0 0 520 270" role="img" aria-label={model.altText}>
      <ArrowMarker />
      <text x="260" y="24" textAnchor="middle" className="figure-title">
        {model.title}
      </text>
      <line
        x1="55"
        y1="135"
        x2="475"
        y2="135"
        stroke={ink}
        strokeWidth="2"
        markerEnd="url(#figure-arrow)"
      />
      {items.map((item, index) => {
        const x = 75 + index * (370 / Math.max(1, items.length - 1)),
          above = index % 2 === 0;
        return (
          <g key={`${item}-${index}`}>
            <circle cx={x} cy="135" r="6" fill={index % 2 ? accent : ink} />
            <line x1={x} y1="135" x2={x} y2={above ? 92 : 178} stroke={muted} />
            <text x={x} y={above ? 76 : 202} textAnchor="middle" fontSize="10">
              {item}
            </text>
            {values[index] !== undefined && (
              <text
                x={x}
                y={above ? 91 : 217}
                textAnchor="middle"
                fontSize="9"
                fill={muted}
              >
                {values[index]}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function EconomicsFigure({ model }) {
  if (model.type !== "supply_demand_graph")
    return model.values.length ? (
      <ChartFigure model={model} />
    ) : (
      <svg viewBox="0 0 520 260" role="img" aria-label={model.altText}>
        <EmptySpecification model={model} />
      </svg>
    );
  return (
    <svg viewBox="0 0 520 280" role="img" aria-label={model.altText}>
      <ArrowMarker />
      <text x="260" y="24" textAnchor="middle" className="figure-title">
        {model.title}
      </text>
      <line
        x1="75"
        y1="230"
        x2="470"
        y2="230"
        stroke={ink}
        strokeWidth="2"
        markerEnd="url(#figure-arrow)"
      />
      <line
        x1="75"
        y1="230"
        x2="75"
        y2="45"
        stroke={ink}
        strokeWidth="2"
        markerEnd="url(#figure-arrow)"
      />
      <line
        x1="115"
        y1="205"
        x2="415"
        y2="70"
        stroke="#527461"
        strokeWidth="3"
      />
      <line
        x1="115"
        y1="70"
        x2="415"
        y2="205"
        stroke="#9b7457"
        strokeWidth="3"
      />
      <circle cx="265" cy="137.5" r="5" fill={ink} />
      <line
        x1="265"
        y1="137.5"
        x2="265"
        y2="230"
        stroke={muted}
        strokeDasharray="5 4"
      />
      <line
        x1="75"
        y1="137.5"
        x2="265"
        y2="137.5"
        stroke={muted}
        strokeDasharray="5 4"
      />
      <text x="420" y="70" fontSize="12">
        S
      </text>
      <text x="420" y="208" fontSize="12">
        D
      </text>
      <text x="272" y="130" fontSize="10">
        E
      </text>
      <text x="460" y="250" fontSize="11">
        {model.xLabel === "x" ? "Quantity" : model.xLabel}
      </text>
      <text x="40" y="50" fontSize="11">
        {model.yLabel === "y" ? "Price" : model.yLabel}
      </text>
    </svg>
  );
}

function IctFigure({ model }) {
  const items = (
    model.labels.length ? model.labels : ["Input", "Process", "Output"]
  ).slice(0, 6);
  if (model.type === "ui_mockup")
    return (
      <svg viewBox="0 0 520 280" role="img" aria-label={model.altText}>
        <text x="260" y="24" textAnchor="middle" className="figure-title">
          {model.title}
        </text>
        <rect
          x="65"
          y="42"
          width="390"
          height="205"
          rx="7"
          fill="#fff"
          stroke={ink}
          strokeWidth="2"
        />
        <rect
          x="65"
          y="42"
          width="390"
          height="30"
          rx="7"
          fill={pale}
          stroke={ink}
        />
        {[82, 96, 110].map((x) => (
          <circle key={x} cx={x} cy="57" r="4" fill={accent} />
        ))}
        <rect
          x="85"
          y="92"
          width="95"
          height="130"
          fill={pale}
          stroke={muted}
        />
        <rect
          x="200"
          y="92"
          width="230"
          height="48"
          fill="#fff"
          stroke={muted}
        />
        <rect
          x="200"
          y="157"
          width="108"
          height="65"
          fill="#fff"
          stroke={muted}
        />
        <rect
          x="322"
          y="157"
          width="108"
          height="65"
          fill="#fff"
          stroke={muted}
        />
      </svg>
    );
  if (model.type === "database_relationship")
    return (
      <svg viewBox="0 0 520 280" role="img" aria-label={model.altText}>
        <text x="260" y="24" textAnchor="middle" className="figure-title">
          {model.title}
        </text>
        {[125, 395].map((x, index) => (
          <g key={x}>
            <rect
              x={x - 75}
              y="70"
              width="150"
              height="145"
              fill="#fff"
              stroke={ink}
            />
            <rect
              x={x - 75}
              y="70"
              width="150"
              height="34"
              fill={pale}
              stroke={ink}
            />
            <text
              x={x}
              y="91"
              textAnchor="middle"
              fontSize="11"
              fontWeight="700"
            >
              {items[index] || `Entity ${index + 1}`}
            </text>
            {[125, 153, 181].map((y, row) => (
              <line
                key={y}
                x1={x - 75}
                y1={y}
                x2={x + 75}
                y2={y}
                stroke={muted}
              />
            ))}
          </g>
        ))}
        <line
          x1="200"
          y1="143"
          x2="320"
          y2="143"
          stroke={ink}
          strokeWidth="2"
        />
        <text x="215" y="136" fontSize="12">
          1
        </text>
        <text x="300" y="136" fontSize="12">
          ∞
        </text>
      </svg>
    );
  if (model.type === "binary_data")
    return (
      <svg viewBox="0 0 520 240" role="img" aria-label={model.altText}>
        <text x="260" y="24" textAnchor="middle" className="figure-title">
          {model.title}
        </text>
        {Array.from({ length: 16 }, (_, index) => (
          <g key={index}>
            <rect
              x={48 + (index % 8) * 53}
              y={65 + Math.floor(index / 8) * 72}
              width="42"
              height="48"
              rx="5"
              fill={index % 3 ? pale : "#fff"}
              stroke={ink}
            />
            <text
              x={69 + (index % 8) * 53}
              y={96 + Math.floor(index / 8) * 72}
              textAnchor="middle"
              fontSize="17"
            >
              {index % 3 ? "1" : "0"}
            </text>
          </g>
        ))}
      </svg>
    );
  if (model.type === "logic_diagram")
    return (
      <svg viewBox="0 0 520 250" role="img" aria-label={model.altText}>
        <text x="260" y="24" textAnchor="middle" className="figure-title">
          {model.title}
        </text>
        <line x1="65" y1="90" x2="180" y2="90" stroke={ink} strokeWidth="2" />
        <line x1="65" y1="160" x2="180" y2="160" stroke={ink} strokeWidth="2" />
        <path
          d="M180 65 H240 C315 65 315 185 240 185 H180 Z"
          fill={pale}
          stroke={ink}
          strokeWidth="2"
        />
        <line
          x1="292"
          y1="125"
          x2="440"
          y2="125"
          stroke={ink}
          strokeWidth="2"
        />
        <text x="55" y="94" textAnchor="end" fontSize="11">
          {items[0] || "A"}
        </text>
        <text x="55" y="164" textAnchor="end" fontSize="11">
          {items[1] || "B"}
        </text>
        <text x="450" y="129" fontSize="11">
          {items[2] || "Q"}
        </text>
      </svg>
    );
  const network = [
      "network_diagram",
      "cybersecurity_network",
      "system_diagram",
    ].includes(model.type),
    positions = [
      [260, 62],
      [115, 145],
      [260, 145],
      [405, 145],
      [185, 225],
      [335, 225],
    ];
  return (
    <svg viewBox="0 0 520 280" role="img" aria-label={model.altText}>
      <ArrowMarker />
      <text x="260" y="24" textAnchor="middle" className="figure-title">
        {model.title}
      </text>
      {positions.slice(1, items.length).map(([x, y], index) => (
        <line
          key={`${x}-${y}`}
          x1="260"
          y1="82"
          x2={x}
          y2={y - 20}
          stroke={muted}
          markerEnd={network ? undefined : "url(#figure-arrow)"}
        />
      ))}
      {items.map((item, index) => {
        const [x, y] = positions[index] || positions.at(-1);
        return (
          <g key={`${item}-${index}`}>
            <rect
              x={x - 54}
              y={y - 20}
              width="108"
              height="40"
              rx={network ? 20 : 5}
              fill={index ? "#fff" : pale}
              stroke={ink}
            />
            <text x={x} y={y + 4} textAnchor="middle" fontSize="10">
              {item}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function noteY(note, index) {
  const order = [
    "C4",
    "D4",
    "E4",
    "F4",
    "G4",
    "A4",
    "B4",
    "C5",
    "D5",
    "E5",
    "F5",
  ];
  const position = order.indexOf(String(note || "").toUpperCase());
  return 178 - (position >= 0 ? position : index % 9) * 8;
}
function MusicFigure({ model }) {
  const items = (
    model.labels.length ? model.labels : ["C4", "D4", "E4", "F4", "G4"]
  ).slice(0, 12);
  if (model.type === "keyboard_diagram")
    return (
      <svg viewBox="0 0 520 240" role="img" aria-label={model.altText}>
        <text x="260" y="24" textAnchor="middle" className="figure-title">
          {model.title}
        </text>
        {Array.from({ length: 10 }, (_, index) => (
          <rect
            key={index}
            x={35 + index * 45}
            y="55"
            width="45"
            height="145"
            fill="#fff"
            stroke={ink}
          />
        ))}
        {[0, 1, 3, 4, 5, 7, 8].map((index) => (
          <rect
            key={index}
            x={66 + index * 45}
            y="55"
            width="28"
            height="88"
            fill={ink}
          />
        ))}
        {items.slice(0, 10).map((item, index) => (
          <text
            key={`${item}-${index}`}
            x={57 + index * 45}
            y="220"
            textAnchor="middle"
            fontSize="9"
          >
            {item}
          </text>
        ))}
      </svg>
    );
  if (model.type === "instrument_family")
    return <FlowFigure model={{ ...model, type: "relationship_diagram" }} />;
  if (model.type === "chord_diagram")
    return (
      <svg viewBox="0 0 520 270" role="img" aria-label={model.altText}>
        <text x="260" y="24" textAnchor="middle" className="figure-title">
          {model.title}
        </text>
        {Array.from({ length: 6 }, (_, index) => (
          <line
            key={`v${index}`}
            x1={175 + index * 34}
            y1="55"
            x2={175 + index * 34}
            y2="225"
            stroke={ink}
            strokeWidth={index === 0 ? 4 : 1}
          />
        ))}
        {Array.from({ length: 6 }, (_, index) => (
          <line
            key={`h${index}`}
            x1="175"
            y1={55 + index * 34}
            x2="345"
            y2={55 + index * 34}
            stroke={ink}
          />
        ))}
        {[0, 2, 4].map((stringIndex, index) => (
          <circle
            key={stringIndex}
            cx={175 + stringIndex * 34}
            cy={72 + (index + 1) * 34}
            r="9"
            fill={ink}
          />
        ))}
      </svg>
    );
  if (model.type === "rests")
    return (
      <svg viewBox="0 0 520 250" role="img" aria-label={model.altText}>
        <text x="260" y="24" textAnchor="middle" className="figure-title">
          {model.title}
        </text>
        {Array.from({ length: 5 }, (_, index) => (
          <line
            key={index}
            x1="55"
            y1={85 + index * 18}
            x2="475"
            y2={85 + index * 18}
            stroke={ink}
          />
        ))}
        {items.map((item, index) => (
          <g key={`${item}-${index}`}>
            <text
              x={125 + index * (290 / Math.max(1, items.length - 1))}
              y="150"
              textAnchor="middle"
              fontFamily="serif"
              fontSize="40"
            >
              𝄽
            </text>
            <text
              x={125 + index * (290 / Math.max(1, items.length - 1))}
              y="210"
              textAnchor="middle"
              fontSize="9"
            >
              {item}
            </text>
          </g>
        ))}
      </svg>
    );
  return (
    <svg viewBox="0 0 520 260" role="img" aria-label={model.altText}>
      <text x="260" y="24" textAnchor="middle" className="figure-title">
        {model.title}
      </text>
      {Array.from({ length: 5 }, (_, index) => (
        <line
          key={index}
          x1="55"
          y1={100 + index * 16}
          x2="475"
          y2={100 + index * 16}
          stroke={ink}
        />
      ))}
      <text x="65" y="169" fontSize="75" fontFamily="serif">
        {model.type === "bass_clef" ? "𝄢" : "𝄞"}
      </text>
      {model.type === "time_signature" && (
        <g fontSize="26" fontWeight="700">
          <text x="145" y="126">
            4
          </text>
          <text x="145" y="157">
            4
          </text>
        </g>
      )}
      {items.map((item, index) => {
        const x = 155 + index * (290 / Math.max(1, items.length));
        return (
          <g key={`${item}-${index}`}>
            <ellipse
              cx={x}
              cy={noteY(item, index)}
              rx="8"
              ry="6"
              transform={`rotate(-18 ${x} ${noteY(item, index)})`}
              fill={ink}
            />
            <line
              x1={x + 7}
              y1={noteY(item, index)}
              x2={x + 7}
              y2={noteY(item, index) - 38}
              stroke={ink}
              strokeWidth="2"
            />
            {model.type === "note_identification" && (
              <text x={x} y="215" textAnchor="middle" fontSize="10">
                {index + 1}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function ReligiousFigure({ model }) {
  const items = model.labels;
  if (model.type === "place_of_worship")
    return (
      <svg viewBox="0 0 520 270" role="img" aria-label={model.altText}>
        <text x="260" y="24" textAnchor="middle" className="figure-title">
          {model.title}
        </text>
        <path
          d="M110 225 H410 V110 L260 52 L110 110 Z"
          fill={pale}
          stroke={ink}
          strokeWidth="2"
        />
        <rect
          x="225"
          y="155"
          width="70"
          height="70"
          rx="35"
          fill="#fff"
          stroke={ink}
        />
        {[155, 365].map((x, index) => (
          <g key={x}>
            <rect
              x={x - 23}
              y="128"
              width="46"
              height="45"
              fill="#fff"
              stroke={muted}
            />
            <text x={x} y="195" textAnchor="middle" fontSize="9">
              {items[index] || `Area ${index + 1}`}
            </text>
          </g>
        ))}
      </svg>
    );
  return (
    <svg viewBox="0 0 520 260" role="img" aria-label={model.altText}>
      <text x="260" y="24" textAnchor="middle" className="figure-title">
        {model.title}
      </text>
      <circle
        cx="260"
        cy="135"
        r="88"
        fill={pale}
        stroke={ink}
        strokeWidth="2"
      />
      <rect
        x="218"
        y="88"
        width="84"
        height="94"
        rx="24"
        fill="#fff"
        stroke={ink}
      />
      <line x1="235" y1="112" x2="285" y2="112" stroke={muted} />
      <line x1="235" y1="128" x2="285" y2="128" stroke={muted} />
      <text x="260" y="140" textAnchor="middle" fontSize="11">
        {items[0] || "Symbol"}
      </text>
    </svg>
  );
}

function PlaceholderFigure({ model, strategy }) {
  const source = strategy === "source_image";
  return (
    <svg viewBox="0 0 520 260" role="img" aria-label={model.altText}>
      <rect
        x="55"
        y="35"
        width="410"
        height="180"
        rx="8"
        fill="#fafbf7"
        stroke={ink}
        strokeWidth="1.5"
        strokeDasharray="7 5"
      />
      <path
        d="M180 175 L235 112 L275 150 L315 102 L390 175 Z"
        fill={pale}
        stroke={accent}
      />
      <circle cx="175" cy="90" r="18" fill="#d7dfc9" />
      <text x="260" y="235" textAnchor="middle" fontSize="11" fill={muted}>
        {source
          ? "Source image to be supplied"
          : "Illustration reserved for Step 3"}
      </text>
    </svg>
  );
}
export function QuestionVisual({ visual }) {
  const model = buildVisualModel(visual);
  if (!model) return null;
  let graphic;
  if (model.family === "placeholder")
    graphic = <PlaceholderFigure model={model} strategy={visual.strategy} />;
  else if (visual.strategy !== "deterministic") return null;
  else if (model.family === "cartesian")
    graphic = <CartesianFigure model={model} />;
  else if (model.family === "chart") graphic = <ChartFigure model={model} />;
  else if (model.family === "geometry")
    graphic = <GeometryFigure model={model} />;
  else if (model.family === "document")
    graphic = <DocumentFigure model={model} />;
  else if (model.family === "science")
    graphic = <ScienceFigure model={model} />;
  else if (model.family === "map") graphic = <MapFigure model={model} />;
  else if (model.family === "history")
    graphic = <HistoryFigure model={model} />;
  else if (model.family === "economics")
    graphic = <EconomicsFigure model={model} />;
  else if (model.family === "ict") graphic = <IctFigure model={model} />;
  else if (model.family === "music") graphic = <MusicFigure model={model} />;
  else if (model.family === "religious")
    graphic = <ReligiousFigure model={model} />;
  else graphic = <FlowFigure model={model} />;
  return (
    <figure
      className={`question-visual visual-${model.family}`}
      data-visual-type={model.type}
    >
      {graphic}
      {model.caption && <figcaption>{model.caption}</figcaption>}
    </figure>
  );
}
