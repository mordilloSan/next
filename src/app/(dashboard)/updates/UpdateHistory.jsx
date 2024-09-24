"use client";

import React from "react";
import { Typography, Box } from "@mui/material";
import CollapsibleTable from "@/components/tables/CollapsibleTable";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableRow from "@mui/material/TableRow";
import { useQuery } from "@tanstack/react-query";
import { useAuthenticatedFetch } from "@/utils/customFetch";

function UpdateHistoryCard() {
  // Initialize your custom fetch function
  const customFetch = useAuthenticatedFetch();

  // Use React Query to fetch data
  const { data: rows = [] } = useQuery({
    queryKey: ["updateHistory"],
    queryFn: async () => {
      const data = await customFetch("/api/updates/update-history");
      // Process the data as needed
      return data.map((item) => ({
        date: item.date,
        upgrades: item.upgrades,
      }));
    },
  });

  // Utility function to chunk an array into smaller arrays
  const chunkArray = (array, chunkSize) => {
    const result = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      result.push(array.slice(i, i + chunkSize));
    }
    return result;
  };

  const columns = [
    { field: "date", headerName: "Date" },
    // Add other columns as needed
  ];

  const renderCollapseContent = (row) => {
    const chunkedHistory = chunkArray(row.upgrades, 5);

    return (
      <div>
        <Typography variant="h6" gutterBottom>
          Packages Installed
        </Typography>
        <Table size="small" aria-label="packages">
          <TableBody>
            {chunkedHistory.map((historyChunk, index) => (
              <TableRow key={index}>
                {historyChunk.map((historyRow, i) => (
                  <TableCell key={i} sx={{ width: "20%" }}>
                    {historyRow.package}
                  </TableCell>
                ))}
                {historyChunk.length < 5 &&
                  [...Array(5 - historyChunk.length)].map((_, i) => (
                    <TableCell key={i} sx={{ width: "20%" }} />
                  ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };

  return (
    <Box>
      <Typography
        variant="h4"
        gutterBottom
        sx={{ paddingLeft: 2, paddingRight: 2, paddingTop: 3 }}
      >
        Update History
      </Typography>
      <CollapsibleTable
        rows={rows}
        columns={columns}
        renderCollapseContent={renderCollapseContent}
      />
    </Box>
  );
}

export default UpdateHistoryCard;
