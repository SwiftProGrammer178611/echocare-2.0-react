import express from 'express';
import fetch from 'node-fetch';
import cors from 'cors';


const app = express();

app.use(cors({
    origin: 'http://localhost:3000',
    methods: ['GET','POST','OPTIONS'],
    allowedHeaders: ['Content-Type']
  }));
app.options('*', cors());  
app.use(express.json());

const ELEVENLABS_API_KEY = 'sk_f9e7217ee6edc72cdd72073d3e7d9aa2281462df6d909f0d';
const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1';

app.post('/api/tts', async (req, res) => {
  const { text, voiceId } = req.body;

  try {
    const response = await fetch(`${ELEVENLABS_API_URL}/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': ELEVENLABS_API_KEY,
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: { stability: 0.5, similarity_boost: 0.8 },
      }),
    });

    if (!response.ok) {
      return res.status(response.status).send(await response.text());
    }

    const audioBuffer = await response.arrayBuffer();
    res.setHeader('Content-Type', 'audio/mpeg');
    res.send(Buffer.from(audioBuffer));
  } catch (error) {
    res.status(500).send('Internal Server Error');
  }
});

app.listen(5001, () => console.log('Server running on http://localhost:5001'));
