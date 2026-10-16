import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const read = (relativePath: string) =>
  fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");

test("host performance reporting is rendered on the dedicated dashboard route", () => {
  const todayPage = read("app/(protected)/host/today/page.tsx");
  const todayWorkspace = read("components/host/host-today-workspace.tsx");
  const dashboardPage = read("app/(protected)/host/dashboard/page.tsx");

  assert.doesNotMatch(todayPage, /getHostDashboardData|initialDashboardData/);
  assert.doesNotMatch(todayWorkspace, /HostKpiOverview|initialDashboardData/);
  assert.match(dashboardPage, /requirePageRole\(\[Role\.HOST, Role\.ADMIN\]\)/);
  assert.match(dashboardPage, /getHostDashboardData\(actor\)/);
  assert.match(dashboardPage, /<HostKpiOverview initialData=\{dashboardData\} \/>/);
});

test("host entry points route to the dedicated dashboard", () => {
  const loginPage = read("app/(auth)/login/page.tsx");
  const registerPage = read("app/(auth)/register/page.tsx");
  const authForm = read("components/forms/homyz-auth-form.tsx");
  const appHeader = read("components/dashboard/app-header.tsx");

  assert.match(loginPage, /redirect\("\/host\/dashboard"\)/);
  assert.match(registerPage, /redirect\("\/host\/dashboard"\)/);
  assert.match(authForm, /return "\/host\/dashboard"/);
  assert.match(appHeader, /href="\/host\/dashboard"/);
});
