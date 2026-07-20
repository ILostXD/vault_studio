import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { validateShareToken } from "@/api/sharing";
import SharedProjectView from "@/components/SharedProjectView";
import SharedTrackPlayer from "@/components/SharedTrackPlayer";
import LinkNotAvailable from "@/components/LinkNotAvailable";

export const Route = createFileRoute("/share/$token")({
  component: SharePage,
});

interface ShareData {
  valid: boolean;
  password_required?: boolean;
  track?: any;
  project?: any;
  tracks?: any[];
  version?: any;
  allow_editing?: boolean;
  allow_downloads?: boolean;
  error?: string;
  feedback_question?: string | null;
}

function SharePage() {
  const { token } = Route.useParams();
  const [shareData, setShareData] = useState<ShareData | null>(null);
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState(false);

  const loadShareData = async (pwd?: string) => {
    setIsLoading(true);
    setError(null);
    setPasswordError(false);

    try {
      const data = await validateShareToken(token, pwd);

      if (!data.valid) {
        if (data.password_required) {
          setShareData({ ...data, valid: false });
          setPasswordError(pwd !== undefined);
        } else {
          setError(data.error || "Invalid share link");
        }
      } else {
        setShareData(data as ShareData);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load shared content");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadShareData();
  }, [token]);

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadShareData(password);
  };

  if (isLoading) {
    return null;
  }

  if (error) {
    return <LinkNotAvailable />;
  }

  if (shareData && !shareData.valid && shareData.password_required) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-linear-to-b from-(--card-gradient-from) to-(--card-gradient-to) border border-(--card-border) rounded-3xl p-8">
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center">
                <Lock className="size-8 text-(--text-0)" />
              </div>
            </div>
            <h1 className="text-2xl font-semibold text-(--text-0) text-center mb-2">
              Password Required
            </h1>
            <p className="text-muted-foreground text-center mb-6">
              This share is password protected
            </p>
            <form onSubmit={handlePasswordSubmit}>
              <Input
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={
                  "text-(--text-0) " + (passwordError ? "border-red-500" : "")
                }
                autoFocus
              />
              {passwordError && (
                <p className="text-red-500 text-sm mt-2">Incorrect password</p>
              )}
              <Button type="submit" className="w-full mt-4">
                Unlock
              </Button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  if (shareData?.track) {
    const track = shareData.track;

    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-5xl space-y-4">
          {shareData.feedback_question && (
            <div className="rounded-xl border border-(--card-border) bg-(--bg-1) px-5 py-4 text-center text-lg text-(--text-0)">
              {shareData.feedback_question}
            </div>
          )}
          <SharedTrackPlayer
            track={track}
            project={shareData.project}
            token={token}
            sharePassword={password}
            allowDownloads={shareData.allow_downloads}
            allowEditing={shareData.allow_editing}
          />
        </div>
      </div>
    );
  }

  if (shareData?.project) {
    return (
      <SharedProjectView
        project={shareData.project}
        tracks={shareData.tracks || []}
        shareToken={token}
        sharePassword={password}
        feedbackQuestion={shareData.feedback_question}
        allowDownloads={shareData.allow_downloads || false}
      />
    );
  }

  return null;
}
