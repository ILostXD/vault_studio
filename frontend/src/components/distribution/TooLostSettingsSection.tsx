import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, LoaderCircle, Save } from "lucide-react";
import { useEffect, useId, useMemo, useState } from "react";
import {
	distributionKeys,
	getTooLostConfiguration,
	getTooLostStatus,
	saveTooLostConfiguration,
} from "@/api/distribution";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/routes/__root";

type Environment = "sandbox" | "production";

export function TooLostSettingsSection() {
	const fieldID = useId();
	const { user } = useAuth();
	const queryClient = useQueryClient();
	const isAdmin = user?.is_admin === true;
	const status = useQuery({
		queryKey: distributionKeys.toolost,
		queryFn: getTooLostStatus,
	});
	const configuration = useQuery({
		queryKey: distributionKeys.toolostConfiguration,
		queryFn: getTooLostConfiguration,
		enabled: isAdmin,
	});
	const [clientID, setClientID] = useState("");
	const [clientSecret, setClientSecret] = useState("");
	const [publicBaseURL, setPublicBaseURL] = useState("");
	const [environment, setEnvironment] = useState<Environment>("sandbox");

	useEffect(() => {
		if (!configuration.data) return;
		setClientID(configuration.data.client_id);
		setPublicBaseURL(configuration.data.public_base_url);
		setEnvironment(configuration.data.environment);
	}, [configuration.data]);

	const save = useMutation({
		mutationFn: saveTooLostConfiguration,
		onSuccess: async () => {
			setClientSecret("");
			await Promise.all([
				queryClient.invalidateQueries({
					queryKey: distributionKeys.toolostConfiguration,
				}),
				queryClient.invalidateQueries({ queryKey: distributionKeys.toolost }),
			]);
			toast.success("Too Lost settings saved");
		},
		onError: (error) => toast.error(error.message),
	});

	const callbackURL = useMemo(() => {
		const base = publicBaseURL.trim().replace(/\/+$/, "");
		return base
			? `${base}/api/integrations/toolost/callback`
			: "https://your-vault.example/api/integrations/toolost/callback";
	}, [publicBaseURL]);

	return (
		// biome-ignore lint/correctness/useUniqueElementIds: Stable target for the Prepare Release settings link.
		<section
			id="too-lost-settings"
			className="scroll-mt-6 border-b border-(--card-border) pb-5"
		>
			<div className="flex items-start justify-between gap-4">
				<div className="min-w-0">
					<p className="text-base text-(--text-0)">Too Lost distribution</p>
					<p className="mt-1 text-sm text-(--text-2)">
						Register this Vault instance in the Too Lost Developer Portal, then
						enter its OAuth details here. Release Package exports need no
						registration.
					</p>
				</div>
				<span className="shrink-0 rounded-full border border-(--card-border) px-2.5 py-1 text-xs text-(--text-1)">
					{status.isPending
						? "Checking..."
						: status.data?.connected
							? "Connected"
							: status.data?.configured
								? "Ready to connect"
								: "Setup required"}
				</span>
			</div>

			{isAdmin ? (
				<form
					className="mt-4 space-y-4"
					onSubmit={(event) => {
						event.preventDefault();
						save.mutate({
							client_id: clientID,
							client_secret: clientSecret || undefined,
							public_base_url: publicBaseURL,
							environment,
						});
					}}
				>
					<div className="grid gap-4 sm:grid-cols-2">
						<label
							htmlFor={`${fieldID}-client-id`}
							className="space-y-1.5 text-sm text-(--text-1)"
						>
							<span>Client ID</span>
							<Input
								id={`${fieldID}-client-id`}
								value={clientID}
								onChange={(event) => setClientID(event.target.value)}
								placeholder="Too Lost application client ID"
								required
							/>
						</label>
						<label
							htmlFor={`${fieldID}-client-secret`}
							className="space-y-1.5 text-sm text-(--text-1)"
						>
							<span>Client secret</span>
							<Input
								id={`${fieldID}-client-secret`}
								type="password"
								value={clientSecret}
								onChange={(event) => setClientSecret(event.target.value)}
								placeholder={
									configuration.data?.client_secret_configured
										? "Leave blank to keep the saved secret"
										: "Too Lost application client secret"
								}
								autoComplete="new-password"
							/>
						</label>
						<label
							htmlFor={`${fieldID}-public-url`}
							className="space-y-1.5 text-sm text-(--text-1)"
						>
							<span>Public Vault URL</span>
							<Input
								id={`${fieldID}-public-url`}
								type="url"
								value={publicBaseURL}
								onChange={(event) => setPublicBaseURL(event.target.value)}
								placeholder="https://vault.example.com"
								required
							/>
						</label>
						<label
							htmlFor={`${fieldID}-environment`}
							className="space-y-1.5 text-sm text-(--text-1)"
						>
							<span>Environment</span>
							<Select
								value={environment}
								onValueChange={(value) => setEnvironment(value as Environment)}
							>
								<SelectTrigger
									id={`${fieldID}-environment`}
									aria-label="Too Lost environment"
								>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="sandbox">Sandbox</SelectItem>
									<SelectItem value="production">Production</SelectItem>
								</SelectContent>
							</Select>
						</label>
					</div>

					<div>
						<p className="mb-1 text-xs uppercase text-(--text-2)">
							OAuth callback URL
						</p>
						<code className="custom-scrollbar block overflow-x-auto rounded-[calc(var(--button-radius)-4px)] border border-(--card-border) bg-(--inner-card-bg) px-3 py-2 text-xs text-(--text-0)">
							{callbackURL}
						</code>
					</div>
					<p className="text-xs text-(--text-2)">
						The public URL must reach this Vault instance over HTTPS. Vault
						encrypts the client secret and connected-account tokens using the
						instance secret; no separate encryption-key setup is required.
					</p>
					<div className="flex flex-wrap gap-2">
						<Button
							type="submit"
							disabled={save.isPending || configuration.isPending}
						>
							{save.isPending ? (
								<LoaderCircle className="animate-spin" />
							) : (
								<Save />
							)}
							{save.isPending ? "Saving..." : "Save Too Lost settings"}
						</Button>
						<Button asChild variant="outline">
							<a
								href="https://developer.toolost.com/"
								target="_blank"
								rel="noreferrer"
							>
								<ExternalLink />
								Developer Portal
							</a>
						</Button>
					</div>
				</form>
			) : (
				<p className="mt-3 text-sm text-(--text-2)">
					An instance administrator can configure this connection.
				</p>
			)}
		</section>
	);
}
