require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const app = express();
app.use(bodyParser.urlencoded({ extended: false }));

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = require('twilio')(accountSid, authToken);

app.get('/notify', (req, res) => {
  const message = 'Tocaron el timbre';
  client.messages.create({
    body: message,
    from: `${process.env.TWILIO_PHONE_NUMBER}`,
    to: '+541160505888' // Cambia los números según sea necesario
  })
  .then(message => {
    res.send('Notificación enviada');
  })
  .catch(err => {
    res.status(500).send(err);
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
