export function SiteLogo({
  className = "h-8 w-8 shrink-0 shadow-sm",
  title = "Tideway",
}: {
  className?: string;
  title?: string;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      role="img"
      aria-label={title}
      className={className}
    >
      <rect width="32" height="32" rx="7" fill="#2563eb" />
      <rect x="7" y="9" width="18" height="3" rx="1.5" fill="#ffffff" />
      <rect
        x="7"
        y="14.5"
        width="13"
        height="3"
        rx="1.5"
        fill="#ffffff"
        opacity="0.85"
      />
      <rect
        x="7"
        y="20"
        width="16"
        height="3"
        rx="1.5"
        fill="#ffffff"
        opacity="0.7"
      />
    </svg>
  );
}
