import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useRef, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import CDDiscBadge from "@/components/CDDiscBadge";
import ColorPicker, { hexToHsl } from "@/components/ui/ColorPicker";
import DotPattern from "@/components/ui/DotPattern";
import { cn } from "@/lib/utils";
// import { LinearBlur } from "progressive-blur";
import { Button } from "@/components/ui/button";
import { Pencil, Users } from "lucide-react";
import { motion } from "motion/react";
import {
  getStorageStats,
  getGlobalStorageStats,
  getInstanceInfo,
  updateInstanceName,
} from "@/api/stats";
import { usePreferences } from "@/contexts/PreferencesContext";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/routes/__root";
import EditProfileModal from "@/components/modals/EditProfileModal";
import { UserManagementModal } from "@/components/modals/UserManagementModal";
import ExportInstanceModal from "@/components/modals/ExportInstanceModal";
import ImportInstanceModal from "@/components/modals/ImportInstanceModal";
import ResetInstanceModal from "@/components/modals/ResetInstanceModal";
import type {
  StorageStats,
  InstanceInfo,
  Quality,
} from "@/types/api";

export const Route = createFileRoute("/profile/")({
  component: ProfilePage,
});

function ProfilePage() {
  const { user, updateUsername } = useAuth();
  const { preferences, isLoading: isPrefsLoading, updatePreferences, refreshPreferences } = usePreferences();
  const queryClient = useQueryClient();
  const [storageStats, setStorageStats] = useState<StorageStats | null>(null);
  const [globalStorageStats, setGlobalStorageStats] =
    useState<StorageStats | null>(null);
  const [instanceInfo, setInstanceInfo] = useState<InstanceInfo | null>(null);
  const [showContent, setShowContent] = useState(false);
  const [isStatsLoading, setIsStatsLoading] = useState(true);
  const [instanceName, setInstanceName] = useState("");
  const [isEditProfileModalOpen, setIsEditProfileModalOpen] = useState(false);
  const [isUserManagementModalOpen, setIsUserManagementModalOpen] =
    useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const instanceNameInputRef = useRef<HTMLInputElement>(null);

  const isLoading = isStatsLoading || isPrefsLoading;

  const pickerSize = 200;
  const pickerPadding = 15;
  const pickerRadius = pickerSize / 2 - pickerPadding;
  const maxLight = 90;

  const initialAngleAndRadius = useMemo(() => {
    const activeColor = preferences?.accent_color || "#ffba00";
    const hsl = hexToHsl(activeColor);
    const angle = (hsl.h * Math.PI) / 180;
    const radius = (hsl.l / maxLight) * pickerRadius;
    return { angle, radius };
  }, [preferences?.accent_color, pickerRadius]);

  const isColorPickerMountedRef = useRef(false);



  useEffect(() => {
    const fetchData = async () => {
      try {
        const [storageData, instanceData] = await Promise.all([
          getStorageStats(),
          getInstanceInfo(),
        ]);
        setStorageStats(storageData);
        setInstanceInfo(instanceData);
        setInstanceName(instanceData.name);

        if (user?.is_admin) {
          const globalData = await getGlobalStorageStats();
          setGlobalStorageStats(globalData);
        }
      } catch (error) {
        console.error("Failed to fetch profile data:", error);
      } finally {
        setIsStatsLoading(false);
      }
    };
    fetchData();
  }, [user?.is_admin]);

  useEffect(() => {
    if (isLoading) {
      setShowContent(false);
      return;
    }

    const timer = setTimeout(() => setShowContent(true), 50);
    return () => clearTimeout(timer);
  }, [isLoading]);

  const handleQualityChange = async (newQuality: Quality) => {
    try {
      await updatePreferences({ default_quality: newQuality });
    } catch (error) {
      console.error("Failed to update quality:", error);
    }
  };

  const handleSaveInstanceName = async () => {
    if (instanceName === instanceInfo?.name) return;
    if (!instanceName.trim()) {
      setInstanceName(instanceInfo?.name || "Vault");
      return;
    }

    try {
      const updated = await updateInstanceName({ name: instanceName.trim() });
      setInstanceInfo(updated);
    } catch (error) {
      toast.error("Failed to update instance name");
      console.error("Failed to update instance name:", error);
      setInstanceName(instanceInfo?.name || "Vault");
    }
  };

  const handleSaveProfile = async (username: string) => {
    try {
      if (username !== user?.username) {
        await updateUsername(username);
      }
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      await refreshPreferences();
      toast.success("Profile updated");
    } catch (error) {
      toast.error("Failed to update profile");
      console.error("Failed to update profile:", error);
      throw error;
    }
  };

  const getQualityDisplay = (quality: Quality): string => {
    switch (quality) {
      case "source":
        return "Source (WAV)";
      case "lossy":
        return "Lossy (MP3)";
      case "lossless":
        return "Lossless"; // Not used but keep for type compatibility
      default:
        return quality;
    }
  };

  const bytesToGB = (bytes: number): number => {
    return Math.round((bytes / (1024 * 1024 * 1024)) * 10) / 10;
  };

  const totalGB = storageStats ? bytesToGB(storageStats.total_size_bytes) : 0;
  const sourceGB = storageStats ? bytesToGB(storageStats.source_size_bytes) : 0;
  const lossyGB = storageStats ? bytesToGB(storageStats.lossy_size_bytes) : 0;
  const quotaGB = instanceInfo?.storage_quota_bytes
    ? bytesToGB(instanceInfo.storage_quota_bytes)
    : null;
  const utilizedPercent = quotaGB ? Math.round((totalGB / quotaGB) * 100) : 0;
  const availableGB = quotaGB ? Math.max(0, quotaGB - totalGB) : 0;

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-4 md:px-6 pt-24 md:pt-32 pb-20">
        <div className="flex justify-center">
          <div className="grid grid-cols-1 lg:grid-cols-[305px_505px] gap-8 lg:gap-12 w-full lg:w-auto">
            <div
              className={`flex flex-col items-center lg:sticky lg:top-32 lg:self-start z-20 transition-opacity duration-300 ${showContent ? "opacity-100" : "opacity-0"
                }`}
              aria-busy={isLoading}
            >
              <motion.div
                layoutId="profile-disc-badge"
                className="flex flex-col items-center"
                initial={false}
                animate={{ opacity: isEditProfileModalOpen ? 0 : 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              >
                {preferences ? (
                  <CDDiscBadge
                    label={user?.username || "User"}
                    sublabel={
                      user?.created_at
                        ? `Created ${new Date(
                          user.created_at,
                        ).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}`
                        : "Vault Instance"
                    }
                    colors={preferences.disc_colors}
                    colorSpread={preferences.disc_colors?.length ? preferences.color_spread : undefined}
                  />
                ) : (
                  <div className="w-[305px] h-[375px]" />
                )}
              </motion.div>
              <motion.button
                onClick={() => setIsEditProfileModalOpen(true)}
                className="mt-4 text-[#848484] hover:text-white text-sm transition-colors cursor-pointer"
                animate={{ opacity: isEditProfileModalOpen ? 0 : 1 }}
                transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
              >
                Edit profile
              </motion.button>
            </div>

            <div
              className={`space-y-6 w-full transition-opacity duration-300 ${showContent ? "opacity-100" : "opacity-0"
                }`}
              aria-busy={isLoading}
            >
              <div className="bg-linear-to-b from-[#262626] to-[#201f1f] border border-[#353333] rounded-3xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-medium text-white">
                    Storage Overview
                  </h2>
                </div>

                {quotaGB ? (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                      <div className="bg-[#191919] border border-[#353333] rounded-[21px] p-4">
                        <p className="text-[#9f9f9f] text-xs font-['IBM_Plex_Mono'] mb-2">
                          USED
                        </p>
                        <p className="text-white text-3xl font-semibold">
                          {totalGB} GB
                        </p>
                        <p className="text-[#919191] text-sm font-medium mb-3">
                          {utilizedPercent}% utilized
                        </p>
                        <div className="bg-[#383838] border border-[#353333] h-[5.345px] rounded-[21px] overflow-hidden">
                          <div
                            className="bg-accent-blue h-full rounded-[21px]"
                            style={{
                              width: `${utilizedPercent}%`,
                            }}
                          />
                        </div>
                      </div>

                      <div className="bg-[#191919] border border-[#353333] rounded-[21px] p-4">
                        <p className="text-[#9f9f9f] text-xs font-['IBM_Plex_Mono'] mb-2">
                          AVAILABLE
                        </p>
                        <p className="text-white text-3xl font-semibold">
                          {availableGB} GB
                        </p>
                        <p className="text-[#919191] text-sm font-medium">
                          {Math.round((availableGB / quotaGB) * 100)}% remaining
                        </p>
                      </div>
                    </div>

                    <div className="bg-[#191919] border border-[#353333] rounded-[21px] p-4 mb-6">
                      <p className="text-[#9f9f9f] text-xs font-['IBM_Plex_Mono'] mb-2">
                        TOTAL QUOTA
                      </p>
                      <p className="text-white text-3xl font-semibold mb-1">
                        {quotaGB} GB
                      </p>
                      <p className="text-[#919191] text-sm font-medium">
                        Allocated
                      </p>
                    </div>
                  </>
                ) : (
                  <div
                    className={`grid gap-4 mb-6 ${user?.is_admin ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1"}`}
                  >
                    <div className="bg-[#191919] border border-[#353333] rounded-[21px] p-4">
                      <p className="text-[#9f9f9f] text-xs font-['IBM_Plex_Mono'] mb-2">
                        USER STORAGE
                      </p>
                      <p className="text-white text-3xl font-semibold mb-1">
                        {totalGB} GB
                      </p>
                      <p className="text-[#919191] text-sm font-medium">
                        {storageStats?.file_count || 0} files across{" "}
                        {storageStats?.track_count || 0} tracks
                      </p>
                    </div>

                    {user?.is_admin && globalStorageStats && (
                      <div className="bg-[#191919] border border-[#353333] rounded-[21px] p-4">
                        <p className="text-[#9f9f9f] text-xs font-['IBM_Plex_Mono'] mb-2">
                          TOTAL STORAGE
                        </p>
                        <p className="text-white text-3xl font-semibold mb-1">
                          {bytesToGB(globalStorageStats.total_size_bytes)} GB
                        </p>
                        <p className="text-[#919191] text-sm font-medium">
                          {globalStorageStats.file_count} files across{" "}
                          {globalStorageStats.track_count} tracks
                        </p>
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <p className="text-[#848484] text-base font-['IBM_Plex_Mono'] mb-4">
                    STORAGE BY QUALITY
                  </p>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-t border-[#353333] pt-3">
                      <p className="text-[#848484] text-base">Source (WAV)</p>
                      <p className="text-white text-base font-medium">
                        {user?.is_admin && globalStorageStats
                          ? bytesToGB(globalStorageStats.source_size_bytes)
                          : sourceGB}{" "}
                        GB
                      </p>
                    </div>
                    <div className="flex items-center justify-between border-t border-[#353333] pt-3">
                      <p className="text-[#848484] text-base">Lossy (MP3)</p>
                      <p className="text-white text-base font-medium">
                        {user?.is_admin && globalStorageStats
                          ? bytesToGB(globalStorageStats.lossy_size_bytes)
                          : lossyGB}{" "}
                        GB
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {user?.is_admin && (
                <div className="bg-linear-to-b from-[#232323] to-[#201f1f] border border-[#353333] rounded-3xl p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-2xl font-medium text-white">
                        Instance Users
                      </h2>
                      <p className="text-[#7c7c7c] text-sm mt-1">
                        Manage instance users and permissions
                      </p>
                    </div>
                    <Button
                      className="bg-accent-blue rounded-[7px] px-6 py-2 text-white font-medium hover:bg-accent-blue/80 flex items-center gap-2 h-auto"
                      onClick={() => setIsUserManagementModalOpen(true)}
                    >
                      <Users className="h-4 w-4" />
                      Manage Users
                    </Button>
                  </div>
                </div>
              )}

              <div className="bg-linear-to-b from-[#232323] to-[#201f1f] border border-[#353333] rounded-3xl p-6">
                <h2 className="text-2xl font-medium text-white mb-6">
                  Settings
                </h2>

                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-[#353333] pb-4">
                    <div>
                      <p className="text-white text-base">Quality</p>
                      <p className="text-[#7c7c7c] text-sm">
                        Default audio quality for streaming
                      </p>
                    </div>
                    <Button
                      className="bg-[#393939] rounded-[7px] px-4 py-1 text-white text-sm font-medium text-center min-w-[130px] h-auto hover:bg-[#4a4a4a]"
                      onClick={() => {
                        if (!preferences) return;
                        const nextQuality: Quality =
                          preferences.default_quality === "source"
                            ? "lossy"
                            : "source";
                        handleQualityChange(nextQuality);
                      }}
                    >
                      {preferences
                        ? getQualityDisplay(preferences.default_quality)
                        : "Loading..."}
                    </Button>
                  </div>

                  <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-white text-base">Accent Color</p>
                        <p className="text-[#7c7c7c] text-sm">
                          Choose your preferred app accent color
                        </p>
                      </div>
                      <div
                        className="w-10 h-10 rounded-lg border border-[#353333] shadow-inner transition-colors duration-200"
                        style={{ backgroundColor: preferences?.accent_color || "#ffba00" }}
                      />
                    </div>
                    <div className="bg-[#191919] border border-[#353333] rounded-[12px] p-4 flex justify-center relative overflow-hidden select-none">
                      <DotPattern
                        width={8}
                        height={8}
                        className={cn(
                          "mask-[radial-gradient(110px_circle_at_50%_100px,white,transparent)] z-0",
                        )}
                      />
                      <div className="relative z-10 flex justify-center">
                        <ColorPicker
                          size={pickerSize}
                          padding={pickerPadding}
                          bulletRadius={18}
                          showColorWheel={true}
                          numPoints={1}
                          initialAngle={initialAngleAndRadius.angle}
                          initialRadius={initialAngleAndRadius.radius}
                          onColorChange={async (colors) => {
                            const newColor = colors[0];
                            if (!isColorPickerMountedRef.current) {
                              isColorPickerMountedRef.current = true;
                              return;
                            }
                            if (newColor && newColor !== preferences?.accent_color) {
                              try {
                                await updatePreferences({ accent_color: newColor });
                              } catch (error) {
                                console.error("Failed to update accent color:", error);
                              }
                            }
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="hidden">
                    <div className="flex items-center justify-between border-b border-[#353333] pb-4">
                      <div>
                        <p className="text-white text-base">Stem Separation</p>
                        <p className="text-[#7c7c7c] text-sm">
                          Enable local AI stem separation
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between border-b border-[#353333] pb-4">
                      <div>
                        <p className="text-white text-base">Public Sharing</p>
                        <p className="text-[#7c7c7c] text-sm">
                          Allow tracks to be shared publicly
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between border-b border-[#353333] pb-4">
                      <div>
                        <p className="text-white text-base">Backup</p>
                        <p className="text-[#7c7c7c] text-sm">
                          Automatically backup data 24 hours
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-linear-to-b from-[#232323] to-[#201f1f] border border-[#353333] rounded-3xl p-6">
                <h2 className="text-2xl font-medium text-white mb-6">
                  Instance Information
                </h2>

                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-[#353333] pb-4">
                    <p className="text-[#848484] text-base">Instance Name</p>
                    {user?.is_admin ? (
                      <div className="flex items-center gap-2 group">
                        <input
                          ref={instanceNameInputRef}
                          type="text"
                          value={instanceName}
                          onChange={(e) => setInstanceName(e.target.value)}
                          onBlur={handleSaveInstanceName}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.currentTarget.blur();
                            }
                          }}
                          className="text-white text-base font-medium text-right bg-transparent border-none outline-none focus:outline-none cursor-text"
                          style={{
                            caretColor: "white",
                          }}
                        />
                        <Pencil
                          className="size-3.5 text-[#848484] opacity-50 group-hover:opacity-100 transition-opacity cursor-pointer"
                          onClick={() => instanceNameInputRef.current?.focus()}
                        />
                      </div>
                    ) : (
                      <p className="text-white text-base font-medium">
                        {instanceName}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between border-b border-[#353333] pb-4">
                    <p className="text-[#848484] text-base">Version</p>
                    <p className="text-white text-base font-medium">
                      {instanceInfo?.version || ""}
                      {instanceInfo?.commit_sha && (
                        <span className="text-[#848484] text-sm font-mono ml-2">
                          ({instanceInfo.commit_sha.substring(0, 7)})
                        </span>
                      )}
                    </p>
                  </div>

                  {instanceInfo?.created_at && (
                    <div className="flex items-center justify-between">
                      <p className="text-[#848484] text-base">Created</p>
                      <p className="text-white text-base font-medium">
                        {new Date(instanceInfo.created_at).toLocaleDateString(
                          "en-US",
                          {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          },
                        )}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {user?.is_admin && (
                <div className="bg-linear-to-b from-[#232323] to-[#201f1f] border border-[#353333] rounded-3xl p-6">
                  <h2 className="text-2xl font-medium text-white mb-6">
                    Danger Zone
                  </h2>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-[#353333] pb-4">
                      <div>
                        <p className="text-white text-base">Export Data</p>
                        <p className="text-[#7c7c7c] text-sm">
                          Download a complete backup of your instance data
                        </p>
                      </div>
                      <Button
                        className="bg-[#393939] rounded-[7px] px-4 py-1 text-white text-sm font-medium h-auto hover:bg-[#4a4a4a]"
                        onClick={() => setIsExportModalOpen(true)}
                      >
                        Export
                      </Button>
                    </div>

                    <div className="flex items-center justify-between border-b border-[#353333] pb-4">
                      <div>
                        <p className="text-white text-base">Import Data</p>
                        <p className="text-[#7c7c7c] text-sm">
                          Restore from a backup file (replaces current data)
                        </p>
                      </div>
                      <Button
                        className="bg-[#393939] rounded-[7px] px-4 py-1 text-white text-sm font-medium h-auto hover:bg-[#4a4a4a]"
                        onClick={() => setIsImportModalOpen(true)}
                      >
                        Import
                      </Button>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-white text-base">Reset Instance</p>
                        <p className="text-[#7c7c7c] text-sm">
                          Clear all data and restore to default settings
                        </p>
                      </div>
                      <Button
                        variant={"destructive"}
                        className="bg-[#381d1d] rounded-[7px] px-4 py-1 text-[#ff5656] text-sm font-medium h-auto hover:bg-[#6a2a2a] border-[#7f3434] border-[0.5px]"
                        onClick={() => setIsResetModalOpen(true)}
                      >
                        Reset
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div
        className="fixed top-0 left-0 right-0 h-[130px] z-10 pointer-events-none"
        style={{
          background:
            "linear-gradient(to bottom, #181818 5%, rgba(24, 24, 24, 0.95) 20%, rgba(24, 24, 24, 0.85) 30%, rgba(24, 24, 24, 0.7) 45%, rgba(24, 24, 24, 0.5) 60%, rgba(24, 24, 24, 0.3) 75%, rgba(24, 24, 24, 0.1) 90%, transparent 100%)",
        }}
      />

      <div
        className="fixed bottom-0 left-0 right-0 h-[70px] z-100 pointer-events-none"
        style={{
          background:
            "linear-gradient(to top, #181818 4%, rgba(24, 24, 24, 0.95) 20%, rgba(24, 24, 24, 0.85) 30%, rgba(24, 24, 24, 0.7) 45%, rgba(24, 24, 24, 0.5) 60%, rgba(24, 24, 24, 0.3) 76%, rgba(24, 24, 24, 0.1) 89%, transparent 100%)",
        }}
      />

      <EditProfileModal
        isOpen={isEditProfileModalOpen}
        onClose={() => setIsEditProfileModalOpen(false)}
        currentUsername={user?.username || ""}
        userCreatedAt={user?.created_at}
        currentDiscColors={preferences?.disc_colors}
        currentColorSpread={preferences?.color_spread}
        currentGradientSpread={preferences?.gradient_spread}
        currentColorShiftRotation={preferences?.color_shift_rotation}
        onSave={handleSaveProfile}
      />

      {user?.is_admin && (
        <UserManagementModal
          isOpen={isUserManagementModalOpen}
          onClose={() => setIsUserManagementModalOpen(false)}
        />
      )}

      {user?.is_admin && (
        <>
          <ExportInstanceModal
            isOpen={isExportModalOpen}
            onClose={() => setIsExportModalOpen(false)}
          />

          <ImportInstanceModal
            isOpen={isImportModalOpen}
            onClose={() => setIsImportModalOpen(false)}
          />

          <ResetInstanceModal
            isOpen={isResetModalOpen}
            onClose={() => setIsResetModalOpen(false)}
          />
        </>
      )}
    </div>
  );
}
