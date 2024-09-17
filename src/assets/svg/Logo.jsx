const Logo = (props) => {
  return (
    <svg
      width="1.5em"
      height="1.5em"
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      {/* Circle for "O" */}
      <circle
        cx="75"
        cy="50"
        r="22"
        stroke="currentColor"
        strokeWidth="8"
        fill="none"
      />
      {/* Vertical Line for "I" */}
      <rect
        x="00"
        y="25"
        width="8"
        height="50"
        fill="currentColor"
      />
      {/* Diagonal line representing the forward slash in "I/O" */}
      <line
        x1="40"
        y1="25"
        x2="20"
        y2="75"
        stroke="currentColor"
        strokeWidth="6"
      />
    </svg>
  );
};

export default Logo;
