// Outline rocket used as a nav icon; same geometry as the tray icon
// (branding/generate.py), stroked in currentColor like the lucide icons.
const RocketMark = ({
  width,
  height,
  className,
}: {
  width?: number | string;
  height?: number | string;
  className?: string;
}) => (
  <svg
    width={width || 24}
    height={height || 24}
    viewBox="0 0 64 64"
    className={className}
    xmlns="http://www.w3.org/2000/svg"
  >
    <g
      transform="translate(31 34) rotate(45) scale(0.6) translate(-50 -52)"
      fill="none"
      stroke="currentColor"
      strokeWidth="7.5"
      strokeLinejoin="round"
      strokeLinecap="round"
    >
      <path d="M50 6 C61 14 67 28 66.5 46 C75 50 80 58 79 72 L66 64 L34 64 L21 72 C20 58 25 50 33.5 46 C33 28 39 14 50 6 Z" />
      <path d="M43 64 C43 75 47 81 50 87 C53 81 57 75 57 64" />
      <circle cx="50" cy="34" r="7" />
    </g>
  </svg>
);

export default RocketMark;
