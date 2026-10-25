import Link from "next/link";

export default function NotFound() {
  return (
    <div className="card mt-8 text-center">
      <p className="mb-4 text-4xl">🤷</p>
      <Link href="/" className="btn">
        ←
      </Link>
    </div>
  );
}
