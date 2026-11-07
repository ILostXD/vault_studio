import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Save } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useId, useState } from "react";
import {
	type ArtistProfile,
	distributionKeys,
	getArtistProfile,
	saveArtistProfile,
} from "@/api/distribution";
import { Button } from "@/components/ui/button";
import { DisclosureSummary } from "@/components/ui/disclosure-summary";
import { Input } from "@/components/ui/input";
import { CreditsEditor } from "./CreditsEditor";

const creditsDisclosureKey = "vault:artist-profile:credits-open";

export function ArtistProfileSection() {
	const titleId = useId();
	const displayNameId = useId();
	const legalNameId = useId();
	const client = useQueryClient();
	const query = useQuery({
		queryKey: distributionKeys.profile,
		queryFn: getArtistProfile,
	});
	const [draft, setDraft] = useState<ArtistProfile | null>(null);
	const [creditsOpen, setCreditsOpen] = useState(
		() => window.localStorage.getItem(creditsDisclosureKey) !== "false",
	);
	const save = useMutation({
		mutationFn: saveArtistProfile,
		onSuccess: (profile) => {
			client.setQueryData(distributionKeys.profile, profile);
			void client.invalidateQueries({ queryKey: ["release-preparation"] });
			void client.invalidateQueries({ queryKey: ["project-audio-metadata"] });
			setDraft(null);
		},
	});
	const profile = draft ?? query.data;
	const addLegalNameDefaults = () => {
		if (!profile?.legal_name.trim()) return;
		setDraft({
			...profile,
			default_credits: [
				"Composer",
				"Producer",
				"Performer",
				"Mixing Engineer",
			].map((role) => ({ name: profile.legal_name.trim(), role })),
		});
	};
	return (
		<section aria-labelledby={titleId} className="min-w-0 text-(--text-0)">
			<h2 id={titleId} className="mb-6 text-xl font-medium">
				Artist Profile
			</h2>
			{query.isPending ? (
				<output>Loading artist profile...</output>
			) : query.isError ? (
				<div role="alert">
					<p>{query.error.message}</p>
					<Button onClick={() => void query.refetch()}>Retry</Button>
				</div>
			) : (
				profile && (
					<form
						onSubmit={(event) => {
							event.preventDefault();
							save.mutate(profile);
						}}
						className="space-y-6"
					>
						<fieldset disabled={save.isPending} className="min-w-0 space-y-6">
							<div className="grid gap-x-4 gap-y-5 sm:grid-cols-2">
								<label
									htmlFor={displayNameId}
									className="flex flex-col gap-2 text-sm"
								>
									<span>Artist / display name</span>
									<Input
										id={displayNameId}
										value={profile.display_name}
										onChange={(e) =>
											setDraft({ ...profile, display_name: e.target.value })
										}
									/>
								</label>
								<label
									htmlFor={legalNameId}
									className="flex flex-col gap-2 text-sm"
								>
									<span>Legal name</span>
									<Input
										id={legalNameId}
										value={profile.legal_name}
										onChange={(e) =>
											setDraft({ ...profile, legal_name: e.target.value })
										}
									/>
								</label>
								<label className="flex flex-col gap-2 text-sm sm:col-span-2">
									<span>Usual genre</span>
									<Input
										value={profile.usual_genre ?? ""}
										maxLength={512}
										onChange={(event) =>
											setDraft({ ...profile, usual_genre: event.target.value })
										}
									/>
								</label>
							</div>
							<details
								className="rounded-xl border border-(--card-border) bg-(--inner-card-bg)"
								open={creditsOpen}
								onToggle={(event) => {
									const open = event.currentTarget.open;
									setCreditsOpen(open);
									window.localStorage.setItem(
										creditsDisclosureKey,
										String(open),
									);
								}}
							>
								<DisclosureSummary>Reusable credits</DisclosureSummary>
								<div className="space-y-4 px-2.5 pb-4 sm:px-3">
									<p className="text-sm text-(--text-1)">
										These fill every track by default. Individual tracks can
										override them during release preparation.
									</p>
									<CreditsEditor
										value={profile.default_credits ?? []}
										onChange={(default_credits) =>
											setDraft({ ...profile, default_credits })
										}
									/>
									<Button
										type="button"
										size="sm"
										variant="ghost"
										className="h-auto px-0 py-1 text-(--text-1) hover:bg-transparent hover:text-(--text-0)"
										disabled={!profile.legal_name.trim()}
										onClick={addLegalNameDefaults}
									>
										Use legal name for standard credits
									</Button>
								</div>
							</details>
						</fieldset>
						<AnimatePresence initial={false}>
							{save.isError && (
								<motion.p
									role="alert"
									initial={{ opacity: 0, y: -4 }}
									animate={{ opacity: 1, y: 0 }}
									exit={{ opacity: 0, y: -4 }}
									className="text-sm text-(--danger-text)"
								>
									{save.error.message}
								</motion.p>
							)}
						</AnimatePresence>
						<div className="flex flex-wrap items-center gap-3 border-t border-(--card-border) pt-5">
							<Button type="submit" disabled={!draft || save.isPending}>
								<Save />
								{save.isPending ? "Saving..." : "Save artist profile"}
							</Button>
							<AnimatePresence initial={false}>
								{save.isSuccess && !draft && (
									<motion.output
										initial={{ opacity: 0, scale: 0.96, x: -4 }}
										animate={{ opacity: 1, scale: 1, x: 0 }}
										exit={{ opacity: 0, scale: 0.96 }}
										className="text-sm text-(--text-1)"
									>
										Saved
									</motion.output>
								)}
							</AnimatePresence>
						</div>
					</form>
				)
			)}
		</section>
	);
}
