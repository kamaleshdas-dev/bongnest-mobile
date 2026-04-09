import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

type VideoFeedSuspensionContextValue = {
  suspended: boolean;
  suspend: () => void;
  resume: () => void;
};

const VideoFeedSuspensionContext =
  createContext<VideoFeedSuspensionContextValue | null>(null);

export function VideoFeedSuspensionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [suspended, setSuspended] = useState(false);

  const suspend = useCallback(() => setSuspended(true), []);
  const resume = useCallback(() => setSuspended(false), []);

  const value = useMemo(
    () => ({ suspended, suspend, resume }),
    [suspended, suspend, resume],
  );

  return (
    <VideoFeedSuspensionContext.Provider value={value}>
      {children}
    </VideoFeedSuspensionContext.Provider>
  );
}

export function useVideoFeedSuspension() {
  const ctx = useContext(VideoFeedSuspensionContext);
  if (!ctx) {
    throw new Error(
      "useVideoFeedSuspension must be used within VideoFeedSuspensionProvider",
    );
  }
  return ctx;
}
