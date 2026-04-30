import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center gap-4 text-center">
      <h1 className="text-4xl font-bold tracking-tight text-zinc-100">404</h1>
      <p className="text-sm text-zinc-400">Page not found.</p>
      <Link
        href="/"
        className="text-sm text-orange-300 underline-offset-2 hover:underline"
      >
        Back to signals
      </Link>
    </div>
  );
}
