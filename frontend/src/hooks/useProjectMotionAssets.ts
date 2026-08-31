import { useQuery } from "@tanstack/react-query";
import { getProjectMotionAssets } from "@/api/projects";

export const projectMotionAssetKeys = {
	detail: (projectId: string) => ["project-motion-art", projectId] as const,
};

export function useProjectMotionAssets(projectId?: string) {
	return useQuery({
		queryKey: projectMotionAssetKeys.detail(projectId ?? ""),
		queryFn: () =>
			projectId ? getProjectMotionAssets(projectId) : Promise.resolve([]),
		enabled: Boolean(projectId),
		staleTime: 60_000,
	});
}
