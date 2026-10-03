// Rocket wordmark: the ascent mark (see branding/generate.py) and the name set
// in the system face. Colours follow the theme tokens.

// The product name is not translated.
const BRAND_NAME = "Rocket";
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
      viewBox="0 0 102 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient
          id="rocket-logo-arc"
          gradientUnits="userSpaceOnUse"
          x1="3"
          y1="15.2"
          x2="11.4"
          y2="4.3"
        >
          <stop offset="0" stopColor="var(--color-text)" stopOpacity="0.15" />
          <stop offset="1" stopColor="var(--color-text)" stopOpacity="1" />
        </linearGradient>
      </defs>
      <g transform="translate(1 3) scale(1.6)">
        <path
          d="M3 15.2C3 9.6 6.3 5.2 11.4 4.3"
          stroke="url(#rocket-logo-arc)"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
        <circle cx="12.6" cy="4.1" r="2.1" fill="var(--color-logo-primary)" />
      </g>
      <text
        x="31"
        y="24"
        fill="var(--color-text)"
        fontFamily="-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif"
        fontSize="22"
        fontWeight="650"
        letterSpacing="-0.4"
      >
        {BRAND_NAME}
      </text>
    </svg>
  );
};

export default RocketTextLogo;
