import { memo } from "react";

interface AppLogoProps {
  className?: string;
  size?: number;
}

export const AppLogo = memo(function AppLogo({
  className = "size-9",
  size = 36,
}: AppLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Logo Conciliador Fiscal & Bancario TributoApp"
    >
      <defs>
        {/* Gradiente principal Teal a Esmeralda */}
        <linearGradient id="logoBgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0f766e" />
          <stop offset="50%" stopColor="#0d9488" />
          <stop offset="100%" stopColor="#059669" />
        </linearGradient>

        {/* Gradiente de luz en el borde superior */}
        <linearGradient id="logoBorderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#5eead4" stopOpacity="0.8" />
          <stop offset="50%" stopColor="#2dd4bf" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#10b981" stopOpacity="0.2" />
        </linearGradient>

        {/* Sombra de relieve interior */}
        <filter id="logoShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#042f2e" floodOpacity="0.35" />
        </filter>
      </defs>

      {/* Contenedor Squircle / Hexágono redondeado prémium */}
      <rect
        x="1"
        y="1"
        width="34"
        height="34"
        rx="10"
        fill="url(#logoBgGrad)"
        filter="url(#logoShadow)"
      />
      <rect
        x="1.5"
        y="1.5"
        width="33"
        height="33"
        rx="9.5"
        stroke="url(#logoBorderGrad)"
        strokeWidth="1.2"
      />

      {/* Símbolo de Convergencia Contable y Cruce Tributario */}
      {/* Línea de flujo DIAN (Izquierda a Centro) */}
      <path
        d="M9.5 13.5H16.5C18.5 13.5 19.5 14.5 19.5 16.5V20.5"
        stroke="#ccfbf1"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeOpacity="0.9"
      />

      {/* Línea de flujo Libros ERP / Bancos (Derecha a Centro) */}
      <path
        d="M26.5 22.5H19.5C17.5 22.5 16.5 21.5 16.5 19.5V15.5"
        stroke="#99f6e4"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeOpacity="0.75"
      />

      {/* Punto de verificación / Checkmark central de conciliación exitosa */}
      <circle cx="18" cy="18" r="4.2" fill="#ffffff" />
      <path
        d="M16.2 18L17.5 19.3L19.8 16.8"
        stroke="#0f766e"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Nodos de auditoría en los extremos */}
      <circle cx="9.5" cy="13.5" r="1.6" fill="#ffffff" />
      <circle cx="26.5" cy="22.5" r="1.6" fill="#ffffff" />
    </svg>
  );
});
