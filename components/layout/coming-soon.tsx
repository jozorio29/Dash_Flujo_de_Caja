import { Construction } from "lucide-react";

export function ComingSoon({ title }: { title: string }) {
  return (
    <div className="flex h-[70vh] flex-col items-center justify-center text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 text-blue-600">
        <Construction className="h-8 w-8" />
      </div>
      <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
      <p className="mt-2 max-w-md text-sm text-slate-500">
        Esta vista estará disponible pronto. Por ahora, navega a <strong>Resumen</strong> para ver el
        dashboard principal con tus datos del Google Sheet.
      </p>
    </div>
  );
}
