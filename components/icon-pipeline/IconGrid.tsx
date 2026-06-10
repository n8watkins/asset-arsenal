"use client";

import type { GeneratedIcon, GeneratedIconStatus } from "@/types/icon-pipeline";

export interface IconGridProps {
  icons: GeneratedIcon[];
  onRegenerate: (iconId: string) => void;
  onDownload: (icon: GeneratedIcon) => void;
  onDownloadAll?: () => void;
  onCopyManifest?: () => void;
  onCopyPrompts?: () => void;
}

const STATUS_CONFIG: Record<
  GeneratedIconStatus,
  { label: string; dotClass: string; textClass: string }
> = {
  pending: {
    label: "Pending",
    dotClass: "bg-zinc-500",
    textClass: "text-zinc-400",
  },
  generating: {
    label: "Generating",
    dotClass: "bg-cyan-400 animate-pulse",
    textClass: "text-cyan-400",
  },
  success: {
    label: "Done",
    dotClass: "bg-emerald-400",
    textClass: "text-emerald-400",
  },
  failed: {
    label: "Failed",
    dotClass: "bg-red-400",
    textClass: "text-red-400",
  },
};

function StatusIndicator({ status }: { status: GeneratedIconStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span className={`flex items-center gap-1.5 text-xs font-medium ${cfg.textClass}`}>
      <span className={`w-2 h-2 rounded-full inline-block ${cfg.dotClass}`} />
      {cfg.label}
    </span>
  );
}

function IconCard({
  icon,
  onRegenerate,
  onDownload,
}: {
  icon: GeneratedIcon;
  onRegenerate: (id: string) => void;
  onDownload: (icon: GeneratedIcon) => void;
}) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden flex flex-col">
      {/* Image area */}
      <div className="bg-zinc-950 flex items-center justify-center aspect-square relative">
        {icon.imageUrl ? (
          <img
            src={icon.imageUrl}
            alt={icon.iconName}
            className="w-full h-full object-contain p-3"
          />
        ) : (
          <div className="flex flex-col items-center gap-2 text-zinc-700">
            {icon.status === "generating" ? (
              <>
                <span className="animate-spin w-8 h-8 border-2 border-zinc-700 border-t-cyan-400 rounded-full inline-block" />
                <span className="text-cyan-400 text-xs">Generating…</span>
              </>
            ) : (
              <>
                <svg
                  className="w-10 h-10"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3 9.75h.008v.008H3V9.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3 3.75h18A2.25 2.25 0 0123.25 6v12A2.25 2.25 0 0121 20.25H3A2.25 2.25 0 01.75 18V6A2.25 2.25 0 013 3.75z"
                  />
                </svg>
                <span className="text-xs">No image</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Card footer */}
      <div className="p-3 flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-zinc-100 text-sm font-medium truncate">
            {icon.iconName}
          </span>
          <StatusIndicator status={icon.status} />
        </div>

        {icon.status === "failed" && icon.error && (
          <p className="text-red-400 text-xs bg-red-400/10 border border-red-400/20 rounded-lg px-2 py-1.5">
            {icon.error}
          </p>
        )}

        {/* Action buttons */}
        <div className="flex gap-1.5 flex-wrap">
          {(icon.status === "failed" || icon.status === "success") && (
            <button
              onClick={() => onRegenerate(icon.id)}
              className="text-xs border border-zinc-700 hover:border-zinc-500 text-zinc-300 px-2.5 py-1 rounded-lg transition-colors focus:outline-none focus:ring-1 focus:ring-cyan-500"
            >
              Regenerate
            </button>
          )}
          {icon.status === "success" && icon.imageUrl && (
            <button
              onClick={() => onDownload(icon)}
              className="text-xs border border-zinc-700 hover:border-emerald-500/60 text-emerald-400 px-2.5 py-1 rounded-lg transition-colors focus:outline-none focus:ring-1 focus:ring-cyan-500"
            >
              Download
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function IconGrid({
  icons,
  onRegenerate,
  onDownload,
  onDownloadAll,
  onCopyManifest,
  onCopyPrompts,
}: IconGridProps) {
  const successCount = icons.filter((i) => i.status === "success").length;
  const failedCount = icons.filter((i) => i.status === "failed").length;
  const total = icons.length;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-zinc-100 text-lg font-semibold">
            Generated Icons
          </h2>
          <p className="text-zinc-400 text-sm mt-0.5">
            <span className="text-emerald-400 font-medium">{successCount}</span>
            {" / "}
            {total} generated
            {failedCount > 0 && (
              <>
                ,{" "}
                <span className="text-red-400 font-medium">{failedCount}</span>{" "}
                failed
              </>
            )}
          </p>
        </div>

        {/* Global action buttons */}
        <div className="flex gap-2 flex-wrap">
          {onCopyManifest && (
            <button
              onClick={onCopyManifest}
              className="text-xs border border-zinc-700 hover:border-zinc-500 text-zinc-300 px-3 py-1.5 rounded-lg transition-colors focus:outline-none focus:ring-1 focus:ring-cyan-500"
            >
              Copy manifest
            </button>
          )}
          {onCopyPrompts && (
            <button
              onClick={onCopyPrompts}
              className="text-xs border border-zinc-700 hover:border-zinc-500 text-zinc-300 px-3 py-1.5 rounded-lg transition-colors focus:outline-none focus:ring-1 focus:ring-cyan-500"
            >
              Copy prompts
            </button>
          )}
          {onDownloadAll && (
            <button
              onClick={onDownloadAll}
              disabled={successCount === 0}
              className="text-xs bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:pointer-events-none text-white font-medium px-3 py-1.5 rounded-lg transition-colors focus:outline-none focus:ring-1 focus:ring-cyan-500"
            >
              Download all
            </button>
          )}
        </div>
      </div>

      {/* Grid */}
      {icons.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-16 text-zinc-600">
          <svg
            className="w-10 h-10"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M2.25 7.125C2.25 6.504 2.754 6 3.375 6h6c.621 0 1.125.504 1.125 1.125v3.75c0 .621-.504 1.125-1.125 1.125h-6a1.125 1.125 0 01-1.125-1.125v-3.75zM14.25 8.625c0-.621.504-1.125 1.125-1.125h5.25c.621 0 1.125.504 1.125 1.125v8.25c0 .621-.504 1.125-1.125 1.125h-5.25a1.125 1.125 0 01-1.125-1.125v-8.25zM3.75 16.125c0-.621.504-1.125 1.125-1.125h5.25c.621 0 1.125.504 1.125 1.125v2.25c0 .621-.504 1.125-1.125 1.125h-5.25a1.125 1.125 0 01-1.125-1.125v-2.25z"
            />
          </svg>
          <span className="text-sm">No icons yet</span>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {icons.map((icon) => (
            <IconCard
              key={icon.id}
              icon={icon}
              onRegenerate={onRegenerate}
              onDownload={onDownload}
            />
          ))}
        </div>
      )}
    </div>
  );
}
