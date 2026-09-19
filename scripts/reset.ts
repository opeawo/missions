import { seed } from "./lib";

async function main() {
  const result = await seed({ resetMissions: true });
  console.log("Reset complete. Demo mission is open again.");
  console.log(result);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
