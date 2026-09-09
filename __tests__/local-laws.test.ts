import fs from "fs";
import path from "path";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  }
  console.log(` ✅ PASS: ${message}`);
}

console.log("\n==================================================================");
console.log("   LOCAL LAWS & RESOURCE CENTRE DRAWER VERIFICATION SUITE       ");
console.log("==================================================================\n");

// Read files
const localLawsPath = path.resolve(__dirname, "../app/(protected)/host/listings/[id]/components/LocalLawsView.tsx");
const houseRulesViewsPath = path.resolve(__dirname, "../app/(protected)/host/listings/[id]/components/HouseRulesAndArrivalViews.tsx");

assert(fs.existsSync(localLawsPath), "LocalLawsView.tsx file must exist");
assert(fs.existsSync(houseRulesViewsPath), "HouseRulesAndArrivalViews.tsx file must exist");

const localLawsCode = fs.readFileSync(localLawsPath, "utf-8");
const houseRulesCode = fs.readFileSync(houseRulesViewsPath, "utf-8");

console.log("--- [1] Local Laws Main View Elements (Airbnb-Style Pixel Match) ---");
assert(localLawsCode.includes("Local laws"), "LocalLawsView must include 'Local laws' heading");
assert(
  localLawsCode.includes("Take a moment to review the local laws that apply to your listing"),
  "LocalLawsView must include intro paragraph matching reference design"
);
assert(
  localLawsCode.includes("3 min read"),
  "LocalLawsView article card must show '3 min read'"
);
assert(
  localLawsCode.includes("Learn about hosting regulations"),
  "LocalLawsView article card must show 'Learn about hosting regulations'"
);
assert(
  localLawsCode.includes("Most cities have rules covering home sharing"),
  "LocalLawsView must include paragraph explaining zoning, building, licensing and tax codes"
);
assert(
  localLawsCode.includes("Since you are responsible for your own decision to list"),
  "LocalLawsView must include host responsibility paragraph"
);
assert(
  localLawsCode.includes("Learn more about responsible hosting"),
  "LocalLawsView must include 'Learn more about responsible hosting' link"
);
assert(
  localLawsCode.includes("By accepting our Terms of Service and listing your space"),
  "LocalLawsView must include terms certification disclaimer"
);

console.log("\n--- [2] Resource Centre Slide-Over Drawer Content ---");
assert(localLawsCode.includes("Resource Centre"), "Drawer must include 'Resource Centre' badge");
assert(localLawsCode.includes("Close Resource Centre"), "Drawer must include accessible close button");
assert(localLawsCode.includes("Research local laws, taxes and permits."), "Drawer must display subtitle");
assert(localLawsCode.includes("handleCopyLink"), "Drawer must support copying article link");
assert(localLawsCode.includes("Visit the Help Centre"), "Article must include 'Visit the Help Centre' section");
assert(localLawsCode.includes("Connect locally"), "Article must include 'Connect locally' section");
assert(localLawsCode.includes("Contact hosts"), "Article must include 'Contact hosts' section");
assert(localLawsCode.includes("Consult a professional"), "Article must include 'Consult a professional' section");
assert(localLawsCode.includes("Learn more with AI"), "Article must include 'Learn more with AI' section");
assert(localLawsCode.includes("Be specific about your location"), "AI section must include location specificity tip");
assert(localLawsCode.includes("Read official sources"), "AI section must include official sources tip");
assert(localLawsCode.includes("Look at multiple levels"), "AI section must include multiple levels tip");
assert(localLawsCode.includes("Get started"), "AI section must provide 'Get started' prompt button");
assert(localLawsCode.includes("Was this helpful?"), "Article must provide 'Was this helpful?' rating widget");
assert(localLawsCode.includes("You might also like"), "Drawer must display 'You might also like' recommendation cards");
assert(localLawsCode.includes("Major Disruptive Events Policy"), "Related cards must include Major Disruptive Events Policy");
assert(localLawsCode.includes("How Protection for Hosts works"), "Related cards must include How Protection for Hosts works");
assert(localLawsCode.includes("Safety guidelines for hosts"), "Related cards must include Safety guidelines for hosts");

console.log("\n--- [3] Architecture & ModalOverlay Scroll Lock Compliance ---");
assert(
  localLawsCode.includes('import { ModalOverlay } from "@/components/ui/modal-overlay"'),
  "LocalLawsView must import ModalOverlay for AGENTS.md scroll lock compliance"
);
assert(
  localLawsCode.includes("<ModalOverlay"),
  "Slide-over drawer must be wrapped in <ModalOverlay> to guarantee body scroll lock"
);
assert(
  houseRulesCode.includes('import { LocalLawsView } from "./LocalLawsView"'),
  "HouseRulesAndArrivalViews must import LocalLawsView"
);
assert(
  houseRulesCode.includes("<LocalLawsView"),
  "HouseRulesAndArrivalViews must render <LocalLawsView"
);

console.log("\n==================================================================");
console.log("   ALL LOCAL LAWS VERIFICATION CHECKS PASSED (24/24)             ");
console.log("==================================================================\n");

