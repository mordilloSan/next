const tabs = {
  MuiTabs: {
    styleOverrides: {
      root: ({ theme, ownerState }) => ({
        minBlockSize: 38,
        borderInlineEnd: "1px solid var(--mui-palette-divider)",
        "& .MuiTab-root:hover": {
          paddingInlineEnd: theme.spacing(5),
          ...(ownerState.textColor === "secondary"
            ? {
                color: "var(--mui-palette-secondary-main)",
                borderInlineEnd:
                  "2px solid var(--mui-palette-secondary-mainOpacity)",
              }
            : {
                color: "var(--mui-palette-primary-main)",
                borderInlineEnd:
                  "2px solid var(--mui-palette-primary-mainOpacity)",
              }),
          "& .MuiTabScrollButton-root": {
            borderRadius: "var(--mui-shape-borderRadius)",
          },
        },
        "& ~ .MuiTabPanel-root": {
          paddingInlineStart: theme.spacing(5),
        },
      }),
      vertical: {
        minWidth: 131,
        "& .MuiTab-root": {
          minWidth: 130,
        },
      },
    },
  },
  MuiTab: {
    styleOverrides: {
      root: ({ theme, ownerState }) => ({
        lineHeight: 1.4667,
        padding: theme.spacing(2, 5.5),
        minBlockSize: 38,
        color: "var(--mui-palette-text-primary)",
        "& > .MuiTab-iconWrapper": {
          fontSize: "1.125rem",
          ...(ownerState.iconPosition === "start" && {
            marginInlineEnd: theme.spacing(1.5),
          }),
          ...(ownerState.iconPosition === "end" && {
            marginInlineStart: theme.spacing(1.5),
          }),
        },
      }),
    },
  },
  MuiTabPanel: {
    styleOverrides: {
      root: {
        padding: 0,
      },
    },
  },
};

export default tabs;
