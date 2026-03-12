import { useState, useEffect, useCallback, useRef } from "react";

export interface AlertEntry {
  id: string;
  type: "low_attention" | "tab_switch" | "break_reminder" | "info";
  message: string;
  timestamp: Date;
}

export function useAttentionMonitor(attentionScore: number, isPresent: boolean) {
  const [alerts, setAlerts] = useState<AlertEntry[]>([]);
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [sessionStart] = useState(new Date());
  const [isTabActive, setIsTabActive] = useState(true);
  const lastAlertRef = useRef<number>(0);
  const breakIntervalRef = useRef<number | null>(null);

  const addAlert = useCallback((type: AlertEntry["type"], message: string) => {
    const now = Date.now();
    // Throttle alerts to one per 10 seconds
    if (now - lastAlertRef.current < 10000 && type === "low_attention") return;
    lastAlertRef.current = now;

    setAlerts(prev => [{
      id: crypto.randomUUID(),
      type,
      message,
      timestamp: new Date(),
    }, ...prev].slice(0, 50));
  }, []);

  // Low attention alerts
  useEffect(() => {
    if (attentionScore < 30 && attentionScore > 0) {
      addAlert("low_attention", `Low attention detected! Score: ${attentionScore}%`);
    }
  }, [attentionScore, addAlert]);

  // Tab visibility detection
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        setIsTabActive(false);
        setTabSwitchCount(prev => prev + 1);
        addAlert("tab_switch", "Student switched to another tab!");
      } else {
        setIsTabActive(true);
        addAlert("info", "Student returned to this tab.");
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [addAlert]);

  // Break reminder every 30 minutes
  useEffect(() => {
    breakIntervalRef.current = window.setInterval(() => {
      addAlert("break_reminder", "Time for a short break! You've been studying for 30 minutes.");
    }, 1800000);

    return () => {
      if (breakIntervalRef.current) clearInterval(breakIntervalRef.current);
    };
  }, [addAlert]);

  const getSessionDuration = useCallback(() => {
    const diff = Date.now() - sessionStart.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    return `${minutes}m`;
  }, [sessionStart]);

  const clearAlerts = useCallback(() => setAlerts([]), []);

  return {
    alerts,
    tabSwitchCount,
    isTabActive,
    sessionStart,
    getSessionDuration,
    clearAlerts,
    addAlert,
  };
}
