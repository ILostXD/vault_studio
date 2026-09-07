import { useMutation, useQuery } from "@tanstack/react-query";
import { ExternalLink, LoaderCircle, RefreshCw } from "lucide-react";
import { resolveApiUrl } from "@/api/server";
import { getUpdateStatus, installUpdate } from "@/api/stats";
import { Button } from "@/components/ui/button";
import { toast } from "@/routes/__root";

export function SoftwareUpdateSection() {
	const status = useQuery({
		queryKey: ["instance-update"],
		queryFn: getUpdateStatus,
		staleTime: 5 * 60 * 1000,
	});
	const install = useMutation({
		mutationFn: installUpdate,
		onSuccess: () => {
			toast.success("Update started. Vault Studio will restart shortly.");
			waitForRestart();
		},
		onError: (error) => toast.error(error.message),
	});

	return (
		<div className="border-b border-(--card-border) pb-4">
			<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<div className="min-w-0">
					<p className="text-base text-(--text-1)">Software updates</p>
					<p className="mt-1 text-sm text-(--text-2)">
						{status.isPending
							? "Checking GitHub Releases..."
							: status.isError
								? "Vault could not check GitHub Releases."
								: status.data.update_available
									? `${status.data.latest_version} is available. The server will restart after installing it.`
									: `Up to date on ${status.data.current_version}.`}
					</p>
					{status.data?.update_available && !status.data.updater_configured && (
						<p className="mt-1 text-xs text-(--text-2)">
							Enable the isolated Docker updater once. It installs tagged release
							images from GitHub Container Registry, not commits from main.
						</p>
					)}
				</div>
				<div className="flex shrink-0 gap-2">
					{status.data?.release_url && (
						<Button asChild size="icon" variant="ghost">
							<a
								href={status.data.release_url}
								target="_blank"
								rel="noreferrer"
								title="View latest GitHub release"
								aria-label="View latest GitHub release"
							>
								<ExternalLink />
							</a>
						</Button>
					)}
					<Button
						type="button"
						disabled={
							install.isPending ||
							!status.data?.update_available ||
							!status.data.updater_configured
						}
						onClick={() => install.mutate()}
					>
						{install.isPending ? (
							<LoaderCircle className="animate-spin" />
						) : (
							<RefreshCw />
						)}
						{install.isPending ? "Starting..." : "Update"}
					</Button>
				</div>
			</div>
		</div>
	);
}

function waitForRestart() {
	const startedAt = Date.now();
	const check = window.setInterval(async () => {
		if (Date.now() - startedAt > 2 * 60 * 1000) {
			window.clearInterval(check);
			return;
		}
		if (Date.now() - startedAt < 5000) return;
		try {
			const response = await fetch(resolveApiUrl("/api/health"), {
				cache: "no-store",
			});
			if (response.ok) {
				window.clearInterval(check);
				window.location.reload();
			}
		} catch {
			// The server is expected to be temporarily unavailable while restarting.
		}
	}, 2000);
}
