import Link from "next/link";
import { Role } from "@/generated/prisma/enums";
import { requirePageRole } from "@/lib/permissions/page-guards";
import { getSuperhostAssessmentHistory } from "@/services/superhost.service";

export const dynamic = "force-dynamic";

const dateFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

export default async function SuperhostAssessmentHistoryPage() {
  const actor = await requirePageRole([Role.HOST, Role.ADMIN]);
  const evaluations = await getSuperhostAssessmentHistory(actor.id);

  return (
    <main className="mx-auto min-h-screen max-w-4xl bg-white px-4 py-8 text-zinc-950 sm:px-6">
      <Link href="/host/insights?tab=superhost" className="text-sm font-semibold text-zinc-700 underline">
        Back to Superhost
      </Link>
      <h1 className="mt-5 text-3xl font-bold">Superhost assessment history</h1>
      <p className="mt-2 text-sm text-zinc-600">
        Official quarterly evaluations are retained as finalized historical records.
      </p>

      {evaluations.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-zinc-200 p-6 text-sm text-zinc-600">
          No completed quarterly assessments are available yet.
        </div>
      ) : (
        <div className="mt-8 overflow-x-auto rounded-2xl border border-zinc-200">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-3">Assessment</th>
                <th className="px-4 py-3">Period</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Key measures</th>
              </tr>
            </thead>
            <tbody>
              {evaluations.map((evaluation: any) => (
                <tr key={evaluation.id} className="border-t border-zinc-200 align-top">
                  <td className="px-4 py-4 font-medium">{dateFormat.format(evaluation.evaluationDate)}</td>
                  <td className="px-4 py-4 text-zinc-600">
                    {dateFormat.format(evaluation.windowStart)} – {dateFormat.format(evaluation.windowEnd)}
                  </td>
                  <td className="px-4 py-4">
                    <span className={evaluation.qualified ? "font-semibold text-emerald-700" : "font-semibold text-zinc-600"}>
                      {evaluation.qualified ? "Qualified" : "Not qualified"}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-zinc-600">
                    {evaluation.completedReservations} stays · {evaluation.overallRating?.toFixed(2) ?? "No"} rating · {evaluation.responseRatePercentage ?? "No"}% response
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
