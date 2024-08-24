import { Box, Typography, CircularProgress } from "@mui/material";

export default function CircularProgressWithLabel({ value, size, thickness }) {
  return (
    <Box
      sx={{
        position: "relative",
        display: "inline-flex",
        ml: {
          xs: 0, // 0 margin-left for extra small screens and up
          sm: 0, // 0 margin-left for extra small screens and up
          xl: 0, // 10 margin-left for large screens and up
        },
      }}
    >
      <CircularProgress
        variant="determinate"
        value={100} // Always 100 for the background circle
        size={size}
        thickness={thickness}
        sx={{
          position: "absolute",
          color: "var(--mui-palette-text-disabled)",
        }}
      />
      <CircularProgress
        variant="determinate"
        value={value} // Actual value for the progress
        size={size}
        thickness={thickness}
        sx={{
          "& .MuiCircularProgress-circle": {
            strokeLinecap: "round",
          },
        }}
      />
      <Box
        sx={{
          top: 0,
          left: 0,
          bottom: 0,
          right: 0,
          position: "absolute",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Typography variant="h6">{`${Math.round(value)}%`}</Typography>
      </Box>
    </Box>
  );
}
