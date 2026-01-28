/**
 * 🧪 TEST GEMINI API
 * Utilidad para probar si la API Key de Gemini funciona correctamente
 */

export async function testGeminiAPI(apiKey) {
  if (!apiKey || apiKey.trim() === "") {
    return {
      success: false,
      error: "API Key no proporcionada",
      details: "Debes configurar una API Key válida"
    };
  }

  // Modelos a probar en orden de preferencia
  const modelsToTest = [
    "gemini-1.5-flash",
    "gemini-1.5-pro",
    "gemini-pro",
    "gemini-1.5-flash-latest",
    "gemini-1.5-pro-latest"
  ];

  console.log("🧪 Iniciando prueba de Gemini API...");
  console.log("🔑 API Key:", apiKey.substring(0, 10) + "..." + apiKey.substring(apiKey.length - 4));

  const results = [];

  for (const model of modelsToTest) {
    try {
      console.log(`\n📡 Probando modelo: ${model}`);
      
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      
      const requestBody = {
        contents: [{
          role: "user",
          parts: [{ text: "Hola, responde solo con 'OK'" }]
        }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 50
        }
      };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();

      if (response.ok) {
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
        console.log(`✅ ${model}: FUNCIONA`);
        console.log(`   Respuesta: "${text.substring(0, 50)}..."`);
        
        results.push({
          model,
          status: "success",
          response: text,
          statusCode: response.status
        });
        
        // Si encontramos uno que funciona, retornamos inmediatamente
        return {
          success: true,
          workingModel: model,
          response: text,
          allResults: results
        };
      } else {
        console.error(`❌ ${model}: Error ${response.status}`);
        console.error(`   Error:`, data);
        
        results.push({
          model,
          status: "error",
          error: data,
          statusCode: response.status
        });
      }
    } catch (error) {
      console.error(`❌ ${model}: Excepción`);
      console.error(`   Error:`, error.message);
      
      results.push({
        model,
        status: "exception",
        error: error.message
      });
    }
  }

  // Si llegamos aquí, ningún modelo funcionó
  return {
    success: false,
    error: "Ningún modelo funcionó",
    details: "Verifica tu API Key o límites de uso",
    allResults: results
  };
}

/**
 * 🔍 Verificar disponibilidad de modelos
 */
export async function listAvailableModels(apiKey) {
  if (!apiKey || apiKey.trim() === "") {
    return {
      success: false,
      error: "API Key no proporcionada"
    };
  }

  try {
    console.log("📋 Listando modelos disponibles...");
    
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    
    const response = await fetch(endpoint);
    const data = await response.json();

    if (response.ok) {
      const models = data.models || [];
      console.log(`✅ Encontrados ${models.length} modelos:`);
      
      models.forEach(model => {
        console.log(`   - ${model.name}`);
      });

      return {
        success: true,
        models: models.map(m => ({
          name: m.name,
          displayName: m.displayName,
          description: m.description,
          supportedMethods: m.supportedGenerationMethods
        }))
      };
    } else {
      console.error("❌ Error al listar modelos:", data);
      return {
        success: false,
        error: data,
        statusCode: response.status
      };
    }
  } catch (error) {
    console.error("❌ Excepción al listar modelos:", error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 🏥 Diagnóstico completo de Gemini
 */
export async function diagnoseGemini(apiKey) {
  console.log("🏥 DIAGNÓSTICO COMPLETO DE GEMINI API");
  console.log("=".repeat(60));
  
  // 1. Verificar formato de API Key
  console.log("\n1️⃣ Verificando formato de API Key...");
  if (!apiKey || apiKey.trim() === "") {
    console.error("❌ API Key vacía o no configurada");
    return { valid: false, reason: "API Key no configurada" };
  }
  
  if (!apiKey.startsWith("AIza")) {
    console.warn("⚠️ La API Key no tiene el formato típico (AIza...)");
  } else {
    console.log("✅ Formato de API Key parece correcto");
  }
  
  // 2. Listar modelos disponibles
  console.log("\n2️⃣ Listando modelos disponibles...");
  const modelsResult = await listAvailableModels(apiKey);
  
  if (!modelsResult.success) {
    console.error("❌ No se pudo listar modelos");
    console.error("   Esto puede indicar:");
    console.error("   - API Key inválida");
    console.error("   - API Key sin permisos");
    console.error("   - Límite de uso excedido");
    console.error("   - API Key deshabilitada");
    return { 
      valid: false, 
      reason: "No se pudo listar modelos",
      error: modelsResult.error 
    };
  }
  
  console.log(`✅ Se pudieron listar ${modelsResult.models.length} modelos`);
  
  // 3. Probar modelos
  console.log("\n3️⃣ Probando modelos...");
  const testResult = await testGeminiAPI(apiKey);
  
  if (testResult.success) {
    console.log(`✅ Modelo funcionando: ${testResult.workingModel}`);
    return {
      valid: true,
      workingModel: testResult.workingModel,
      availableModels: modelsResult.models,
      recommendation: `Usar modelo: ${testResult.workingModel}`
    };
  } else {
    console.error("❌ Ningún modelo funcionó");
    return {
      valid: false,
      reason: "Ningún modelo funcionó",
      availableModels: modelsResult.models,
      testResults: testResult.allResults
    };
  }
}

// Hacer disponible en consola para debugging
if (typeof window !== "undefined") {
  window.testGeminiAPI = testGeminiAPI;
  window.listAvailableModels = listAvailableModels;
  window.diagnoseGemini = diagnoseGemini;
  
  console.log("🧪 Utilidades de Gemini disponibles en consola:");
  console.log("   - testGeminiAPI(apiKey)");
  console.log("   - listAvailableModels(apiKey)");
  console.log("   - diagnoseGemini(apiKey)");
}
