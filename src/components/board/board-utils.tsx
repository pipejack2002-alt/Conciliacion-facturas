/* eslint-disable react-refresh/only-export-components */
import { useState } from "react";
import { Copy } from "lucide-react";
import { useConciliacion, type TabId } from "@/lib/store";
import { cn } from "@/lib/cn";

export function getInitials(name?: string): string {
  if (!name) return "DOC";
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export function shortTipo(t: string): string {
  if (t.includes("Factura")) return "Factura";
  if (t.includes("soporte")) return "Doc. soporte";
  if (t.includes("Nomina") || t.includes("Nómina")) return "Nómina";
  if (t.includes("crédito") || t.includes("credito")) return "Nota crédito";
  if (t.includes("equivalente")) return "Doc. equivalente";
  return t;
}

export function Empty({ tab }: { tab: TabId }) {
  return (
    <p className="px-3 py-10 text-center text-sm text-ink-muted">
      {tab === "pendiente" || tab === "cola" || tab === "posible_typo"
        ? "Nada pendiente en esta vista. Revisa las otras pestañas o sube otro mes."
        : "No hay documentos en esta vista."}
    </p>
  );
}

export function CopyButton({
  text,
  label = "Copiar",
  successMessage,
  className,
  children,
}: {
  text: string;
  label?: string;
  successMessage?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  const [, setCopied] = useState(false);
  const flash = useConciliacion((s) => s.flash);

  function handleCopy(e: React.MouseEvent) {
    e.stopPropagation();
    if (!text) return;
    void navigator.clipboard.writeText(text);
    setCopied(true);
    flash(successMessage || `${text} copiado al portapapeles`);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={label}
      aria-label={label}
      className={cn(
        "inline-flex items-center justify-center transition-colors cursor-pointer",
        className,
      )}
    >
      {children || <Copy className="size-3.5 text-current opacity-70 hover:opacity-100" />}
    </button>
  );
}

export function Field({
  label,
  value,
  mono,
  copyable = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
  copyable?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs text-ink-subtle">{label}</dt>
      <dd className={cn("mt-0.5 flex items-center gap-1.5 select-text", mono && "font-mono text-xs")}>
        <span className="select-text break-words">{value || "—"}</span>
        {copyable && value && value !== "—" && (
          <CopyButton
            text={value}
            label={`Copiar ${label}`}
            successMessage={`${label}: "${value}" copiado al portapapeles`}
            className="rounded p-0.5 text-ink-subtle hover:bg-teal-soft hover:text-teal transition cursor-pointer shrink-0"
          >
            <Copy className="size-3" />
          </CopyButton>
        )}
      </dd>
    </div>
  );
}
