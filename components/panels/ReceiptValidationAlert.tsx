"use client";

import { AlertCircle, CheckCircle2, ScanLine } from "lucide-react";
import type { ReceiptValidationIssue } from "@/lib/receipt-validation-display";

type ReceiptValidationAlertProps = {
  issues: ReceiptValidationIssue[];
  mode?: "live" | "faked" | null;
  passed?: boolean;
  scanning?: boolean;
};

export function ReceiptValidationAlert({
  issues,
  mode,
  passed,
  scanning,
}: ReceiptValidationAlertProps) {
  if (scanning) {
    return (
      <div className="mt-2 flex items-start gap-2 rounded-md border border-sky-800/40 bg-sky-950/20 p-2.5 text-xs">
        <ScanLine className="mt-0.5 size-3.5 shrink-0 text-sky-400" />
        <p className="text-sky-200">AI receipt scan in progress…</p>
      </div>
    );
  }

  if (passed && issues.length === 0) {
    return (
      <div className="mt-2 flex items-start gap-2 rounded-md border border-emerald-800/40 bg-emerald-950/20 p-2.5 text-xs">
        <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-400" />
        <div>
          <p className="font-medium text-emerald-300">AI scan passed</p>
          <p className="text-muted-foreground">
            Patient name, amount, and service date match the claim.
            {mode === "faked" && " (Demo mode — no API key; values copied from claim.)"}
          </p>
        </div>
      </div>
    );
  }

  if (issues.length === 0) return null;

  return (
    <div className="mt-2 space-y-2 rounded-md border border-rose-800/50 bg-rose-950/20 p-2.5 text-xs">
      <div className="flex items-start gap-2">
        <AlertCircle className="mt-0.5 size-3.5 shrink-0 text-rose-400" />
        <div>
          <p className="font-medium text-rose-300">AI scan found issues</p>
          {mode === "faked" && (
            <p className="text-muted-foreground">
              Demo mode — no API key configured; validation uses claim data only.
            </p>
          )}
        </div>
      </div>
      <ul className="space-y-1.5 pl-5">
        {issues.map((issue) => (
          <li
            key={`${issue.field}-${issue.kind}`}
            className="list-disc text-rose-100/90 marker:text-rose-400"
          >
            <span className="font-medium capitalize">
              {issue.kind === "missing" ? "Missing" : "Mismatch"}
              {" · "}
              {issue.field === "patientName"
                ? "Patient name"
                : issue.field === "amount"
                  ? "Amount"
                  : "Service date"}
            </span>
            {": "}
            {issue.message}
          </li>
        ))}
      </ul>
    </div>
  );
}
