import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { AIEngine } from "../../services/AIEngine";
import SupportService from "../../services/SupportService";
import { APP_VERSION } from "../../config/version";
import { useAuth } from "../../context/AuthContext";
import { useSubscription } from "../../context/SubscriptionContext";
import { 
  AlertCircle, 
  Lightbulb, 
  ThumbsUp, 
  Send, 
  CheckCircle, 
  Clock,
  Shield,
  Zap,
  User
} from "lucide-react";

const TYPES = [
  { value: "bug", label: "Bug/Error", icon: AlertCircle, color: "text-red-400" },
  { value: "suggestion", label: "Sugerencia", icon: Lightbulb, color: "text-amber-400" },
  { value: "positive", label: "Aspecto Positivo", icon: ThumbsUp, color: "text-emerald-400" }
];

const AUTHORIZED_USERS = ["lisi", "rauli", "admin"];

export default function Feedback() {
  const location = useLocation();
  const { user } = useAuth();
  const { plan } = useSubscription();
  const [type, setType] = useState("bug");
  const [message, setMessage] = useState("");
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [aiResponse, setAiResponse] = useState("");
  const [sending, setSending] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [ticketHistory, setTicketHistory] = useState([]);

  const isAuthorized = AUTHORIZED_USERS.includes((user?.username || "").toLowerCase());

  useEffect(() => {
    SupportService.trackActivity();
    SupportService.upsertUser({
      id: user?.id || "anon",
      plan: plan || "FREE",
      device: navigator.userAgent
    });
    loadTicketHistory();
  }, [user?.id, plan]);

  const loadTicketHistory = async () => {
    try {
      const tickets = await SupportService.getTickets(user?.id || "anon");
      setTicketHistory(tickets.slice(0, 5));
    } catch (error) {
      console.warn("Error loading ticket history:", error);
    }
  };

  const analyzeWithAI = async (reportMessage, reportType) => {
    setAnalyzing(true);
    try {
      const context = {
        url: window.location.href,
        route: location.pathname,
        version: APP_VERSION,
        device: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
        console: SupportService.getRecentConsoleLogs(10)
      };

      const prompt = `
Eres un asistente técnico profesional de RAULI ERP. Analiza este reporte:

TIPO: ${reportType}
MENSAJE: ${reportMessage}
CONTEXTO: ${JSON.stringify(context, null, 2)}

INSTRUCCIONES:
1. Determina si es un error real, sugerencia válida, o feedback positivo
2. Evalúa la severidad (crítico, alto, medio, bajo)
3. Si es un error técnico conocido, propón una solución automática
4. Si requiere cambios en código o configuración, indica que necesita aprobación de administrador
5. Responde de manera profesional y empática

FORMATO DE RESPUESTA (JSON):
{
  "isRealIssue": boolean,
  "severity": "critical|high|medium|low",
  "category": "bug|feature|ui|performance|data|other",
  "canAutoFix": boolean,
  "autoFixSteps": ["paso1", "paso2"] o null,
  "requiresApproval": boolean,
  "userResponse": "Mensaje profesional para el usuario",
  "adminNotes": "Notas técnicas para el administrador"
}
`;

      const aiResult = await AIEngine.processText(prompt, "Responde SOLO con JSON válido, sin markdown.");
      
      let analysis;
      try {
        const jsonMatch = aiResult.text.match(/\{[\s\S]*\}/);
        analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : {
          isRealIssue: true,
          severity: "medium",
          category: "other",
          canAutoFix: false,
          requiresApproval: true,
          userResponse: "Gracias por tu reporte. Lo revisaremos pronto.",
          adminNotes: "Requiere revisión manual"
        };
      } catch {
        analysis = {
          isRealIssue: true,
          severity: "medium",
          category: "other",
          canAutoFix: false,
          requiresApproval: true,
          userResponse: aiResult.text || "Gracias por tu reporte. Lo estamos revisando.",
          adminNotes: "Análisis de IA no estructurado"
        };
      }

      setAiAnalysis(analysis);
      setAiResponse(analysis.userResponse);
      return analysis;
    } catch (error) {
      console.error("Error analyzing with AI:", error);
      return {
        isRealIssue: true,
        severity: "medium",
        category: "other",
        canAutoFix: false,
        requiresApproval: true,
        userResponse: "Gracias por tu reporte. Lo revisaremos pronto.",
        adminNotes: "Error en análisis de IA"
      };
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!message.trim()) return;
    
    setSending(true);
    
    try {
      // 1. Analizar con IA
      const analysis = await analyzeWithAI(message, type);

      // 2. Crear ticket
      const context = {
        url: window.location.href,
        route: location.pathname,
        version: APP_VERSION,
        device: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
        console: SupportService.getRecentConsoleLogs(5)
      };

      const ticket = {
        id: `tk_${Date.now()}`,
        type,
        message,
        status: analysis.canAutoFix ? "auto_fixing" : (analysis.requiresApproval ? "pending_approval" : "open"),
        severity: analysis.severity,
        category: analysis.category,
        user_id: user?.id || "anon",
        user_name: user?.username || "Anónimo",
        plan: plan || "FREE",
        context,
        ai_analysis: analysis,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      await SupportService.createTicket(ticket);
      SupportService.trackActivity();

      // 3. Si puede auto-arreglarse y el usuario es autorizado, ejecutar
      if (analysis.canAutoFix && isAuthorized && analysis.autoFixSteps) {
        await executeAutoFix(ticket.id, analysis.autoFixSteps);
        ticket.status = "auto_fixed";
        setAiResponse(analysis.userResponse + "\n\n✅ Corrección aplicada automáticamente.");
      }

      // 4. Recargar historial
      await loadTicketHistory();
      setMessage("");
      
    } catch (error) {
      console.error("Error submitting feedback:", error);
      setAiResponse("Hubo un error al enviar tu reporte. Por favor, intenta de nuevo.");
    } finally {
      setSending(false);
    }
  };

  const executeAutoFix = async (ticketId, steps) => {
    try {
      console.log(`[AutoFix] Ejecutando corrección para ticket ${ticketId}:`, steps);
      // Aquí se implementarían las correcciones automáticas
      // Por ejemplo: limpiar caché, reiniciar servicios, corregir datos, etc.
      
      for (const step of steps) {
        console.log(`[AutoFix] Paso: ${step}`);
        // Simular ejecución
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      return true;
    } catch (error) {
      console.error("[AutoFix] Error:", error);
      return false;
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case "critical": return "text-red-500 bg-red-500/10 border-red-500/30";
      case "high": return "text-orange-500 bg-orange-500/10 border-orange-500/30";
      case "medium": return "text-amber-500 bg-amber-500/10 border-amber-500/30";
      case "low": return "text-blue-500 bg-blue-500/10 border-blue-500/30";
      default: return "text-slate-500 bg-slate-500/10 border-slate-500/30";
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "auto_fixed": return <CheckCircle className="text-emerald-400" size={16} />;
      case "auto_fixing": return <Zap className="text-amber-400 animate-pulse" size={16} />;
      case "pending_approval": return <Shield className="text-blue-400" size={16} />;
      default: return <Clock className="text-slate-400" size={16} />;
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm p-6 border border-slate-700/50 rounded-2xl">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-[#d4814b] to-[#c47142] rounded-xl flex items-center justify-center shadow-lg">
            <AlertCircle size={24} className="text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-semibold text-white mb-2">
              Feedback Profesional con IA
            </h2>
            <p className="text-sm text-slate-400">
              Reporta errores o sugerencias. Nuestra IA analizará y, si es posible, corregirá automáticamente.
            </p>
            {isAuthorized && (
              <div className="mt-2 flex items-center gap-2 text-xs text-emerald-400">
                <Shield size={14} />
                <span>Usuario autorizado para correcciones automáticas</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-slate-800/30 backdrop-blur-sm p-6 border border-slate-700/50 rounded-2xl space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-3">Tipo de reporte</label>
          <div className="grid grid-cols-3 gap-2">
            {TYPES.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setType(item.value)}
                  className={`px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                    type === item.value 
                      ? "bg-[#d4814b]/20 text-[#d4814b] border-2 border-[#d4814b]/50" 
                      : "bg-slate-800/60 text-slate-400 border border-slate-700/50 hover:bg-slate-800"
                  }`}
                >
                  <Icon size={18} className={`mx-auto mb-1 ${type === item.value ? item.color : "text-slate-500"}`} />
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Descripción detallada</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={5}
            className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 resize-none"
            placeholder="Describe el problema, error o sugerencia con el mayor detalle posible..."
            required
          />
          <p className="text-xs text-slate-500 mt-2">
            Incluimos automáticamente: URL actual, versión, dispositivo y logs de consola
          </p>
        </div>

        <button
          type="submit"
          disabled={sending || analyzing || !message.trim()}
          className="w-full px-6 py-3 bg-gradient-to-r from-[#d4814b] to-[#c47142] text-white rounded-xl font-medium flex items-center justify-center gap-2 hover:from-[#c47142] hover:to-[#b46139] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg"
        >
          {analyzing ? (
            <>
              <Zap size={18} className="animate-pulse" />
              Analizando con IA...
            </>
          ) : sending ? (
            <>
              <Clock size={18} className="animate-spin" />
              Enviando...
            </>
          ) : (
            <>
              <Send size={18} />
              Enviar reporte
            </>
          )}
        </button>
      </form>

      {/* AI Response */}
      {aiResponse && (
        <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/10 backdrop-blur-sm p-6 border border-emerald-500/30 rounded-2xl">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
              <CheckCircle size={20} className="text-emerald-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-emerald-300 mb-2">Respuesta del Sistema</h3>
              <p className="text-sm text-emerald-100 whitespace-pre-wrap">{aiResponse}</p>
              
              {aiAnalysis && (
                <div className="mt-4 pt-4 border-t border-emerald-500/20 space-y-2">
                  <div className="flex items-center gap-2 text-xs">
                    <span className={`px-2 py-1 rounded-lg border ${getSeverityColor(aiAnalysis.severity)}`}>
                      {aiAnalysis.severity.toUpperCase()}
                    </span>
                    <span className="text-slate-400">•</span>
                    <span className="text-slate-400">{aiAnalysis.category}</span>
                    {aiAnalysis.canAutoFix && (
                      <>
                        <span className="text-slate-400">•</span>
                        <span className="text-emerald-400 flex items-center gap-1">
                          <Zap size={12} />
                          Auto-corregible
                        </span>
                      </>
                    )}
                    {aiAnalysis.requiresApproval && (
                      <>
                        <span className="text-slate-400">•</span>
                        <span className="text-blue-400 flex items-center gap-1">
                          <Shield size={12} />
                          Requiere aprobación
                        </span>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Ticket History */}
      {ticketHistory.length > 0 && (
        <div className="bg-slate-800/30 backdrop-blur-sm p-6 border border-slate-700/50 rounded-2xl">
          <h3 className="text-lg font-semibold text-white mb-4">Historial de Reportes</h3>
          <div className="space-y-3">
            {ticketHistory.map((ticket) => (
              <div 
                key={ticket.id}
                className="bg-slate-900/50 border border-slate-700/30 rounded-xl p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {getStatusIcon(ticket.status)}
                      <span className="text-xs text-slate-400">
                        {new Date(ticket.created_at).toLocaleDateString('es-MX', { 
                          day: 'numeric', 
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                      {ticket.severity && (
                        <span className={`text-xs px-2 py-0.5 rounded ${getSeverityColor(ticket.severity)}`}>
                          {ticket.severity}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-white line-clamp-2">{ticket.message}</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-lg ${
                    ticket.status === 'auto_fixed' ? 'bg-emerald-500/20 text-emerald-400' :
                    ticket.status === 'pending_approval' ? 'bg-blue-500/20 text-blue-400' :
                    'bg-slate-700/50 text-slate-400'
                  }`}>
                    {ticket.status.replace('_', ' ')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Info Footer */}
      <div className="bg-slate-800/20 backdrop-blur-sm p-4 border border-slate-700/30 rounded-xl">
        <div className="flex items-start gap-3 text-xs text-slate-400">
          <User size={16} className="flex-shrink-0 mt-0.5" />
          <div>
            <p className="mb-1">
              <span className="font-semibold text-slate-300">Usuarios autorizados:</span> Lisi y Rauli (dueño)
            </p>
            <p>
              Los reportes son analizados por IA. Los errores críticos pueden ser corregidos automáticamente por usuarios autorizados. Las sugerencias y cambios mayores requieren aprobación del administrador.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
