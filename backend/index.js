const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');
const Groq = require('groq-sdk');

dotenv.config();

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

pool.query(`
  CREATE TABLE IF NOT EXISTS chat_history (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(255),
    user_message TEXT,
    bot_response TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`).then(() => console.log('Table ready'));

app.get('/health', (req, res) => {
  res.json({ status: 'running' });
});

app.post('/chat', async (req, res) => {
  const { message, session_id } = req.body;
  const sessionId = session_id || uuidv4();

  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: message }]
    });
    const botResponse = completion.choices[0].message.content;

    await pool.query(
      'INSERT INTO chat_history (session_id, user_message, bot_response) VALUES ($1, $2, $3)',
      [sessionId, message, botResponse]
    );

    res.json({ response: botResponse, session_id: sessionId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'AI service error' });
  }
});

app.get('/history', async (req, res) => {
  const result = await pool.query('SELECT * FROM chat_history ORDER BY created_at DESC LIMIT 50');
  res.json(result.rows);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
