/**
 * Inline SVG icon set drawn in one consistent line/duotone style so the
 * "matched icon family" idea reads visually. Reused by BeforeAfter, Steps,
 * and the examples gallery. No external assets.
 */
import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function base(props: IconProps) {
  return {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    ...props,
  };
}

export function HomeIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5 10v9h14v-9" />
      <path d="M10 19v-5h4v5" />
    </svg>
  );
}

export function ChartIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 4v16h16" />
      <path d="M8 14v3" />
      <path d="M12 10v7" />
      <path d="M16 7v10" />
    </svg>
  );
}

export function BellIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M18 9a6 6 0 1 0-12 0c0 5-2 6-2 6h16s-2-1-2-6" />
      <path d="M10.5 19a1.8 1.8 0 0 0 3 0" />
    </svg>
  );
}

export function UserIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c0-3.5 3-5.5 7-5.5s7 2 7 5.5" />
    </svg>
  );
}

export function SettingsIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
    </svg>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="11" cy="11" r="6" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

export function CalendarIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="4" y="5" width="16" height="15" rx="2" />
      <path d="M4 9h16M8 3v4M16 3v4" />
    </svg>
  );
}

export function LockIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="5" y="10" width="14" height="10" rx="2" />
      <path d="M8 10V8a4 4 0 0 1 8 0v2" />
      <path d="M12 14v2" />
    </svg>
  );
}

export function HeartIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 20s-7-4.4-7-9.5A3.5 3.5 0 0 1 12 8a3.5 3.5 0 0 1 7 2.5C19 15.6 12 20 12 20Z" />
    </svg>
  );
}

export function StarIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="m12 4 2.2 4.8 5.3.6-3.9 3.6 1 5.2L12 16.9 7.4 18.8l1-5.2L4.5 10l5.3-.6L12 4Z" />
    </svg>
  );
}

export function FolderIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 7a2 2 0 0 1 2-2h3l2 2.5h7a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7Z" />
    </svg>
  );
}

export function BoltIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M13 3 5 13h6l-1 8 8-10h-6l1-8Z" />
    </svg>
  );
}

export function ImageIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="4" y="5" width="16" height="14" rx="2" />
      <circle cx="9" cy="10" r="1.6" />
      <path d="m5 17 4.5-4 3 2.5L16 12l3 4" />
    </svg>
  );
}

export function GridIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="4" y="4" width="7" height="7" rx="1.5" />
      <rect x="13" y="4" width="7" height="7" rx="1.5" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" />
      <rect x="13" y="13" width="7" height="7" rx="1.5" />
    </svg>
  );
}

export function DownloadIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 4v10" />
      <path d="m8 11 4 4 4-4" />
      <path d="M5 19h14" />
    </svg>
  );
}

export function SparkleIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 4c.6 3.2 1.8 4.4 5 5-3.2.6-4.4 1.8-5 5-.6-3.2-1.8-4.4-5-5 3.2-.6 4.4-1.8 5-5Z" />
      <path d="M19 14c.3 1.4.8 1.9 2 2-1.2.3-1.7.8-2 2-.3-1.4-.8-1.9-2-2 1.2-.3 1.7-.8 2-2Z" />
    </svg>
  );
}

export function CheckListIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M9 6h11M9 12h11M9 18h11" />
      <path d="m4 5.5 1 1 1.5-2M4 11.5l1 1 1.5-2M4 17.5l1 1 1.5-2" />
    </svg>
  );
}

export type Glyph = (props: IconProps) => React.JSX.Element;

/** The canonical "icon family" used in before/after grids. */
export const ICON_FAMILY: { name: string; Icon: Glyph }[] = [
  { name: "Home", Icon: HomeIcon },
  { name: "Chart", Icon: ChartIcon },
  { name: "Bell", Icon: BellIcon },
  { name: "User", Icon: UserIcon },
  { name: "Settings", Icon: SettingsIcon },
  { name: "Search", Icon: SearchIcon },
  { name: "Calendar", Icon: CalendarIcon },
  { name: "Lock", Icon: LockIcon },
  { name: "Heart", Icon: HeartIcon },
  { name: "Star", Icon: StarIcon },
  { name: "Folder", Icon: FolderIcon },
  { name: "Bolt", Icon: BoltIcon },
];
