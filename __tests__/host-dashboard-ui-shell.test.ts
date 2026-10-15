import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const read = (relativePath: string) =>
  fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");

test("host dashboard omits workspace navigation without changing other host navigation users", () => {
  const dashboardPage = read("app/(protected)/host/dashboard/page.tsx");
  const todayWorkspace = read("components/host/host-today-workspace.tsx");
  const calendarWorkspace = read("components/host/host-calendar-workspace.tsx");

  assert.doesNotMatch(dashboardPage, /HostSubNav/);
  assert.match(dashboardPage, /<HostHeader\s*\/>/);
  assert.match(dashboardPage, /pb-5 pt-4 sm:flex-1 sm:pt-10 xl:pb-24/);
  assert.match(todayWorkspace, /<HostSubNav/);
  assert.match(calendarWorkspace, /<HostSubNav activeTab="calendar"/);
});

test("dashboard loading shell mirrors the route and uses the shared dashboard geometry skeleton", () => {
  const loadingPage = read("app/(protected)/host/dashboard/loading.tsx");
  const dashboardPage = read("app/(protected)/host/dashboard/page.tsx");
  const overview = read("components/host/dashboard/host-kpi-overview.tsx");

  assert.match(loadingPage, /HostDashboardOverviewSkeleton/);
  assert.doesNotMatch(loadingPage, /HostSubNav/);
  assert.match(loadingPage, /pb-5 pt-4 sm:flex-1 sm:pt-10 xl:pb-24/);
  assert.match(dashboardPage, /pb-5 pt-4 sm:flex-1 sm:pt-10 xl:pb-24/);
  assert.match(overview, /primaryKpiGridClass/);
  assert.match(overview, /secondaryKpiGridClass/);
  assert.match(overview, /export function HostDashboardOverviewSkeleton/);
  assert.match(overview, /aria-busy="true"/);
});
