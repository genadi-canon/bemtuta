export default function Stars({ value, count }: { value: number; count?: number }) {
  const v = Number(value) || 0;
  return (
    <span className="whitespace-nowrap text-sm" dir="ltr">
      <span className="text-amber-500">{"★".repeat(Math.round(v))}</span>
      <span className="text-stone-300">{"★".repeat(5 - Math.round(v))}</span>
      {count !== undefined && <span className="ms-1 text-stone-500">({count})</span>}
    </span>
  );
}
