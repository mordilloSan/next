"use client";

import React from "react";
import MuiCard from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import { styled } from "@mui/material/styles";
import CustomAvatar from "@/components/Avatar";
import { cardHeight, cardBorderRadius } from "@/configs/cardConfig";
import { Icon } from "@iconify/react";

// Define a styled card component to include hover styles
const HoverableCard = styled(MuiCard)(({ theme, color = "primary" }) => ({
  transition:
    "border 0.3s ease-in-out, box-shadow 0.3s ease-in-out, margin 0.3s ease-in-out",
  borderBottomWidth: "2px",
  borderBottomColor:
    theme.palette[color]?.darkerOpacity || theme.palette.primary.darkerOpacity,
  "&:hover": {
    borderBottomWidth: "3px",
    borderBottomColor: theme.palette[color]?.main || theme.palette.primary.main,
    boxShadow: theme.shadows[10],
    marginBlockEnd: "-1px",
  },
}));

const CardWithBorder = (props) => {
  const {
    title,
    stats,
    stats2,
    avatarIcon,
    icon: IconComponent,
    iconProps,
    icon_text,
    color,
  } = props;

  return (
    <HoverableCard
      color={color}
      elevation={2}
      sx={{
        height: stats2
          ? {
            xs: 340,
            sm: 340,
            xl: cardHeight,
          }
          : cardHeight,
        m: 1,
        display: "flex",
        flexDirection: "column",
        borderRadius: cardBorderRadius,
      }}
    >
      <CardContent>
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            mb: 1,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Typography variant="h4" sx={{ fontWeight: "bold" }}>
              {title}
            </Typography>
            {IconComponent && <IconComponent {...iconProps} />}
            <Typography variant="body2" sx={{ color: "grey" }}>
              {icon_text}
            </Typography>
          </Box>
          <CustomAvatar color="primary" skin="light" variant="rounded">
            <Icon icon={avatarIcon} width="32px" height="32px" />
          </CustomAvatar>
        </Box>
        {stats2 ? (
          <Box
            sx={{
              mt: 2,
              display: "flex",
              flexDirection: { xs: "column", sm: "column", xl: "row" },
              gap: 2,
              alignItems: { xs: "center", sm: "center", xl: "flex-start" },
            }}
          >
            <Box sx={{ flex: 1, display: 'flex', justifyContent: 'center' }}>{stats}</Box>
            <Box sx={{ flex: 1, display: 'flex', justifyContent: 'center' }}>{stats2}</Box>
          </Box>
        ) : (
          <Box sx={{ mt: 2 }}>{stats}</Box>
        )}
      </CardContent>
    </HoverableCard>
  );
};

export default CardWithBorder;
