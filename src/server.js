const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./config');
const scanRoutes = require('./routes/scanRoutes');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api', scanRoutes);

app.listen(config.port, () => {
  console.log(`Content Velocity Scanner running on http://localhost:${config.port}`);
});
