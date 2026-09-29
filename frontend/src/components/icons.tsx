// Minimal inline icon set (no icon-library dependency). Stroke-based, 18x18 default.
type P = { size?: number; className?: string };

const base = (size = 18) => ({
  width: size,
  height: size,
  viewBox: "0 0 20 20",
  fill: "none" as const,
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
});

export const InboxIcon = ({ size, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M3 11.5 5.2 4h9.6l2.2 7.5" />
    <path d="M3 11.5h4.2a1 1 0 0 1 .95.68l.4 1.14a1 1 0 0 0 .95.68h1.5a1 1 0 0 0 .95-.68l.4-1.14a1 1 0 0 1 .95-.68H17v4.3a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-4.3Z" />
  </svg>
);

export const ClockIcon = ({ size, className }: P) => (
  <svg {...base(size)} className={className}>
    <circle cx="10" cy="10" r="7.2" />
    <path d="M10 6.2V10l2.6 1.6" />
  </svg>
);

export const FlagIcon = ({ size, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M5 17V3.6" />
    <path d="M5 4h8.4l-1.8 3 1.8 3H5" strokeLinejoin="round" />
  </svg>
);

export const CheckCircleIcon = ({ size, className }: P) => (
  <svg {...base(size)} className={className}>
    <circle cx="10" cy="10" r="7.2" />
    <path d="M6.8 10.2l2.1 2.1 4.3-4.6" />
  </svg>
);

export const XCircleIcon = ({ size, className }: P) => (
  <svg {...base(size)} className={className}>
    <circle cx="10" cy="10" r="7.2" />
    <path d="M7.5 7.5l5 5m0-5-5 5" />
  </svg>
);

export const UploadIcon = ({ size, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M10 13V4.5M10 4.5 6.8 7.7M10 4.5l3.2 3.2" />
    <path d="M4 13.5v1.8a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-1.8" />
  </svg>
);

export const DownloadIcon = ({ size, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M10 4v8.5M10 12.5 6.8 9.3M10 12.5l3.2-3.2" />
    <path d="M4 13.5v1.8a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-1.8" />
  </svg>
);

export const ChevronDownIcon = ({ size, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M5 7.5 10 12.5 15 7.5" />
  </svg>
);

export const LogoutIcon = ({ size, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M8 17H4.8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1H8" />
    <path d="M13 13.5 17 10l-4-3.5M17 10H7.5" />
  </svg>
);

export const FileIcon = ({ size, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M6 2.5h5.5L15 6v11a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1Z" strokeLinejoin="round" />
    <path d="M11.3 2.5V6H15" strokeLinejoin="round" />
  </svg>
);

export const CloseIcon = ({ size, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M5 5l10 10M15 5 5 15" />
  </svg>
);

export const BellIcon = ({ size, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M6 8.5a4 4 0 0 1 8 0v3l1.3 2.3a.8.8 0 0 1-.7 1.2H5.4a.8.8 0 0 1-.7-1.2L6 11.5v-3Z" strokeLinejoin="round" />
    <path d="M8.3 15.5a1.8 1.8 0 0 0 3.4 0" />
  </svg>
);

export const MenuIcon = ({ size, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M3.5 6h13M3.5 10h13M3.5 14h13" />
  </svg>
);

export const TrashIcon = ({ size, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M4.5 6h11M8 6V4.5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1V6M8.5 9.3v4.4M11.5 9.3v4.4" />
    <path d="M5.5 6 6.2 15a1 1 0 0 0 1 .9h5.6a1 1 0 0 0 1-.9L14.5 6" />
  </svg>
);

export const SearchIcon = ({ size, className }: P) => (
  <svg {...base(size)} className={className}>
    <circle cx="9" cy="9" r="5.5" />
    <path d="M13.2 13.2 17 17" />
  </svg>
);

export const PlusIcon = ({ size, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M10 4.5v11M4.5 10h11" />
  </svg>
);

export const DuplicateIcon = ({ size, className }: P) => (
  <svg {...base(size)} className={className}>
    <rect x="7" y="7" width="9" height="9" rx="1.4" />
    <path d="M13 7V5.5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1V12a1 1 0 0 0 1 1H7" />
  </svg>
);

export const EditIcon = ({ size, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M12.4 3.6a1.6 1.6 0 0 1 2.3 2.3L6.3 14.3 3 15l.7-3.3 8.7-8.1Z" strokeLinejoin="round" />
  </svg>
);

export const Spinner = ({ size = 16, className }: P) => (
  <svg
    className={className ? `${className} spinner` : "spinner"}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
  >
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
    <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
  </svg>
);
