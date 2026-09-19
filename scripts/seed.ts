import { seed } from "./lib";

async function main() {
  const result = await seed();
  console.log("Seeded");
  console.log(result);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
