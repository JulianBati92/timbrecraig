const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/notify', async (req, res) => {
  try {
    // Hacer solicitudes a ambos enlaces
    await Promise.all([
      axios.get('https://organized-calm-chatter.glitch.me/notify'),
      axios.get('https://curved-disco-lasagna.glitch.me/notify')
    ]);

    res.send('Notificaciones enviadas a ambos enlaces');
  } catch (error) {
    res.status(500).send('Error al enviar notificaciones');
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
