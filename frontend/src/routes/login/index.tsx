import { Capacitor } from "@capacitor/core";
import { Keyboard } from "@capacitor/keyboard";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { checkUsersExist } from "../../api/auth";
import { ApiError } from "../../api/client";
import { getServerUrl, setServerUrl } from "../../api/server";
import { LoginForm } from "../../components/LoginForm";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { useAuth } from "../../contexts/AuthContext";
import { LoaderCircle } from "lucide-react";

export const Route = createFileRoute("/login/")({
	component: LoginPage,
});

function LoginPage() {
	const { isAuthenticated, isLoading: authLoading } = useAuth();
	const navigate = useNavigate();
	const [hasCheckedUsers, setHasCheckedUsers] = useState(false);
	const [isCheckingServer, setIsCheckingServer] = useState(false);
	const [connectionError, setConnectionError] = useState(false);
	const [connectionErrorMessage, setConnectionErrorMessage] = useState("");
	const [serverUrlInput, setServerUrlInput] = useState(() => getServerUrl());
	const [serverUrlError, setServerUrlError] = useState("");
	const [isInputActive, setIsInputActive] = useState(false);
	const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const serverUrlId = useId();

	const isNative = Capacitor.isNativePlatform();
	const showServerUrlField = useMemo(
		() => isNative || connectionError || !getServerUrl(),
		[isNative, connectionError],
	);

	// Handle focus inside text inputs on the card (server url, username, password)
	const handleFocusCapture = useCallback(
		(e: React.FocusEvent) => {
			const target = e.target;
			if (
				!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)
			) {
				return;
			}
			if (
				target.type === "button" ||
				target.type === "submit" ||
				target.type === "checkbox" ||
				target.type === "radio"
			) {
				return;
			}

			if (blurTimeoutRef.current) {
				clearTimeout(blurTimeoutRef.current);
				blurTimeoutRef.current = null;
			}

			// On native, Keyboard plugin (keyboardWillShow) handles elevation when software keyboard opens.
			// On web (fallback), focus activates elevation.
			if (!isNative) {
				setIsInputActive(true);
			}
		},
		[isNative],
	);

	// Smoothly glide down only after keyboard/inputs exit completely (debounce to prevent bouncing between fields)
	const handleBlurCapture = useCallback(
		(e: React.FocusEvent) => {
			const target = e.target;
			if (
				!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)
			) {
				return;
			}

			if (blurTimeoutRef.current) {
				clearTimeout(blurTimeoutRef.current);
			}
			blurTimeoutRef.current = setTimeout(() => {
				if (!isNative) {
					setIsInputActive(false);
				}
			}, 120);
		},
		[isNative],
	);

	// Detect virtual keyboard dismiss on Android / mobile devices.
	// 1. Native Keyboard plugin: receives Android WindowInsets/IME events directly from the OS.
	// 2. VisualViewport fallback: monitors browser layout viewport expansion.
	// When the keyboard dismisses, explicitly blur any active input so the cursor/selection teardrop
	// disappears and the card smoothly glides back down into centered position.
	useEffect(() => {
		let hideHandle: { remove: () => void } | undefined;
		let showHandle: { remove: () => void } | undefined;

		const onKeyboardDismiss = () => {
			setIsInputActive(false);
			if (
				document.activeElement instanceof HTMLInputElement ||
				document.activeElement instanceof HTMLTextAreaElement
			) {
				document.activeElement.blur();
			}
		};

		const onKeyboardOpen = () => {
			setIsInputActive(true);
		};

		if (isNative) {
			Keyboard.addListener("keyboardWillHide", onKeyboardDismiss).then((h) => {
				hideHandle = h;
			});
			Keyboard.addListener("keyboardDidHide", onKeyboardDismiss).then((h) => {
				hideHandle = h;
			});
			Keyboard.addListener("keyboardWillShow", onKeyboardOpen).then((h) => {
				showHandle = h;
			});
		}

		const vv = typeof window !== "undefined" ? window.visualViewport : null;
		let lastVvHeight = vv?.height ?? (typeof window !== "undefined" ? window.innerHeight : 0);
		let lastWindowHeight = typeof window !== "undefined" ? window.innerHeight : 0;

		const checkKeyboardDismiss = (currentVvHeight: number, currentWindowHeight: number) => {
			const vvDelta = currentVvHeight - lastVvHeight;
			const winDelta = currentWindowHeight - lastWindowHeight;
			lastVvHeight = currentVvHeight;
			lastWindowHeight = currentWindowHeight;

			// If viewport expanded by > 100px while an input was active, virtual keyboard was dismissed
			if (vvDelta > 100 || winDelta > 100) {
				onKeyboardDismiss();
			}
		};

		const handleVvResize = () => {
			if (vv) checkKeyboardDismiss(vv.height, window.innerHeight);
		};

		const handleWindowResize = () => {
			checkKeyboardDismiss(vv?.height ?? window.innerHeight, window.innerHeight);
		};

		vv?.addEventListener("resize", handleVvResize);
		window.addEventListener("resize", handleWindowResize);

		return () => {
			hideHandle?.remove();
			showHandle?.remove();
			vv?.removeEventListener("resize", handleVvResize);
			window.removeEventListener("resize", handleWindowResize);
		};
	}, [isNative]);

	// Verify server connection with fast timeout
	const verifyServer = useCallback(
		async (urlToCheck?: string) => {
			const targetUrl = (urlToCheck !== undefined ? urlToCheck : getServerUrl()).trim();

			if (isNative && !targetUrl) {
				setHasCheckedUsers(true);
				setIsCheckingServer(false);
				setConnectionError(false);
				setConnectionErrorMessage("");
				return;
			}

			setIsCheckingServer(true);
			setConnectionError(false);
			setConnectionErrorMessage("");
			setServerUrlError("");

			try {
				const result = await checkUsersExist({ timeoutMs: 3000 });
				setHasCheckedUsers(true);
				setConnectionError(false);
				setConnectionErrorMessage("");
				if (!result.users_exist) {
					navigate({ to: "/initialize", replace: true });
				}
			} catch (error) {
				console.error("Failed to check if users exist:", error);
				setHasCheckedUsers(true);
				setConnectionError(true);
				const msg =
					error instanceof ApiError && error.message
						? error.message
						: "Unable to reach server. Please check the URL or your network connection.";
				setConnectionErrorMessage(msg);
			} finally {
				setIsCheckingServer(false);
			}
		},
		[isNative, navigate],
	);

	useEffect(() => {
		if (hasCheckedUsers || authLoading) {
			return;
		}

		verifyServer();
	}, [hasCheckedUsers, authLoading, verifyServer]);

	const applyServerUrl = useCallback(
		async (options?: { recheck?: boolean }) => {
			if (isNative) {
				Keyboard.hide().catch(() => {});
			}
			if (
				document.activeElement instanceof HTMLInputElement ||
				document.activeElement instanceof HTMLTextAreaElement
			) {
				document.activeElement.blur();
			}
			setIsInputActive(false);

			const trimmed = serverUrlInput.trim();
			if (showServerUrlField && !trimmed) {
				setServerUrlError("Enter your backend URL first.");
				return false;
			}

			try {
				const normalized = setServerUrl(trimmed);
				setServerUrlInput(normalized);
				setServerUrlError("");

				if (options?.recheck) {
					await verifyServer(normalized);
				}

				return true;
			} catch {
				setServerUrlError(
					"Use a valid URL, for example http://192.168.1.100:8080.",
				);
				return false;
			}
		},
		[serverUrlInput, showServerUrlField, verifyServer],
	);

	useEffect(() => {
		if (!authLoading && isAuthenticated) {
			navigate({ to: "/" });
		}
	}, [isAuthenticated, authLoading, navigate]);

	if (isAuthenticated) {
		return <div className="min-h-screen bg-(--bg-0)" />;
	}

	const handleLoginSuccess = () => {
		navigate({ to: "/" });
	};

	const isChecking = isCheckingServer || (authLoading && !connectionError);

	return (
		<div
			className="flex min-h-dvh flex-col items-center justify-start overflow-y-auto bg-(--bg-0) px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-4 transition-[padding-bottom] duration-300"
			style={{
				paddingBottom: isInputActive ? "28dvh" : "1.5rem",
			}}
			onFocusCapture={handleFocusCapture}
			onBlurCapture={handleBlurCapture}
			onClick={(e) => {
				if (e.target === e.currentTarget) {
					if (
						document.activeElement instanceof HTMLInputElement ||
						document.activeElement instanceof HTMLTextAreaElement
					) {
						document.activeElement.blur();
					}
					if (isNative) {
						Keyboard.hide().catch(() => {});
					}
					setIsInputActive(false);
				}
			}}
		>
			<motion.div
				layout
				transition={{
					type: "spring",
					stiffness: 320,
					damping: 32,
					mass: 0.8,
				}}
				className={`w-full max-w-[500px] mx-auto ${
					isInputActive ? "mt-1 sm:mt-3 mb-auto" : "my-auto"
				}`}
			>
				<motion.div
					layout
					initial={{ opacity: 0, y: 5, filter: "blur(8px)" }}
					animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
					transition={{
						opacity: { duration: 0.25, ease: [0.4, 0, 0.2, 1] },
						y: { duration: 0.25, ease: [0.4, 0, 0.2, 1] },
						filter: { duration: 0.25, ease: [0.4, 0, 0.2, 1] },
						layout: { type: "spring", stiffness: 350, damping: 30 },
					}}
					className="border border-(--card-border) rounded-[36px] sm:rounded-[45px] bg-[linear-gradient(180deg,var(--card-gradient-from)_0%,var(--card-gradient-to)_100%)] px-6 py-7 sm:px-10 sm:py-10"
					style={{
						boxShadow: "0 25px 27.4px -10px rgba(0, 0, 0, 0.19)",
					}}
				>
					<div className="text-center mb-6 sm:mb-8">
						<h1 className="text-[30px] sm:text-[39px] font-light text-(--text-0)">{`{ vault.studio }`}</h1>
					</div>

					{showServerUrlField && (
						<div className="mb-6 space-y-2">
							<Label
								htmlFor={serverUrlId}
								className="text-(--text-2) text-base font-light ml-4 sm:ml-5"
								style={{ fontFamily: '"IBM Plex Mono", monospace' }}
							>
								server url
							</Label>
							<div className="flex gap-2">
								<Input
									id={serverUrlId}
									type="url"
									inputMode="url"
									autoCapitalize="none"
									autoCorrect="off"
									spellCheck={false}
									value={serverUrlInput}
									disabled={isChecking}
									onChange={(event) => {
										setServerUrlInput(event.target.value);
										setServerUrlError("");
										if (connectionError) {
											setConnectionError(false);
											setConnectionErrorMessage("");
										}
									}}
									onKeyDown={(event) => {
										if (event.key === "Enter") {
											event.preventDefault();
											applyServerUrl({ recheck: true });
										}
									}}
									placeholder="http://192.168.1.100:8080"
									className="themed-input-surface text-(--text-0) text-base md:text-base placeholder:text-(--text-0)/40 h-12 rounded-2xl px-5"
								/>
								<Button
									type="button"
									disabled={isChecking}
									onClick={() => applyServerUrl({ recheck: true })}
									className="btn-surface h-12 rounded-2xl px-5 min-w-[94px] flex items-center justify-center gap-2"
								>
									{isChecking ? (
										<>
											<LoaderCircle className="size-4 animate-spin" />
											<span>Checking</span>
										</>
									) : (
										"Apply"
									)}
								</Button>
							</div>
							{serverUrlError && (
								<p className="text-red-400 text-xs text-center px-4">
									{serverUrlError}
								</p>
							)}
						</div>
					)}

					<AnimatePresence mode="wait">
						{isChecking ? (
							<motion.div
								key="checking"
								initial={{ opacity: 0, y: 4 }}
								animate={{ opacity: 1, y: 0 }}
								exit={{ opacity: 0, y: -4 }}
								transition={{ duration: 0.2 }}
								className="text-center py-6 space-y-3"
							>
								<div className="flex items-center justify-center gap-2.5 text-(--text-1)">
									<LoaderCircle className="size-5 animate-spin text-(--accent)" />
									<span className="text-sm font-light" style={{ fontFamily: '"IBM Plex Mono", monospace' }}>
										Connecting to server...
									</span>
								</div>
							</motion.div>
						) : connectionError ? (
							<motion.div
								key="error"
								initial={{ opacity: 0, y: 4 }}
								animate={{ opacity: 1, y: 0 }}
								exit={{ opacity: 0, y: -4 }}
								transition={{ duration: 0.2 }}
								className="text-center space-y-4 pt-1"
							>
								<div
									className="p-4 border border-red-500/30 rounded-2xl"
									style={{
										background: "linear-gradient(0deg, #2a1515 0%, rgba(40, 20, 20, 0.3) 100%)",
									}}
								>
									<p
										className="text-red-400 text-sm text-center font-light whitespace-pre-line leading-relaxed"
										style={{ fontFamily: '"IBM Plex Mono", monospace' }}
									>
										{connectionErrorMessage || "Unable to connect to the server"}
									</p>
								</div>
								<Button
									type="button"
									disabled={isChecking}
									onClick={() => verifyServer()}
									className="btn-surface h-11 rounded-2xl px-6 text-sm font-medium hover:brightness-110"
								>
									Retry Connection
								</Button>
							</motion.div>
						) : (
							<motion.div
								key="form"
								initial={{ opacity: 0 }}
								animate={{ opacity: 1 }}
								exit={{ opacity: 0 }}
								transition={{ duration: 0.2 }}
							>
								<LoginForm
									onBeforeSubmit={() => {
										applyServerUrl({ recheck: false });
										return true;
									}}
									onSubmitSuccess={handleLoginSuccess}
								/>
							</motion.div>
						)}
					</AnimatePresence>
				</motion.div>
			</motion.div>
		</div>
	);
}
