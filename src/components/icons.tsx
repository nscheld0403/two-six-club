import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number; strokeWidth?: number };

function Svg({ size = 20, strokeWidth = 2, children, ...rest }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const HomeIcon = (p: IconProps) => (
  <Svg {...p}><path d="M3 10.5L12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" /></Svg>
);
export const CalendarIcon = (p: IconProps) => (
  <Svg {...p}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></Svg>
);
export const PlusIcon = (p: IconProps) => (
  <Svg strokeWidth={2.6} {...p}><path d="M12 5v14M5 12h14" /></Svg>
);
export const RanksIcon = (p: IconProps) => (
  <Svg {...p}><path d="M6 20V11M12 20V4M18 20v-6" /></Svg>
);
export const TrendIcon = (p: IconProps) => (
  <Svg {...p}><path d="M3 17l6-6 4 4 8-8" /><path d="M14 7h7v7" /></Svg>
);
export const CheckIcon = (p: IconProps) => (
  <Svg strokeWidth={2.6} {...p}><path d="M5 12l5 5 9-10" /></Svg>
);
export const ChevronLeftIcon = (p: IconProps) => (
  <Svg strokeWidth={2.2} {...p}><path d="M15 6l-6 6 6 6" /></Svg>
);
export const ChevronRightIcon = (p: IconProps) => (
  <Svg strokeWidth={2.2} {...p}><path d="M9 6l6 6-6 6" /></Svg>
);
export const ArrowRightIcon = (p: IconProps) => (
  <Svg strokeWidth={2.4} {...p}><path d="M5 12h14M13 6l6 6-6 6" /></Svg>
);
export const ShieldIcon = (p: IconProps) => (
  <Svg {...p}><path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z" /></Svg>
);
export const UserIcon = (p: IconProps) => (
  <Svg {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></Svg>
);
export const CopyIcon = (p: IconProps) => (
  <Svg {...p}><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></Svg>
);
export const KeyIcon = (p: IconProps) => (
  <Svg {...p}><circle cx="8" cy="15" r="4" /><path d="M11 12l9-9M17 6l3 3M15 8l2 2" /></Svg>
);
export const InfoIcon = (p: IconProps) => (
  <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 8v4M12 16h.01" /></Svg>
);
export const SearchIcon = (p: IconProps) => (
  <Svg {...p}><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></Svg>
);
export const CakeIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 21h16M5 21v-7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v7" />
    <path d="M5 16c1.5 1 3 1 4.5 0s3-1 4.5 0 3 1 4.5 0" />
    <path d="M12 12V8M8 12V9M16 12V9" />
    <path d="M12 5.5c.8-.8.8-1.7 0-2.5-.8.8-.8 1.7 0 2.5z" />
  </Svg>
);

/** Small labelled birthday cake shown next to a name. */
export function BirthdayCake({ name, size = 16 }: { name?: string; size?: number }) {
  return (
    <span className="inline-flex items-center text-strength" role="img" aria-label={name ? `${name}'s birthday` : "Birthday"} title="Birthday">
      <CakeIcon size={size} aria-hidden="true" />
    </span>
  );
}

export const LogoutIcon = (p: IconProps) => (
  <Svg {...p}><path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 17l-5-5 5-5M5 12h11" /></Svg>
);
