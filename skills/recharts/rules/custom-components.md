# Custom Components

**Impact: HIGH**

Use custom tooltip and legend components styled with HeroUI Tailwind classes instead of Recharts defaults. This keeps chart UI consistent with the rest of the HeroUI application.

## Custom Tooltip

Always use a custom `content` prop on `<Tooltip>`. Guard against null/empty payloads.

```tsx
import type { TooltipProps } from "recharts";
import type { ValueType, NameType } from "recharts/types/component/DefaultTooltipContent";

function ChartTooltip({
  active,
  payload,
  label,
}: TooltipProps<ValueType, NameType>) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg bg-content1 p-3 text-foreground shadow-md">
      <p className="mb-1 text-sm font-medium">{label}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2 text-sm">
          <span
            className="size-2.5 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-default-500">{entry.name}</span>
          <span className="ml-auto font-mono font-medium">
            {entry.value?.toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
}
```

Usage:

```tsx
<Tooltip content={<ChartTooltip />} />
```

## Custom Legend

Replace the default legend with a HeroUI-styled version using colour dots.

```tsx
import type { LegendProps } from "recharts";

function ChartLegend({ payload }: LegendProps) {
  if (!payload?.length) return null;

  return (
    <div className="flex flex-wrap justify-center gap-4 pt-2">
      {payload.map((entry) => (
        <div key={entry.value} className="flex items-center gap-1.5 text-sm">
          <span
            className="size-2.5 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-default-500">{entry.value}</span>
        </div>
      ))}
    </div>
  );
}
```

Usage:

```tsx
<Legend content={<ChartLegend />} />
```

## Incorrect

```tsx
// Default Recharts tooltip — clashes with HeroUI design
<Tooltip />
<Legend />
```

## Correct

```tsx
// Custom components matching HeroUI design
<Tooltip content={<ChartTooltip />} />
<Legend content={<ChartLegend />} />
```

## Notes

- Place `ChartTooltip` and `ChartLegend` in a shared `components/charts/` directory so all chart pages reuse the same components
- The `bg-content1`, `text-foreground`, and `text-default-500` classes are HeroUI semantic tokens — they adapt to light/dark mode automatically
- The `font-mono` class on values improves readability of numbers in tables and tooltips
