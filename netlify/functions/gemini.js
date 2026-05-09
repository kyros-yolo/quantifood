exports.handler = async (event) => {
  // CORS Headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const API_KEY = process.env.GEMINI_API_KEY;

  if (!API_KEY) {
    console.error('CRITICAL: GEMINI_API_KEY is not set in Netlify environment variables');
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'API-Konfiguration fehlt.', 
        details: 'GEMINI_API_KEY wurde in den Netlify-Umgebungsvariablen nicht gefunden.' 
      }),
    };
  }

  try {
    // Note: In 2026, gemini-2.5-flash is stable. 
    // Using v1 instead of v1beta for production stability.
    const url = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;
    
    console.log('Sending request to Gemini API...');
    
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: event.body,
    });

    const data = await res.json();

    if (!res.ok) {
      console.error('Google API Error Response:', data);
      return {
        statusCode: res.status,
        headers,
        body: JSON.stringify({
          error: 'Google API Fehler',
          details: data.error?.message || 'Unbekannter API-Fehler'
        }),
      };
    }

    return {
      statusCode: 200,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    };
  } catch (error) {
    console.error('Internal Function Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Interner Server-Fehler', 
        details: error.message 
      }),
    };
  }
};
