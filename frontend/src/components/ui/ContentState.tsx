import { ReactNode } from "react";

interface Props {
  title: string;
  description?: string;
  children?: ReactNode;
  loading?: boolean;
  error?: boolean;
}

export default function ContentState({ title, description, children, loading, error }: Props) {
  return (
    <div className="flex min-h-[240px] flex-1 items-center justify-center px-6 py-10">
      <div className="max-w-sm text-center" role={error ? "alert" : loading ? "status" : undefined}>
        <div aria-hidden="true" className={`mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl ${error ? "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300" : "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300"}`}>
          {loading ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-current border-r-transparent" /> : (
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d={error ? "M12 9v3m0 4h.01M12 3L2 20h20L12 3z" : "M9 5H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V7a2 2 0 00-2-2h-3M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2M9 14l2 2 4-4"} />
            </svg>
          )}
        </div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h2>
        {description && <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{description}</p>}
        {children && <div className="mt-5 flex flex-wrap justify-center gap-2">{children}</div>}
      </div>
    </div>
  );
}
