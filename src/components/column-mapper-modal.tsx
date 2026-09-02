import { useState, useEffect } from "react";
import {
  X,
  CheckCircle2,
  SlidersHorizontal,
  TableProperties,
  Save,
  RotateCcw,
  Sparkles,
  HelpCircle,
  AlertTriangle,
} from "lucide-react";
import type { ColumnKey, ColumnMapping, DetectedProfile, SoftwareProfileId } from "@/lib/types";
import {
  SOFTWARE_PROFILES,
  buildMappingFromHeaders,
  saveCustomMapping,
  loadSavedCustomMappings,
} from "@/lib/software-profiles";
import { cn } from "@/lib/cn";

interface Props {
  open: boolean;
  onClose: () => void;
  detectedProfile: DetectedProfile;
  headers: string[];
  rowsSample: string[][];
  onApplyMapping: (mapping: ColumnMapping, profileId: SoftwareProfileId, headerRow: number) => void;
}

const FIELD_DEFINITIONS: {
  key: ColumnKey;
  label: string;
  desc: string;
  required: boolean;
  tag: string;
}[] = [
  {
    key: "nit",
    label: "NIT / Cédula Tercero",
    desc: "Identificación de la contraparte sin dígito de verificación.",
    required: true,
    tag: "Crítico",
  },
  {
    key: "cuenta",
    label: "Cuenta Contable (PUC)",
    desc: "Código contable (clase 1, 2, 4, 5, 6, 7).",
    required: true,
    tag: "Crítico",
  },
  {
    key: "debito",
    label: "Valor Débito",
    desc: "Importe débito del movimiento contable.",
    required: true,
    tag: "Crítico",
  },
  {
    key: "credito",
    label: "Valor Crédito",
    desc: "Importe crédito del movimiento contable.",
    required: true,
    tag: "Crítico",
  },
  {
    key: "referencia",
    label: "Factura Proveedor / Doc. Referencia",
    desc: "Doc. Fuente o Factura externa (World Office, Siigo Nube, Helisa, Alegra).",
    required: false,
    tag: "Recomendado",
  },
  {
    key: "descripcion",
    label: "Concepto / Detalle / Glosa",
    desc: "Descripción de la transacción o detalle digitado.",
    required: false,
    tag: "Recomendado",
  },
  {
    key: "comprobante",
    label: "Comprobante / Nro. Asiento",
    desc: "Consecutivo interno del voucher en el software.",
    required: false,
    tag: "Útil",
  },
  {
    key: "fecha",
    label: "Fecha Contable",
    desc: "Fecha de causación o contabilización.",
    required: false,
    tag: "Útil",
  },
  {
    key: "nombre",
    label: "Nombre / Razón Social Tercero",
    desc: "Nombre o razón social de la contraparte.",
    required: false,
    tag: "Opcional",
  },
  {
    key: "cuentaNombre",
    label: "Nombre de la Cuenta",
    desc: "Descripción o denominación del código PUC.",
    required: false,
    tag: "Opcional",
  },
  {
    key: "cruce",
    label: "Cruce de Cartera / Inventario",
    desc: "Campo de cruce de cartera (típico de Siigo Pyme).",
    required: false,
    tag: "Opcional",
  },
  {
    key: "observacion",
    label: "Observación Adicional",
    desc: "Notas o comentarios extendidos de la línea.",
    required: false,
    tag: "Opcional",
  },
];

