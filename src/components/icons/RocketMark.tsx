// Rocket's ascent mark as a nav icon, drawn in currentColor like the lucide
// icons beside it (geometry from branding/generate.py).
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
    viewBox="0 0 16 16"
    className={className}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M3 15.2C3 9.6 6.3 5.2 11.4 4.3"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
    />
    <circle cx="12.6" cy="4.1" r="2" fill="currentColor" />
  </svg>
);

export default RocketMark;
