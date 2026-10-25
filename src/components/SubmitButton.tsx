"use client";

import { useFormStatus } from "react-dom";

export default function SubmitButton({
  children,
  className = "btn",
  name,
  value,
}: {
  children: React.ReactNode;
  className?: string;
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className} name={name} value={value}>
      {pending ? "…" : children}
    </button>
  );
}
