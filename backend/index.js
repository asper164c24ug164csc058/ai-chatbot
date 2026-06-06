const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

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
  const botResponse = `You said: ${message}`;
  await pool.query(
    'INSERT INTO chat_history (session_id, user_message, bot_response) VALUES ($1, $2, $3)',
    [sessionId, message, botResponse]
  );
  res.json({ response: botResponse, session_id: sessionId });
});

app.get('/history', async (req, res) => {
  const result = await pool.query('SELECT * FROM chat_history ORDER BY created_at DESC LIMIT 50');
  res.json(result.rows);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
