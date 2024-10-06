import React from "react";
import dynamic from "next/dynamic";
import CardWithBorder from "@/components/cards/CardWithBorder";

const NetworkActivityChart = dynamic(() => import("./NetworkActivityChart"), {
  ssr: false,
});

const NetworkInfo = () => {
  return (
    <CardWithBorder
      title="Network Activity"
      avatarIcon="ph:network"
      stats={<NetworkActivityChart />}
    />
  );
};

export default NetworkInfo;
