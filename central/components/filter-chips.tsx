"use client";

import { Button } from "@/components/ui/button";

export function FilterChips({ label, value, onChange, options }: {
  label: string; value: string; onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return <div className="filter-group" role="group" aria-label={label}>
    <span className="filter-label">{label}</span>
    <div className="filter-options">{options.map(option => <Button
      key={option.value} type="button" variant="outline"
      aria-pressed={value === option.value} onClick={() => onChange(option.value)}
      className="filter-chip"
    >{option.label}</Button>)}</div>
  </div>;
}
