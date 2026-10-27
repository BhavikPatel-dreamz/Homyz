import { Role } from "@/generated/prisma/enums";
import { requirePageRole } from "@/lib/permissions/page-guards";
import { getSuperhostAssessmentHistory } from "@/services/superhost.service";
import { BackButton } from "@/components/ui/back-button";

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
  const chronological = [...evaluations].reverse();
  const rows = chronological.map((evaluation, index) => {
    const blocked = evaluation.failureReasons.some((reason) => /cannot be verified|cannot be determined/i.test(reason));
    const previous = chronological[index - 1];
    const outcome = blocked
      ? "Review required"
      : evaluation.qualified
        ? previous?.qualified ? "Renewed" : "Awarded"
        : previous?.qualified ? "Status lost" : "Not qualified";
    return { evaluation, blocked, outcome };
  }).reverse();

  return (
    <main className="mx-auto min-h-screen max-w-5xl bg-white px-4 py-8 text-[#1F1F1F] sm:px-6">
      <div className="flex items-center gap-3">
        <BackButton href="/host/insights?tab=superhost" aria-label="Back to Superhost" />
        <span className="text-sm font-semibold text-[#1F1F1F]">Back to Superhost</span>
      </div>
      <div className="mt-6 border-b border-[#E5E5E5] pb-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-[#727272]">Superhost Program</p>
        <h1 className="mt-1">Assessment history</h1>
        <p className="mt-1 text-sm text-[#727272]">
          Official quarterly evaluations are retained as finalized historical records.
        </p>
      </div>

      {evaluations.length === 0 ? (
        <div className="mt-8 rounded-3xl border border-[#E5E5E5] bg-white p-8 text-center text-sm text-[#727272] shadow-sm">
          No completed quarterly assessments are available yet.
        </div>
      ) : (
        <div className="mt-8 overflow-x-auto rounded-3xl border border-[#E5E5E5] bg-white shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[#F9F9F9] text-xs font-semibold uppercase tracking-wider text-[#727272]">
              <tr>
                <th className="px-5 py-3.5">Assessment</th>
                <th className="px-5 py-3.5">Period</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">Key measures</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E5E5]">
              {rows.map(({ evaluation, blocked, outcome }) => (
                <tr key={evaluation.id} className="align-top hover:bg-[#F9F9F9]/50 transition-colors">
                  <td className="px-5 py-4 font-semibold text-[#1F1F1F]">{dateFormat.format(evaluation.evaluationDate)}</td>
                  <td className="px-5 py-4 text-xs text-[#727272]">
                    {dateFormat.format(evaluation.windowStart)} – {dateFormat.format(evaluation.windowEnd)}
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        blocked
                          ? "border-amber-200 bg-amber-50 text-amber-900"
                          : evaluation.qualified
                          ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                          : "bg-[#F3F4F5] text-[#727272] border border-[#EDEDED]"
                      }`}
                    >
                      {outcome}
                    </span>
                    {blocked && <p className="mt-1 max-w-xs text-xs text-amber-900">{evaluation.failureReasons.find((reason) => /cannot be verified|cannot be determined/i.test(reason))}</p>}
                  </td>
                  <td className="px-5 py-4 text-xs text-[#1F1F1F]">
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
