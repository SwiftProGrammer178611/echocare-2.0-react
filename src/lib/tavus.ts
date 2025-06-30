// Tavus API integration for video conversations
const TAVUS_API_BASE = 'https://tavusapi.com';

interface TavusConversation {
  conversation_url: string;
  conversation_id: string;
}

interface TavusEndResponse {
  success: boolean;
  message?: string;
}

interface TavusConnectionTest {
  connected: boolean;
  error?: string;
  replicaCount: number;
}

export async function createTavusConversation(): Promise<TavusConversation> {
  const apiKey = "1b61edf8515c40c4a9c428ea43c88975";
  const replicaId = "rf4703150052";
  const personaId = "p4c1653bd778";

  if (!apiKey || !replicaId || !personaId) {
    throw new Error('Missing Tavus configuration. Please check your environment variables.');
  }

  try {
    const response = await fetch(`${TAVUS_API_BASE}/v2/conversations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({
        replica_id: replicaId,
        persona_id: personaId,
        callback_url: `${window.location.origin}/api/tavus/callback`,
      }),
    });

    if (!response.ok) {
      throw new Error(`Tavus API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    return {
      conversation_url: data.conversation_url,
      conversation_id: data.conversation_id,
    };
  } catch (error) {
    console.error('Error creating Tavus conversation:', error);
    
    // Return mock data for development/testing
    return {
      conversation_url: `https://tavus.io/conversations/mock-${Date.now()}`,
      conversation_id: `mock_conversation_${Date.now()}`,
    };
  }
}

export async function createTavusSpeech(opts: {
  replica_id: string
  script: string
}): Promise<{ speech_file_url: string }> {
  const apiKey = '1b61edf8515c40c4a9c428ea43c88975';

  const response = await fetch(`https://tavusapi.com/v2/speech`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify(opts),
  });

  if (!response.ok) {
    throw new Error(`Tavus speech API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return {
    speech_file_url: data.speech_file_url,
  };
}

export async function createSpeech(script: string = "Hello, this is a test speech from Tavus API.") {
  try {
    const result = await createTavusSpeech({
      replica_id: 'r4d9b2288937',
      script: "Hello, this is a test speech from Tavus API"
    });
    return result;
  } catch (error: any) {
    console.error('Tavus speech API error:', error.message || error);
    throw error;
  }
}


export async function endTavusConversation(conversationId: string): Promise<TavusEndResponse> {
  const apiKey = "1b61edf8515c40c4a9c428ea43c88975";

  if (!apiKey) {
    throw new Error('Missing Tavus API key');
  }

  try {
    const response = await fetch(`${TAVUS_API_BASE}/v2/conversations/${conversationId}/end`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
    });

    if (!response.ok) {
      throw new Error(`Tavus API error: ${response.status} ${response.statusText}`);
    }

    return {
      success: true,
    };
  } catch (error) {
    console.error('Error ending Tavus conversation:', error);
    
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

export async function testTavusConnection(): Promise<TavusConnectionTest> {
  const apiKey = import.meta.env.VITE_TAVUS_API_KEY;
  const replicaId = import.meta.env.VITE_TAVUS_REPLICA_ID;

  if (!apiKey) {
    return {
      connected: false,
      error: 'Missing Tavus API key',
      replicaCount: 0,
    };
  }

  try {
    const response = await fetch(`${TAVUS_API_BASE}/v2/replicas`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
    });

    if (!response.ok) {
      throw new Error(`Tavus API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const replicas = data.data || [];
    
    // Check if the specified replica exists
    const hasSpecifiedReplica = replicaId ? 
      replicas.some((replica: any) => replica.replica_id === replicaId) : 
      true;

    return {
      connected: true,
      replicaCount: replicas.length,
      error: !hasSpecifiedReplica ? 'Specified replica not found' : undefined,
    };
  } catch (error) {
    console.error('Error testing Tavus connection:', error);
    
    return {
      connected: false,
      error: error instanceof Error ? error.message : 'Connection test failed',
      replicaCount: 0,
    };
  }
}

// Helper function to get conversation status
export async function getTavusConversationStatus(conversationId: string) {
  const apiKey = import.meta.env.VITE_TAVUS_API_KEY;

  if (!apiKey) {
    throw new Error('Missing Tavus API key');
  }

  try {
    const response = await fetch(`${TAVUS_API_BASE}/v2/conversations/${conversationId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
    });

    if (!response.ok) {
      throw new Error(`Tavus API error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error getting Tavus conversation status:', error);
    throw error;
  }
}