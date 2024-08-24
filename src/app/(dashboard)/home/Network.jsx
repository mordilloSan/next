import React from "react";
import dynamic from "next/dynamic";
import CardWithBorder from "@/components/cards/CardWithBorder";

const NetworkActivityChart = dynamic(() => import("./NetworkActivityChart"), {
  ssr: false,
});
const NetworkStatsInfo = dynamic(() => import("./NetworkStatsInfo"), {
  ssr: false,
});

const NetworkInfo = () => {
  return (
    <CardWithBorder
      title="Network Activity"
      avatarIcon="ph:network"
      stats={<NetworkActivityChart />}
      stats2={<NetworkStatsInfo />}
    />
  );
};

export default NetworkInfo;
