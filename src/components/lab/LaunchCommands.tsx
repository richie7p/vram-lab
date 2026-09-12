import { BACKENDS, launchCommands } from "@/lib/lab/commands";
import type { BackendId, Fit, Gpu, KvPrecision, Model, Quant } from "@/lib/lab/types";
import { CopyButton } from "./CopyButton";
import { cn } from "@/lib/utils";

export function LaunchCommands({
  gpu,
  model,
  quant,
  context,
  kv,
  fit,
  backend,
  onBackend,
}: {
  gpu: Gpu;
  model: Model;
  quant: Quant;
  context: number;
  kv: KvPrecision;
  fit: Fit;
  backend: BackendId;
  onBackend: (b: BackendId) => void;
}) {
  const cmds = launchCommands({ gpu, model, quant, context, kv, fit, backend });

  return (
    <section className="rounded-lg bg-bg-elevated p-4 shadow-border sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xs font-medium tracking-wide text-muted uppercase">
          啟動指令
        </h3>
        <div className="flex rounded-full bg-surface p-1 shadow-border">
          {BACKENDS.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => onBackend(b.id)}
              className={cn(
                "min-h-8 rounded-full px-3 text-xs font-medium",
                backend === b.id ? "bg-fg text-bg" : "text-muted",
              )}
            >
              {b.label}
            </button>
          ))}
        </div>
      </div>
      <pre className="overflow-x-auto rounded-md bg-bg p-3 font-mono text-xs leading-relaxed text-accent">
        {cmds.body}
      </pre>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <CopyButton text={cmds.body} label="複製指令" />
        <p className="text-xs text-subtle">
          {cmds.ggufFile}
        </p>
      </div>
      {cmds.unsupported.length > 0 ? (
        <ul className="mt-3 space-y-1">
          {cmds.unsupported.map((n) => (
            <li key={n} className="text-xs leading-relaxed text-tight">
              {n}
            </li>
          ))}
        </ul>
      ) : null}
      <ul className="mt-3 space-y-1">
        {cmds.notes.map((n) => (
          <li key={n} className="text-xs leading-relaxed text-subtle">
            {n}
          </li>
        ))}
      </ul>
    </section>
  );
}
