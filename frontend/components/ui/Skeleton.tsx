"use client";
export default function Skeleton({ className = "", variant = "text", width, height }: { className?: string; variant?: "text" | "circular" | "rectangular"; width?: string | number; height?: string | number }) {
  const variants = { text: "h-4 rounded", circular: "rounded-full", rectangular: "rounded-lg" };
  return <div className={`bg-zinc-200 dark:bg-zinc-800 animate-pulse ${variants[variant]} ${className}`} style={{ width: width ? (typeof width === "number" ? `${width}px` : width) : "100%", height: height ? (typeof height === "number" ? `${height}px` : height) : undefined }} aria-hidden="true" />;
}
