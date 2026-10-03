// Rocket wordmark: the rocket mark plus hand-drawn monoline lettering.
// Geometry comes from branding/generate.py; colours follow the theme tokens.
const RocketTextLogo = ({
  width,
  height,
  className,
}: {
  width?: number;
  height?: number;
  className?: string;
}) => {
  return (
    <svg
      width={width}
      height={height}
      className={className}
      viewBox="0 -4 561 116"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g transform="translate(56 58) rotate(45) scale(1.12) translate(-50 -52)">
        <path
          d="M41 69 C41 82 45 89 50 98 C55 89 59 82 59 69 Z"
          fill="#ffb02e"
        />
        <path
          d="M35 46 C25 50 20 58 21 72 L35 64 Z M65 46 C75 50 80 58 79 72 L65 64 Z"
          fill="var(--color-logo-stroke)"
        />
        <rect
          x="41"
          y="62"
          width="18"
          height="9"
          rx="2"
          fill="var(--color-logo-stroke)"
        />
        <path
          d="M50 6 C63 15 69 33 66 64 L34 64 C31 33 37 15 50 6 Z"
          fill="var(--color-logo-primary)"
        />
        <circle cx="50" cy="34" r="8" fill="var(--color-logo-stroke)" />
        <circle cx="50" cy="34" r="4.5" fill="var(--color-background)" />
      </g>
      <path
        d="M132.5 100 V40 M132.5 66 C132.5 48 142.5 40 160.5 40 M190.5 70 A30 30 0 1 0 250.5 70 A30 30 0 1 0 190.5 70 M332.8 49.9 A30 30 0 1 0 332.8 90.1 M362.8 8 V100 M392.8 42 L364.8 74 M373.8 65 L394.8 100 M426.8 70 H484.8 A30 30 0 1 0 477.8 89.3 M526.8 16 V84 Q526.8 100 542.8 100 M514.8 40 H548.8"
        stroke="var(--color-text)"
        strokeWidth="17"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

export default RocketTextLogo;
