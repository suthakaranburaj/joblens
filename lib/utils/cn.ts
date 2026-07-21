import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merges Tailwind CSS class names, resolving conflicts via `tailwind-merge`
 * and supporting conditional classes via `clsx`.
 *
 * @param inputs - Class values to merge (strings, arrays, objects, etc.)
 * @returns A single conflict-free className string
 *
 * @example
 * cn("px-2 py-1", condition && "bg-zinc-100", "px-4") // => "py-1 bg-zinc-100 px-4"
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
