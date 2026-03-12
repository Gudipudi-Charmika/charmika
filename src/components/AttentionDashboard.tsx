import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Eye, EyeOff, Camera, CameraOff, Activity, AlertTriangle,
  Monitor, Clock, Zap, Brain, Shield, ArrowRight, Trash2
} from "lucide-react";
import { useFaceDetection } from "@/hooks/useFaceDetection";
import { useAttentionMonitor, type AlertEntry } from "@/hooks/useAttentionMonitor";
import { streamChat, type Message } from "@/lib/gemini";
import ReactMarkdown from "react-markdown";

const AttentionDashboard = () => {
  const face = useFaceDetection();
  const monitor = useAttentionMonitor(face.attentionScore, face.isPresent);
  const [sessionTime, setSessionTime] = useState("0m");
  const [aiInsight, setAiInsight] = useState("");
  const [isLoadingInsight, setIsLoadingInsight] = useState(false);

  // Update session time every second
  useEffect(() => {
    const interval = setInterval(() => {
      setSessionTime(monitor.getSessionDuration());
    }, 1000);
    return () => clearInterval(interval);
  }, [monitor]);

  const getScoreColor = (score: number) => {
    if (score >= 70) return "text-primary";
    if (score >= 40) return "text-warning";
    return "text-destructive";
  };

  const getScoreBarColor = (score: number) => {
    if (score >= 70) return "bg-primary";
    if (score >= 40) return "bg-warning";
    return "bg-destructive";
  };

  const getScoreLabel = (score: number) => {
    if (score >= 70) return "Focused";
    if (score >= 40) return "Moderate";
    if (score > 0) return "Distracted";
    return "Inactive";
  };

  const getAlertIcon = (type: AlertEntry["type"]) => {
    switch (type) {
      case "low_attention": return <AlertTriangle className="w-3.5 h-3.5 text-destructive" />;
      case "tab_switch": return <Monitor className="w-3.5 h-3.5 text-warning" />;
      case "break_reminder": return <Clock className="w-3.5 h-3.5 text-accent" />;
      default: return <Zap className="w-3.5 h-3.5 text-muted-foreground" />;
    }
  };

  const requestAIInsight = async () => {
    setIsLoadingInsight(true);
    setAiInsight("");

    const alertSummary = monitor.alerts.slice(0, 10).map(a => `${a.type}: ${a.message}`).join("\n");
    const messages: Message[] = [{
      role: "user",
      content: `You are an educational AI assistant analyzing student attention data. Based on the following metrics, provide a brief, actionable insight (2-3 sentences max):

- Current attention score: ${face.attentionScore}%
- Face presence: ${face.isPresent ? "Yes" : "No"}
- Tab switches: ${monitor.tabSwitchCount}
- Session duration: ${sessionTime}
- Recent alerts:
${alertSummary || "None"}

Provide a short, encouraging recommendation for the student.`
    }];

    try {
      await streamChat({
        messages,
        onDelta: (chunk) => setAiInsight(prev => prev + chunk),
        onDone: () => setIsLoadingInsight(false),
      });
    } catch {
      setAiInsight("Unable to generate insight at this time.");
      setIsLoadingInsight(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      {/* Header */}
      <header className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Brain className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Student Attention Monitor</h1>
            <p className="text-xs text-muted-foreground font-mono">Session: {sessionTime}</p>
          </div>
        </div>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={face.isWebcamActive ? face.stopWebcam : face.startWebcam}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
            face.isWebcamActive
              ? "bg-destructive/10 text-destructive hover:bg-destructive/20"
              : "bg-primary/10 text-primary hover:bg-primary/20"
          }`}
        >
          {face.isWebcamActive ? <CameraOff className="w-4 h-4" /> : <Camera className="w-4 h-4" />}
          {face.isWebcamActive ? "Stop Camera" : "Start Camera"}
        </motion.button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left Column: Webcam + Metrics */}
        <div className="lg:col-span-2 space-y-4">
          {/* Webcam Feed */}
          <div className="relative rounded-xl overflow-hidden bg-card border border-border aspect-video">
            <video
              ref={face.videoRef}
              className="w-full h-full object-cover"
              autoPlay
              muted
              playsInline
            />
            <canvas ref={face.canvasRef} className="hidden" />

            {!face.isWebcamActive && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                <Camera className="w-12 h-12 text-muted-foreground/30" />
                <p className="text-muted-foreground text-sm">Click "Start Camera" to begin monitoring</p>
              </div>
            )}

            {face.isWebcamActive && (
              <>
                {/* Scan line effect */}
                <div className="absolute inset-0 pointer-events-none overflow-hidden">
                  <div className="w-full h-0.5 bg-primary/30 animate-scan" />
                </div>
                {/* Status overlay */}
                <div className="absolute top-3 left-3 flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${face.isPresent ? "bg-primary animate-glow" : "bg-destructive"}`} />
                  <span className="text-xs font-mono bg-background/70 backdrop-blur px-2 py-0.5 rounded">
                    {face.isPresent ? "FACE DETECTED" : "NO FACE"}
                  </span>
                </div>
                <div className="absolute top-3 right-3">
                  <span className="text-xs font-mono bg-background/70 backdrop-blur px-2 py-0.5 rounded text-destructive">
                    ● LIVE
                  </span>
                </div>
              </>
            )}

            {face.error && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/90">
                <p className="text-destructive text-sm">{face.error}</p>
              </div>
            )}
          </div>

          {/* Metrics Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* Presence */}
            <MetricCard
              icon={face.isPresent ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              label="Presence"
              value={face.isPresent ? "Active" : "Away"}
              valueColor={face.isPresent ? "text-primary" : "text-destructive"}
            />
            {/* Attention Score */}
            <MetricCard
              icon={<Activity className="w-4 h-4" />}
              label="Attention"
              value={`${face.attentionScore}%`}
              valueColor={getScoreColor(face.attentionScore)}
            />
            {/* Tab Switches */}
            <MetricCard
              icon={<Monitor className="w-4 h-4" />}
              label="Tab Switches"
              value={`${monitor.tabSwitchCount}`}
              valueColor={monitor.tabSwitchCount > 5 ? "text-destructive" : "text-foreground"}
            />
            {/* Status */}
            <MetricCard
              icon={<Zap className="w-4 h-4" />}
              label="Status"
              value={getScoreLabel(face.attentionScore)}
              valueColor={getScoreColor(face.attentionScore)}
            />
          </div>

          {/* Engagement Bar */}
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Engagement Level</span>
              <span className={`text-sm font-mono font-bold ${getScoreColor(face.attentionScore)}`}>
                {face.attentionScore}%
              </span>
            </div>
            <div className="h-3 bg-secondary rounded-full overflow-hidden">
              <motion.div
                className={`h-full rounded-full ${getScoreBarColor(face.attentionScore)}`}
                initial={{ width: 0 }}
                animate={{ width: `${face.attentionScore}%` }}
                transition={{ duration: 0.5, ease: "easeOut" }}
              />
            </div>
          </div>

          {/* AI Insights */}
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4 text-accent" />
                <span className="text-sm font-medium">AI Insights</span>
              </div>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={requestAIInsight}
                disabled={isLoadingInsight}
                className="flex items-center gap-1.5 text-xs font-medium text-accent hover:text-accent/80 disabled:opacity-50 transition-colors"
              >
                Generate Insight <ArrowRight className="w-3 h-3" />
              </motion.button>
            </div>
            {isLoadingInsight && !aiInsight && (
              <div className="flex items-center gap-2 py-3">
                <div className="w-2 h-2 rounded-full bg-accent animate-pulse-dot" />
                <span className="text-xs text-muted-foreground">Analyzing attention data...</span>
              </div>
            )}
            {aiInsight && (
              <div className="prose prose-invert prose-sm max-w-none text-sm text-secondary-foreground [&_p]:leading-relaxed">
                <ReactMarkdown>{aiInsight}</ReactMarkdown>
              </div>
            )}
            {!aiInsight && !isLoadingInsight && (
              <p className="text-xs text-muted-foreground py-2">
                Click "Generate Insight" to get AI-powered analysis of your attention patterns.
              </p>
            )}
          </div>
        </div>

        {/* Right Column: Alerts */}
        <div className="space-y-4">
          {/* Privacy Notice */}
          <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4">
            <div className="flex items-start gap-2">
              <Shield className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-medium text-destructive">Privacy Notice</p>
                <p className="text-xs text-destructive/70 mt-1">
                  This system uses camera-based AI to analyze engagement. No video is stored or transmitted.
                </p>
              </div>
            </div>
          </div>

          {/* Alert Log */}
          <div className="bg-card border border-border rounded-xl p-4 max-h-[600px] flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-warning" />
                <span className="text-sm font-medium">Alert Log</span>
                <span className="text-xs text-muted-foreground font-mono">({monitor.alerts.length})</span>
              </div>
              {monitor.alerts.length > 0 && (
                <button
                  onClick={monitor.clearAlerts}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto space-y-2">
              <AnimatePresence initial={false}>
                {monitor.alerts.length === 0 && (
                  <p className="text-xs text-muted-foreground py-4 text-center">No alerts yet.</p>
                )}
                {monitor.alerts.map((alert) => (
                  <motion.div
                    key={alert.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="flex items-start gap-2 p-2.5 bg-secondary/50 rounded-lg"
                  >
                    <div className="mt-0.5 shrink-0">{getAlertIcon(alert.type)}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-foreground leading-snug">{alert.message}</p>
                      <p className="text-[10px] text-muted-foreground font-mono mt-1">
                        {alert.timestamp.toLocaleTimeString()}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="bg-card border border-border rounded-xl p-4">
            <span className="text-sm font-medium mb-3 block">Session Summary</span>
            <div className="space-y-2.5">
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Duration</span>
                <span className="text-xs font-mono font-medium">{sessionTime}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Tab Switches</span>
                <span className="text-xs font-mono font-medium">{monitor.tabSwitchCount}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Total Alerts</span>
                <span className="text-xs font-mono font-medium">{monitor.alerts.length}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Tab Status</span>
                <span className={`text-xs font-mono font-medium ${monitor.isTabActive ? "text-primary" : "text-destructive"}`}>
                  {monitor.isTabActive ? "Active" : "Inactive"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Reusable metric card component
function MetricCard({ icon, label, value, valueColor }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueColor: string;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-3.5">
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="text-muted-foreground">{icon}</span>
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className={`text-lg font-bold font-mono ${valueColor}`}>{value}</p>
    </div>
  );
}

export default AttentionDashboard;
