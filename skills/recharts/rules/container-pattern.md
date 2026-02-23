# Container Pattern

**Impact: HIGH**

Every Recharts chart must be wrapped in a fixed-height outer `div` with `ResponsiveContainer` inside. This prevents the common "zero-height chart" bug and ensures charts resize correctly in flex/grid layouts.

## Rule

1. Wrap every chart in `<div className="h-80 w-full">` (or another explicit height)
2. Place `<ResponsiveContainer width="100%" height="100%">` as the only child of the wrapper
3. Add `throttleDelay={100}` to `ResponsiveContainer` to avoid excessive re-renders during window resize
4. When using `margin` on a chart component, always specify all four values — Recharts defaults missing values to `0`, not the previous value

## Incorrect

```tsx
// Missing outer height container — chart renders with 0 height
<ResponsiveContainer width="100%" height="100%">
  <LineChart data={data} margin={{ top: 20 }}>
    {/* margin.left/right/bottom silently default to 0 */}
    <Line dataKey="value" />
  </LineChart>
</ResponsiveContainer>
```

## Correct

```tsx
<div className="h-80 w-full">
  <ResponsiveContainer width="100%" height="100%" throttleDelay={100}>
    <LineChart
      data={data}
      margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
    >
      <AccessibilityLayer />
      <Line dataKey="value" />
    </LineChart>
  </ResponsiveContainer>
</div>
```

## Common Heights

| Use case | Class | Pixels |
|----------|-------|--------|
| Inline sparkline | `h-16` | 64px |
| Card chart | `h-48` | 192px |
| Dashboard panel | `h-80` | 320px |
| Full-page chart | `h-[500px]` | 500px |
