import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";

export interface ActiveExport {
	id: string;
	title: string;
	phase: "preparing" | "downloading" | "complete" | "error";
	progress?: number;
	statusText?: string;
}

type ExportStart = Pick<ActiveExport, "title" | "statusText" | "progress"> & { id?: string; phase?: "preparing" | "downloading" };
interface ExportActions {
	startExport: (params: ExportStart) => string;
	updateExport: (id: string, updates: Partial<Omit<ActiveExport, "id">>) => void;
	completeExport: (id: string, finalStatus?: string) => void;
	failExport: (id: string, error?: string) => void;
	dismissExport: (id: string) => void;
}

const ExportContext = createContext<ExportActions | null>(null);
const ExportStatusContext = createContext<ActiveExport[]>([]);

export function ExportProvider({ children }: { children: ReactNode }) {
	const { user } = useAuth();
	const [activeExports, setActiveExports] = useState<ActiveExport[]>([]);
	const dismissTimeouts = useRef(new Map<string, ReturnType<typeof setTimeout>>());

	useEffect(() => {
		setActiveExports([]);
		const timers = dismissTimeouts.current;
		return () => {
			for (const timer of timers.values()) clearTimeout(timer);
			timers.clear();
		};
	}, [user?.id]);

	const dismissExport = useCallback((id: string) => {
		clearTimeout(dismissTimeouts.current.get(id));
		dismissTimeouts.current.delete(id);
		setActiveExports((prev) => prev.filter((item) => item.id !== id));
	}, []);

	const startExport = useCallback((params: ExportStart) => {
		const id = params.id || `export-${Date.now()}-${Math.random().toString(36).slice(2)}`;
		clearTimeout(dismissTimeouts.current.get(id));
		dismissTimeouts.current.delete(id);
		setActiveExports((prev) => [...prev.filter((item) => item.id !== id), { ...params, id, phase: params.phase || "preparing" }]);
		return id;
	}, []);

	const updateExport = useCallback((id: string, updates: Partial<Omit<ActiveExport, "id">>) => {
		setActiveExports((prev) => prev.map((item) => item.id === id ? { ...item, ...updates } : item));
	}, []);

	const completeExport = useCallback((id: string, statusText = "Export complete") => {
		updateExport(id, { phase: "complete", progress: 100, statusText });
		clearTimeout(dismissTimeouts.current.get(id));
		dismissTimeouts.current.set(id, setTimeout(() => dismissExport(id), 6000));
	}, [dismissExport, updateExport]);

	const failExport = useCallback((id: string, statusText = "Export failed") => {
		clearTimeout(dismissTimeouts.current.get(id));
		dismissTimeouts.current.delete(id);
		updateExport(id, { phase: "error", progress: undefined, statusText });
	}, [updateExport]);

	// Progress subscribers update independently of the screens that start exports.
	const actions = useMemo(() => ({ startExport, updateExport, completeExport, failExport, dismissExport }), [startExport, updateExport, completeExport, failExport, dismissExport]);
	return (
		<ExportContext.Provider value={actions}>
			<ExportStatusContext.Provider value={activeExports}>{children}</ExportStatusContext.Provider>
		</ExportContext.Provider>
	);
}

export function useExport() {
	const context = useContext(ExportContext);
	if (!context) throw new Error("useExport must be used within ExportProvider");
	return context;
}

export function useExportStatus() {
	return useContext(ExportStatusContext);
}
