// CardWithBorder.server.js
import React from "react";
import MuiCard from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";

// Component Imports
import CustomAvatar from "@/components/Avatar";
import { cardHeight, cardBorderRadius } from "@/configs/cardConfig";
import { Icon } from "@iconify/react";

const CardWithBorder = (props) => {
  const {
    title,
    stats,
    stats2,
    avatarIcon,
    icon: IconComponent,
    iconProps,
    icon_text,
  } = props;

  return (
    <MuiCard
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
      <CardContent className="flex flex-col gap-2">
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            mb: 0,
            mt: -1,
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
          <CustomAvatar color={"primary"} skin="light" variant="rounded">
            <Icon icon={avatarIcon} width="32px" height="32px" />
          </CustomAvatar>
        </Box>
        {stats2 ? (
          <Box
            className="flex mt-2"
            sx={{
              flexDirection: {
                xs: "column",
                sm: "column",
                xl: "row",
              },
              gap: 2,
              alignItems: {
                xs: "center",
                sm: "center",
                xl: "flex-start",
              },
            }}
          >
            <Box
              sx={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                height: "100%",
                flex: 1,
              }}
            >
              {stats}
            </Box>
            <Box
              sx={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                height: "100%",
                flex: 1,
              }}
            >
              {stats2}
            </Box>
          </Box>
        ) : (
          stats
        )}
      </CardContent>
    </MuiCard>
  );
};

export default CardWithBorder;
