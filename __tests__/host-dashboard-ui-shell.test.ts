import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const read = (relativePath: string) =>
  fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");

test("host dashboard, Today, Calendar, and Listings omit the shortcut workspace navigation", () => {
  const dashboardPage = read("app/(protected)/host/dashboard/page.tsx");
  const todayWorkspace = read("components/host/host-today-workspace.tsx");
  const calendarWorkspace = read("components/host/host-calendar-workspace.tsx");

  assert.doesNotMatch(dashboardPage, /HostSubNav/);
  assert.match(dashboardPage, /<HostHeader\s*\/>/);
  assert.match(dashboardPage, /HOST_REPORTING_MAIN_CLASS/);
  assert.doesNotMatch(todayWorkspace, /HostSubNav/);
  assert.doesNotMatch(calendarWorkspace, /HostSubNav/);
});

test("dashboard loading shell mirrors the route and uses the shared dashboard geometry skeleton", () => {
  const loadingPage = read("app/(protected)/host/dashboard/loading.tsx");
  const dashboardPage = read("app/(protected)/host/dashboard/page.tsx");
  const overview = read("components/host/dashboard/host-kpi-overview.tsx");

  assert.match(loadingPage, /HostDashboardOverviewSkeleton/);
  assert.doesNotMatch(loadingPage, /HostSubNav/);
  assert.match(loadingPage, /HOST_REPORTING_MAIN_CLASS/);
  assert.match(dashboardPage, /HOST_REPORTING_MAIN_CLASS/);
  assert.match(overview, /primaryKpiGridClass/);
  assert.match(overview, /secondaryKpiGridClass/);
  assert.match(overview, /export function HostDashboardOverviewSkeleton/);
  assert.match(overview, /aria-busy="true"/);
});
