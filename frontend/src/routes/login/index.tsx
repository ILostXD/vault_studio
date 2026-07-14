import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { useAuth } from "../../contexts/AuthContext";
import { LoginForm } from "../../components/LoginForm";
import { motion } from "motion/react";
import { checkUsersExist } from "../../api/auth";
import { getServerUrl, setServerUrl } from "../../api/server";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";

export const Route = createFileRoute("/login/")({
  component: LoginPage,
});

function LoginPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [hasCheckedUsers, setHasCheckedUsers] = useState(false);
  const [connectionError, setConnectionError] = useState(false);
  const [serverUrlInput, setServerUrlInput] = useState(() => getServerUrl());
  const [serverUrlError, setServerUrlError] = useState("");
  const [serverRevision, setServerRevision] = useState(0);

  const showServerUrlField = useMemo(
    () => Capacitor.isNativePlatform() || connectionError,
    [connectionError],
  );

  const applyServerUrl = useCallback(
    (options?: { recheck?: boolean }) => {
      if (showServerUrlField && !serverUrlInput.trim()) {
        setServerUrlError("Enter your backend URL first.");
        return false;
      }

      try {
        const normalized = setServerUrl(serverUrlInput);
        setServerUrlInput(normalized);
        setServerUrlError("");

        if (options?.recheck) {
          setConnectionError(false);
          setHasCheckedUsers(false);
          setServerRevision((current) => current + 1);
        }

        return true;
      } catch {
        setServerUrlError("Use a valid URL, for example http://192.168.1.253:8080.");
        return false;
      }
    },
    [serverUrlInput, showServerUrlField],
  );

  useEffect(() => {
    if (hasCheckedUsers || authLoading) {
      return;
    }

    const checkUsers = async () => {
      if (showServerUrlField && !getServerUrl()) {
        setHasCheckedUsers(true);
        setConnectionError(true);
        return;
      }

      try {
        const result = await checkUsersExist();
        setHasCheckedUsers(true);
        setConnectionError(false);
        if (!result.users_exist) {
          navigate({ to: "/initialize", replace: true });
        }
      } catch (error) {
        console.error("Failed to check if users exist:", error);
        setHasCheckedUsers(true);
        setConnectionError(true);
      }
    };

    checkUsers();
  }, [hasCheckedUsers, authLoading, navigate, showServerUrlField, serverRevision]);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate({ to: "/" });
    }
  }, [isAuthenticated, authLoading, navigate]);

  if (authLoading || (!hasCheckedUsers && !connectionError) || isAuthenticated) {
    return <div className="min-h-screen bg-(--bg-0)" />;
  }

  const handleLoginSuccess = () => {
    navigate({ to: "/" });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-(--bg-0) p-4">
      <div className="w-full max-w-[500px]">
        <motion.div
          layout
          initial={{ opacity: 0, y: 5, filter: "blur(8px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{
            opacity: { duration: 0.25, ease: [0.4, 0, 0.2, 1] },
            y: { duration: 0.25, ease: [0.4, 0, 0.2, 1] },
            filter: { duration: 0.25, ease: [0.4, 0, 0.2, 1] },
            layout: { type: "spring", stiffness: 400, damping: 25 },
          }}
          className="border border-(--card-border) rounded-[45px] px-10 py-12"
          style={{
            background: "linear-gradient(0deg, #131313 0%, #161616 100%)",
            boxShadow: "0 25px 27.4px -10px rgba(0, 0, 0, 0.19)",
          }}
        >
          <div className="text-center mb-8">
            <h1 className="text-[39px] font-light text-(--text-0)">{`{ vault.studio }`}</h1>
          </div>

          {showServerUrlField && (
            <div className="mb-6 space-y-2">
              <Label
                htmlFor="server-url"
                className="text-(--text-2) text-base font-light ml-5"
                style={{ fontFamily: '"IBM Plex Mono", monospace' }}
              >
                server url
              </Label>
              <div className="flex gap-2">
                <Input
                  id="server-url"
                  type="url"
                  inputMode="url"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  value={serverUrlInput}
                  onChange={(event) => {
                    setServerUrlInput(event.target.value);
                    setServerUrlError("");
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      applyServerUrl({ recheck: true });
                    }
                  }}
                  placeholder="http://192.168.1.253:8080"
                  className="themed-input-surface text-(--text-0) text-base md:text-base placeholder:text-(--text-0)/40 h-12 rounded-2xl px-5"
                />
                <Button
                  type="button"
                  onClick={() => applyServerUrl({ recheck: true })}
                  className="btn-surface h-12 rounded-2xl px-5 min-w-[94px]"
                >
                  Apply
                </Button>
              </div>
              {serverUrlError && (
                <p className="text-red-400 text-xs text-center px-4">
                  {serverUrlError}
                </p>
              )}
            </div>
          )}

          {connectionError ? (
            <div className="text-center space-y-4">
              <p className="text-red-400 text-sm">
                Unable to connect to the server
              </p>
              <button
                onClick={() => {
                  applyServerUrl({ recheck: true });
                }}
                className="px-4 py-2 text-sm text-(--text-0)/60 hover:text-(--text-0) transition-colors"
              >
                Retry
              </button>
            </div>
          ) : (
            <LoginForm
              onBeforeSubmit={() => applyServerUrl({ recheck: false })}
              onSubmitSuccess={handleLoginSuccess}
            />
          )}
        </motion.div>
      </div>
    </div>
  );
}
