# Theme Integration

**Impact: HIGH**

All chart colours must use HeroUI CSS variables — never hardcoded hex or RGB values. This ensures charts automatically adapt to light/dark mode via HeroUI's `data-theme` attribute.

## Rule

Use `hsl(var(--heroui-<token>))` for all colour props (`stroke`, `fill`, `stopColor`, etc.). Before generating a chart, call `mcp__heroui-react__get_theme_variables` to confirm available token names.

## Token Mapping

| HeroUI token | Recharts usage | Example prop |
|--------------|----------------|--------------|
| `--heroui-primary` | Primary series line/bar | `stroke="hsl(var(--heroui-primary))"` |
| `--heroui-secondary` | Secondary series | `stroke="hsl(var(--heroui-secondary))"` |
| `--heroui-success` | Positive values / growth | `fill="hsl(var(--heroui-success))"` |
| `--heroui-danger` | Negative values / decline | `fill="hsl(var(--heroui-danger))"` |
| `--heroui-warning` | Warning thresholds | `fill="hsl(var(--heroui-warning))"` |
| `--heroui-foreground` | Axis text, labels | `stroke="hsl(var(--heroui-foreground))"` |
| `--heroui-default-200` | Grid lines, borders | `stroke="hsl(var(--heroui-default-200))"` |
| `--heroui-content1` | Tooltip background | used in className |

## Multi-Series Palette

When a chart has more than two series, define a palette constant:

```tsx
const CHART_COLOURS = [
  "hsl(var(--heroui-primary))",
  "hsl(var(--heroui-secondary))",
  "hsl(var(--heroui-success))",
  "hsl(var(--heroui-warning))",
  "hsl(var(--heroui-danger))",
] as const;
```

Then index into it: `stroke={CHART_COLOURS[index % CHART_COLOURS.length]}`.

## Incorrect

```tsx
// Hardcoded colours — breaks in dark mode
<Line stroke="#3B82F6" />
<Bar fill="rgb(59, 130, 246)" />
<CartesianGrid stroke="#E5E7EB" />
```

## Correct

```tsx
<CartesianGrid
  strokeDasharray="3 3"
  stroke="hsl(var(--heroui-default-200))"
/>
<XAxis
  dataKey="month"
  stroke="hsl(var(--heroui-foreground))"
  fontSize={12}
/>
<Line
  type="monotone"
  dataKey="revenue"
  stroke="hsl(var(--heroui-primary))"
  strokeWidth={2}
/>
<Bar
  dataKey="profit"
  fill="hsl(var(--heroui-success))"
/>
```

## Dark Mode

No extra work needed. HeroUI swaps CSS variable values when `data-theme="dark"` is set on the root element. Charts using CSS variables adapt automatically.
