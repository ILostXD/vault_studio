import { createRouter, RouterProvider } from "@tanstack/react-router";
import { MotionConfig } from "motion/react";
import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import { TooltipProvider } from "@/components/ui/tooltip";
import DynamicAccent from "./components/DynamicAccent";
import { AudioPlayerProvider } from "./contexts/AudioPlayerContext";
import { AuthProvider } from "./contexts/AuthContext";
import { ExportProvider } from "./contexts/ExportContext";
import { PreferencesProvider } from "./contexts/PreferencesContext";
import * as TanStackQueryProvider from "./integrations/tanstack-query/root-provider.tsx";
import { routeTree } from "./routeTree.gen";
import "./styles.css";

const TanStackQueryProviderContext = TanStackQueryProvider.getContext();
const router = createRouter({
	routeTree,
	context: {
		...TanStackQueryProviderContext,
	},
	defaultPreload: "intent",
	scrollRestoration: true,
	defaultStructuralSharing: true,
	defaultPreloadStaleTime: 0,
});

declare module "@tanstack/react-router" {
	interface Register {
		router: typeof router;
	}
}

const rootElement = document.getElementById("app");
if (rootElement && !rootElement.innerHTML) {
	const root = ReactDOM.createRoot(rootElement);
	root.render(
		<StrictMode>
			<TanStackQueryProvider.Provider {...TanStackQueryProviderContext}>
				<AuthProvider>
					<PreferencesProvider>
						<AudioPlayerProvider>
							<ExportProvider>
								<MotionConfig reducedMotion="user">
									<TooltipProvider>
										<DynamicAccent />
										<RouterProvider router={router} />
									</TooltipProvider>
								</MotionConfig>
							</ExportProvider>
						</AudioPlayerProvider>
					</PreferencesProvider>
				</AuthProvider>
			</TanStackQueryProvider.Provider>
		</StrictMode>,
	);
}
