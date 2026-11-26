import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

interface MirrorContextValue {
  isMirrored: boolean;
  toggleMirrored: () => void;
}

const MirrorContext = createContext<MirrorContextValue>({
  isMirrored: true,
  toggleMirrored: () => {},
});

export function MirrorProvider({ children }: { children: ReactNode }) {
  const [isMirrored, setIsMirrored] = useState(true);
  const toggleMirrored = useCallback(() => {
    setIsMirrored((prev) => !prev);
  }, []);

  return (
    <MirrorContext.Provider value={{ isMirrored, toggleMirrored }}>
      {children}
    </MirrorContext.Provider>
  );
}

export function useMirror() {
  return useContext(MirrorContext);
}
