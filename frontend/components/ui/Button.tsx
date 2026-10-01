"use client";
import { ButtonHTMLAttributes, ReactNode } from "react";
export default function Button({ variant = "primary", size = "md", children, className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "outline" | "ghost"; size?: "sm" | "md" | "lg"; children: ReactNode }) {
  const base = "inline-flex items-center justify-center font-medium transition-all duration-200 focus-ring disabled:opacity-50 disabled:cursor-not-allowed";
  const v = { primary: "bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 shadow-sm hover:shadow-md", secondary: "bg-zinc-100 text-zinc-900 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700", outline: "border-2 border-zinc-300 text-zinc-700 hover:border-blue-500 hover:text-blue-600 dark:border-zinc-700 dark:text-zinc-300", ghost: "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800" };
  const s = { sm: "px-3 py-1.5 text-sm", md: "px-4 py-2 text-base", lg: "px-6 py-3 text-lg" };
  return <button className={`${base} ${v[variant]} ${s[size]} ${className}`} {...props}>{children}</button>;
}
