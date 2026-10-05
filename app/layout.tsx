import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Curva de Carga para Condomínios V2",
  description: "Curva medida, simulação EV, dimensionamento elétrico e relatório técnico PDF."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
