"use client";

import { useState } from "react";
import type { IconExtractionRun } from "@/types/icon-pipeline";
import { MODEL_ROLES } from "@/lib/icon/models";

export interface DebugDrawerProps {
  run: IconExtractionRun;
}

export default function DebugDrawer({ run }: DebugDrawerProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Toggle button — fixed bottom-right */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-5 right-5 z-50 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 text-xs font-mono px-3 py-2 rounded-xl shadow-lg transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500 flex items-center gap-2"
        aria-label="Toggle debug drawer"
      >
        <svg
          className="w-3.5 h-3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0021 18V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v12a2.25 2.25 0 002.25 2.25z"
          />
        </svg>
        {open ? "Close debug" : "Debug"}
      </button>

      {/* Drawer panel — fixed right side */}
      {open && (
        <div className="fixed top-0 right-0 h-full w-full max-w-lg z-40 bg-zinc-950 border-l border-zinc-800 shadow-2xl flex flex-col overflow-hidden">
          {/* Drawer header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 shrink-0">
            <div>
              <h3 className="text-zinc-100 font-semibold text-sm">
                Debug Drawer
              </h3>
              <p className="text-zinc-500 text-xs mt-0.5">
                Run ID:{" "}
                <span className="font-mono text-cyan-400">{run.id}</span>
              </p>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-zinc-400 hover:text-zinc-200 transition-colors p-1 rounded-lg focus:outline-none focus:ring-1 focus:ring-cyan-500"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-6">
            {/* Pipeline step */}
            <section>
              <p className="text-zinc-500 text-xs font-medium uppercase tracking-wide mb-2">
                Current Step
              </p>
              <span className="font-mono text-cyan-400 text-sm bg-zinc-900 border border-zinc-700 px-3 py-1 rounded-lg inline-block">
                {run.currentStep}
              </span>
            </section>

            {/* Model roles */}
            <section>
              <p className="text-zinc-500 text-xs font-medium uppercase tracking-wide mb-2">
                Model Roles
              </p>
              <pre className="bg-zinc-900 border border-zinc-700 rounded-xl p-3 text-xs text-zinc-300 font-mono overflow-auto">
                {JSON.stringify(MODEL_ROLES, null, 2)}
              </pre>
            </section>

            {/* Manifest */}
            <section>
              <p className="text-zinc-500 text-xs font-medium uppercase tracking-wide mb-2">
                Manifest
              </p>
              <pre className="bg-zinc-900 border border-zinc-700 rounded-xl p-3 text-xs text-zinc-300 font-mono overflow-auto max-h-64">
                {run.manifest
                  ? JSON.stringify(run.manifest, null, 2)
                  : "null"}
              </pre>
            </section>

            {/* Prompt pack */}
            <section>
              <p className="text-zinc-500 text-xs font-medium uppercase tracking-wide mb-2">
                Prompt Pack
              </p>
              <pre className="bg-zinc-900 border border-zinc-700 rounded-xl p-3 text-xs text-zinc-300 font-mono overflow-auto max-h-64">
                {run.promptPack
                  ? JSON.stringify(run.promptPack, null, 2)
                  : "null"}
              </pre>
            </section>

            {/* Errors */}
            <section>
              <p className="text-zinc-500 text-xs font-medium uppercase tracking-wide mb-2">
                Errors ({run.errors.length})
              </p>
              {run.errors.length === 0 ? (
                <p className="text-zinc-600 text-xs font-mono">No errors</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {run.errors.map((err, i) => (
                    <div
                      key={i}
                      className="bg-red-950/40 border border-red-700/40 rounded-xl p-3"
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-red-400 text-xs font-mono font-semibold">
                          {err.step}
                        </span>
                        <span className="text-zinc-600 text-xs">
                          {err.createdAt}
                        </span>
                      </div>
                      <p className="text-red-300 text-xs">{err.message}</p>
                      {err.rawError !== undefined && (
                        <pre className="text-zinc-500 text-xs mt-2 font-mono overflow-auto">
                          {JSON.stringify(err.rawError, null, 2)}
                        </pre>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Timestamps */}
            <section>
              <p className="text-zinc-500 text-xs font-medium uppercase tracking-wide mb-2">
                Timestamps
              </p>
              <div className="flex flex-col gap-1">
                <p className="text-zinc-400 text-xs font-mono">
                  <span className="text-zinc-600">created: </span>
                  {run.createdAt}
                </p>
                <p className="text-zinc-400 text-xs font-mono">
                  <span className="text-zinc-600">updated: </span>
                  {run.updatedAt}
                </p>
              </div>
            </section>
          </div>
        </div>
      )}

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/40"
          onClick={() => setOpen(false)}
        />
      )}
    </>
  );
}
