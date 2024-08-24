// app/api/wireguard/client/[clientName]/route.js

import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { executeCommand } from "@/utils/executer";

export async function DELETE(request, { params }) {
  try {
    const { clientName } = params;
    const { WG_INTERFACE, WG_CONFIG_PATH } = process.env;

    const clientConfigPath = path.join(
      WG_CONFIG_PATH,
      `${WG_INTERFACE}-client-${clientName}.conf`,
    );

    // Read client config to extract public key and allowed IPs
    const clientConfig = await fs.readFile(clientConfigPath, "utf-8");
    const clientPublicKeyMatch = clientConfig.match(/PublicKey = (.*)/);
    const clientAllowedIPsMatch = clientConfig.match(/Address = (.*)\/32/);

    if (!clientPublicKeyMatch || !clientAllowedIPsMatch) {
      return NextResponse.json(
        { error: "Invalid client configuration." },
        { status: 400 },
      );
    }

    const clientPublicKey = clientPublicKeyMatch[1].trim();
    const clientAllowedIP = clientAllowedIPsMatch[1].trim();

    // Remove client from server
    await executeCommand(
      `wg set ${WG_INTERFACE} peer ${clientPublicKey} remove`,
    );

    // Delete client config file
    await fs.unlink(clientConfigPath);

    return NextResponse.json({
      message: `Client ${clientName} deleted successfully.`,
    });
  } catch (error) {
    console.error("Error deleting WireGuard client:", error);
    return NextResponse.json(
      { error: "Failed to delete WireGuard client." },
      { status: 500 },
    );
  }
}
