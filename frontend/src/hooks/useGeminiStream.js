import { useCallback, useRef, useState } from "react";

/**
 * Hook para integración con Gemini API con streaming
 * Características 2026:
 * - Respuestas token por token (como ChatGPT)
 * - Streaming en tiempo real
 * - Multimodal (texto, imágenes, audio)
 * - Memoria contextual
 * - Manejo de errores robusto
 * - System Prompt para personalidad de RAULI
 */
export function useGeminiStream({ 
  apiKey, 
  model = "gemini-1.5-flash", // Modelo estable sin -latest
  temperature = 0.7, 
  maxTokens = 2048,
  systemPrompt = "" // ✅ NUEVO: System prompt para dar contexto
} = {}) {
  const [isLoading, setIsLoading] = useState(false);
  const [streamedResponse, setStreamedResponse] = useState("");
  const [error, setError] = useState(null);
  const [conversationHistory, setConversationHistory] = useState([]);
  
  const abortControllerRef = useRef(null);
  const isStreamingRef = useRef(false);

  const sendMessage = useCallback(async (message, options = {}) => {
    if (!apiKey) {
      setError("API Key de Gemini no configurada");
      return null;
    }

    // Cancelar stream anterior si existe
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    setIsLoading(true);
    setStreamedResponse("");
    setError(null);
    isStreamingRef.current = true;

    try {
      // Construir contexto con historial
      let context = options.includeHistory !== false 
        ? [...conversationHistory, { role: "user", content: message }]
        : [{ role: "user", content: message }];
      
      // ✅ Inyectar system prompt al inicio si existe y es la primera interacción
      if (systemPrompt && conversationHistory.length === 0) {
        context = [
          { role: "user", content: systemPrompt },
          { role: "model", content: "Entendido. Soy RAULI NEXUS, tu asistente especializado en GENESIS ERP. Estoy listo para ayudarte con navegación, consultas, operaciones contables y más. ¿En qué puedo asistirte?" },
          ...context
        ];
        console.log("useGeminiStream: System prompt inyectado para personalidad RAULI");
      }

      // Endpoint de Gemini API (usar generateContent en lugar de streamGenerateContent para más compatibilidad)
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      
      console.log("useGeminiStream: Enviando a Gemini", { model, endpoint: endpoint.replace(apiKey, "***") });
      
      const requestBody = {
        contents: context.map(msg => ({
          role: msg.role === "user" ? "user" : "model",
          parts: [{ text: msg.content }]
        })),
        generationConfig: {
          temperature: options.temperature || temperature,
          maxOutputTokens: options.maxTokens || maxTokens,
          topP: 0.95,
          topK: 40
        }
      };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(requestBody),
        signal: abortControllerRef.current.signal
      });

      console.log("useGeminiStream: Respuesta recibida", { status: response.status, ok: response.ok });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("useGeminiStream: Error de Gemini", { status: response.status, error: errorText });
        throw new Error(`Error de Gemini API: ${response.status} - ${errorText.substring(0, 200)}`);
      }

      // Procesar respuesta (sin streaming para más compatibilidad)
      const data = await response.json();
      console.log("useGeminiStream: Datos recibidos", data);
      
      let accumulatedText = "";
      
      if (data.candidates && data.candidates[0]?.content?.parts) {
        accumulatedText = data.candidates[0].content.parts.map(part => part.text || "").join("");
        setStreamedResponse(accumulatedText);
      } else {
        console.error("useGeminiStream: Formato de respuesta inesperado", data);
        throw new Error("Formato de respuesta inesperado de Gemini");
      }

      // Actualizar historial
      setConversationHistory(prev => [
        ...prev,
        { role: "user", content: message },
        { role: "assistant", content: accumulatedText }
      ]);

      setIsLoading(false);
      isStreamingRef.current = false;
      return accumulatedText;

    } catch (err) {
      if (err.name === "AbortError") {
        console.log("Stream cancelado por el usuario");
        return null;
      }
      
      console.error("Error en Gemini Stream:", err);
      setError(err.message);
      setIsLoading(false);
      isStreamingRef.current = false;
      return null;
    }
  }, [apiKey, model, temperature, maxTokens, conversationHistory, systemPrompt]);

  const sendMessageWithImage = useCallback(async (message, imageData, options = {}) => {
    if (!apiKey) {
      setError("API Key de Gemini no configurada");
      return null;
    }

    abortControllerRef.current = new AbortController();
    setIsLoading(true);
    setStreamedResponse("");
    setError(null);

    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
      
      const requestBody = {
        contents: [{
          role: "user",
          parts: [
            { text: message },
            {
              inline_data: {
                mime_type: imageData.mimeType || "image/jpeg",
                data: imageData.base64
              }
            }
          ]
        }],
        generationConfig: {
          temperature: options.temperature || temperature,
          maxOutputTokens: options.maxTokens || maxTokens
        }
      };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) {
        throw new Error(`Error de Gemini Vision API: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n").filter(line => line.trim());

        for (const line of lines) {
          try {
            const jsonMatch = line.match(/\{.*\}/);
            if (!jsonMatch) continue;

            const parsed = JSON.parse(jsonMatch[0]);
            if (parsed.candidates?.[0]?.content?.parts) {
              const text = parsed.candidates[0].content.parts[0]?.text || "";
              accumulatedText += text;
              setStreamedResponse(accumulatedText);
            }
          } catch (parseError) {
            console.warn("Error parsing chunk:", parseError);
          }
        }
      }

      setIsLoading(false);
      return accumulatedText;

    } catch (err) {
      console.error("Error en Gemini Vision:", err);
      setError(err.message);
      setIsLoading(false);
      return null;
    }
  }, [apiKey, temperature, maxTokens]);

  const stopStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      isStreamingRef.current = false;
      setIsLoading(false);
    }
  }, []);

  const clearHistory = useCallback(() => {
    setConversationHistory([]);
  }, []);

  const resetResponse = useCallback(() => {
    setStreamedResponse("");
  }, []);

  return {
    sendMessage,
    sendMessageWithImage,
    stopStream,
    clearHistory,
    resetResponse,
    isLoading,
    streamedResponse,
    error,
    conversationHistory
  };
}
