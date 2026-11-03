import { supportCaseService } from "@/services/support-case.service";

const args = new Set(process.argv.slice(2));
const apply = args.has("--apply");
const takeArg = process.argv.find((arg) => arg.startsWith("--take="));
const cursorArg = process.argv.find((arg) => arg.startsWith("--cursor="));
const take = takeArg ? Number(takeArg.slice("--take=".length)) : undefined;
const cursor = cursorArg?.slice("--cursor=".length);

async function main() {
  const result = await supportCaseService.backfillLegacyDisputeSupportCases({
    dryRun: !apply,
    take: Number.isInteger(take) && (take ?? 0) > 0 ? take : undefined,
    cursor,
  });
  console.log(JSON.stringify(result));
  if (!apply) {
    console.log("Dry run only. Re-run with --apply after reviewing the result against an approved database environment.");
  }
}

main().catch((error) => {
  console.error("Support-case legacy backfill failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
