import { extendTailwindMerge } from "tailwind-merge";

// Teach tailwind-merge about the custom theme scales so overrides resolve.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      radius: ["chip", "button", "card", "hero"],
      tracking: ["eyebrow"],
    },
  },
});

export function cn(...parts: Array<string | false | null | undefined>): string {
  return twMerge(parts.filter(Boolean).join(" "));
}