export function ColumnMapperModal({
  open,
  onClose,
  detectedProfile,
  headers,
  rowsSample,
  onApplyMapping,
}: Props) {
  const [selectedProfileId, setSelectedProfileId] = useState<SoftwareProfileId>(detectedProfile.id);
  const [headerRow, setHeaderRow] = useState<number>(detectedProfile.headerRow);
  const [mapping, setMapping] = useState<ColumnMapping>({ ...detectedProfile.mapping });
  const [customProfileName, setCustomProfileName] = useState("");
  const [savedProfiles, setSavedProfiles] = useState<Record<string, ColumnMapping>>({});
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setSelectedProfileId(detectedProfile.id);
      setHeaderRow(detectedProfile.headerRow);
      setMapping({ ...detectedProfile.mapping });
      setSavedProfiles(loadSavedCustomMappings());
      setToastMsg(null);
    }
  }, [open, detectedProfile]);

  if (!open) return null;

  function handleProfileChange(newProfileId: SoftwareProfileId) {
    setSelectedProfileId(newProfileId);
    if (newProfileId !== "custom" && newProfileId !== "auto") {
      const newMapping = buildMappingFromHeaders(headers, newProfileId);
      setMapping(newMapping);
      setToastMsg(`Mapeo actualizado para ${SOFTWARE_PROFILES[newProfileId]?.label}.`);
      setTimeout(() => setToastMsg(null), 3000);
    }
  }

  function handleLoadCustomProfile(name: string) {
    if (savedProfiles[name]) {
      setMapping(savedProfiles[name]);
      setSelectedProfileId("custom");
      setToastMsg(`Perfil personalizado '${name}' cargado.`);
      setTimeout(() => setToastMsg(null), 3000);
    }
  }

  function handleColumnChange(key: ColumnKey, valueStr: string) {
    const colIdx = valueStr === "-1" ? undefined : parseInt(valueStr, 10);
    setMapping((prev) => {
      const next = { ...prev };
      if (colIdx == null || isNaN(colIdx)) {
        delete next[key];
      } else {
        next[key] = colIdx;
      }
      return next;
    });
  }

  function handleSaveCustom() {
    const name = customProfileName.trim();
    if (!name) return;
    saveCustomMapping(name, mapping);
    setSavedProfiles(loadSavedCustomMappings());
    setShowSaveInput(false);
    setCustomProfileName("");
    setToastMsg(`Perfil '${name}' guardado en tu navegador.`);
    setTimeout(() => setToastMsg(null), 3000);
  }

  function handleReset() {
    setMapping({ ...detectedProfile.mapping });
    setHeaderRow(detectedProfile.headerRow);
    setSelectedProfileId(detectedProfile.id);
    setToastMsg("Mapeo restaurado a la auto-detección inicial.");
    setTimeout(() => setToastMsg(null), 3000);
  }

  function handleApply() {
    onApplyMapping(mapping, selectedProfileId, headerRow);
    onClose();
  }

  const missingRequired = FIELD_DEFINITIONS.filter(
    (f) => f.required && (mapping[f.key] == null || mapping[f.key]! < 0),
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden text-slate-800 dark:text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20">
              <SlidersHorizontal className="size-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Mapeador Universal de Software Contable
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  Multi-ERP 2026
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Ajusta las columnas para cualquier software (Siigo Nube, World Office, Helisa, Alegra, Loggro o personalizadas).
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Notificación Toast local */}
        {toastMsg && (
          <div className="px-6 py-2 bg-emerald-500/10 border-b border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs font-medium flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />
            <span>{toastMsg}</span>
          </div>
        )}

        {/* Body scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* Fila de Selección de Software y Confianza */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                Software Contable / Perfil
              </label>
              <select
                value={selectedProfileId}
                onChange={(e) => handleProfileChange(e.target.value as SoftwareProfileId)}
                className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-slate-800 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-teal-500 font-medium"
              >
                {Object.values(SOFTWARE_PROFILES).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label} {p.vendor !== "Universal" && p.vendor !== "Genérico" ? `(${p.vendor})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                Detección del Archivo
              </label>
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                <Sparkles className="size-4 text-teal-500 shrink-0" />
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                  {detectedProfile.label}
                </span>
                <span
                  className={cn(
                    "ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-md",
                    detectedProfile.confidence >= 90
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                      : "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300",
                  )}
                >
                  {detectedProfile.confidence}%
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                Fila de Encabezados (0-Index)
              </label>
              <input
                type="number"
                min="0"
                max="30"
                value={headerRow}
                onChange={(e) => setHeaderRow(Math.max(0, parseInt(e.target.value || "0", 10)))}
                className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-slate-800 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-teal-500 font-medium"
              />
            </div>
          </div>

          {/* Perfiles guardados por el usuario si existen */}
          {Object.keys(savedProfiles).length > 0 && (
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <span className="font-semibold text-slate-500">Plantillas guardadas:</span>
              {Object.keys(savedProfiles).map((name) => (
                <button
                  key={name}
                  onClick={() => handleLoadCustomProfile(name)}
                  className="px-2.5 py-1 rounded-md bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-300 hover:bg-teal-100 dark:hover:bg-teal-900/60 transition-colors font-medium cursor-pointer"
                >
                  {name}
                </button>
              ))}
            </div>
          )}

          {/* Alerta si faltan columnas críticas */}
          {missingRequired.length > 0 && (
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-200 text-xs flex items-start gap-2.5">
              <AlertTriangle className="size-4 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <strong className="font-bold">Columnas esenciales sin asignar: </strong>
                {missingRequired.map((m) => m.label).join(", ")}. Por favor asigna estas columnas
                para garantizar que la conciliación fiscal se ejecute con precisión.
              </div>
            </div>
          )}

          {/* Grid de Asignación de Columnas */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center justify-between">
              <span>Asignación de Columnas del Archivo Contable</span>
              <span className="text-[11px] font-normal normal-case text-slate-400">
                {headers.length} columnas disponibles en el Excel
              </span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {FIELD_DEFINITIONS.map((def) => {
                const assignedIdx = mapping[def.key];
                const isAssigned = assignedIdx != null && assignedIdx >= 0;

                return (
                  <div
                    key={def.key}
                    className={cn(
                      "p-3 rounded-xl border transition-all text-xs flex flex-col justify-between gap-2",
                      isAssigned
                        ? "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-2xs"
                        : def.required
                          ? "bg-amber-50/50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800/60"
                          : "bg-slate-50/70 dark:bg-slate-900/40 border-slate-200/60 dark:border-slate-800/60",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white">
                          <span>{def.label}</span>
                          {def.required && <span className="text-rose-500 font-extrabold">*</span>}
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight mt-0.5">
                          {def.desc}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-sm shrink-0",
                          def.tag === "Crítico"
                            ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
                            : def.tag === "Recomendado"
                              ? "bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300"
                              : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
                        )}
                      >
                        {def.tag}
                      </span>
                    </div>

                    <select
                      value={assignedIdx ?? -1}
                      onChange={(e) => handleColumnChange(def.key, e.target.value)}
                      className={cn(
                        "w-full text-xs rounded-lg border px-2.5 py-1.5 font-medium transition-colors cursor-pointer",
                        isAssigned
                          ? "border-teal-500/40 bg-teal-50/30 dark:bg-teal-950/20 text-teal-900 dark:text-teal-200 font-semibold"
                          : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-500",
                      )}
                    >
                      <option value="-1">-- No Asignada / No Aplica --</option>
                      {headers.map((h, i) => (
                        <option key={i} value={i}>
                          Col. {i + 1}: {h || `(Sin título - Col ${i + 1})`}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Previsualización en Vivo de las Filas de Muestra */}
          {rowsSample.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <TableProperties className="size-3.5 text-teal-500" />
                <span>Previsualización de Datos del Archivo (Primeras Filas)</span>
              </h3>

              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 max-h-48 text-[11px]">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-slate-100/80 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700">
                      {headers.slice(0, 14).map((h, i) => {
                        // Encontrar si esta columna fue asignada a alguna clave
                        const assignedKey = Object.entries(mapping).find(
                          ([, colIdx]) => colIdx === i,
                        )?.[0];

                        return (
                          <th
                            key={i}
                            className="px-2.5 py-2 text-left font-bold text-slate-700 dark:text-slate-300 border-r border-slate-200 dark:border-slate-800 whitespace-nowrap"
                          >
                            <div className="text-[9px] text-slate-400 font-normal">Col {i + 1}</div>
                            <div className="truncate max-w-[130px]" title={h}>
                              {h || `Columna ${i + 1}`}
                            </div>
                            {assignedKey && (
                              <span className="inline-block mt-0.5 text-[9px] font-extrabold px-1 py-0.2 rounded-xs bg-teal-500 text-white uppercase">
                                {assignedKey}
                              </span>
                            )}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {rowsSample.slice(1, 5).map((row, rIdx) => (
                      <tr
                        key={rIdx}
                        className="border-b border-slate-100 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800/30"
                      >
                        {row.slice(0, 14).map((cell, cIdx) => (
                          <td
                            key={cIdx}
                            className="px-2.5 py-1.5 text-slate-600 dark:text-slate-400 border-r border-slate-100 dark:border-slate-800 whitespace-nowrap truncate max-w-[130px]"
                            title={cell}
                          >
                            {cell || <span className="text-slate-300 dark:text-slate-600">—</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <button
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 text-xs font-semibold cursor-pointer"
            >
              <RotateCcw className="size-3.5 text-slate-500" />
              <span>Restablecer</span>
            </button>

            {!showSaveInput ? (
              <button
                onClick={() => setShowSaveInput(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 text-xs font-semibold cursor-pointer"
              >
                <Save className="size-3.5 text-teal-500" />
                <span>Guardar Plantilla</span>
              </button>
            ) : (
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  placeholder="Nombre de plantilla (ej. Mi ERP)"
                  value={customProfileName}
                  onChange={(e) => setCustomProfileName(e.target.value)}
                  className="text-xs rounded-lg border border-teal-500 px-2.5 py-1 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-hidden w-44"
                />
                <button
                  onClick={handleSaveCustom}
                  className="px-2.5 py-1 rounded-lg bg-teal-600 text-white text-xs font-bold hover:bg-teal-700 cursor-pointer"
                >
                  OK
                </button>
                <button
                  onClick={() => setShowSaveInput(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
                >
                  ✕
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              onClick={handleApply}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-xs transition-all cursor-pointer"
            >
              <CheckCircle2 className="size-4" />
              <span>Aplicar y Continuar</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
