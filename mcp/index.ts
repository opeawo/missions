import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createMissionsMcpServer } from "./register";

async function main() {
  const transport = new StdioServerTransport();
  const server = createMissionsMcpServer();
  await server.connect(transport);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
