const express = require('express');
const bodyParser = require('body-parser');
const compression = require('compression');
const cors = require('cors');
const helmet = require('helmet');

const routes = require('./routes');

const app = express();

app.use(helmet());
app.use(cors());
app.use(compression());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use('/api', routes);

app.get('*', function (_, res) {
    res.status(404).send('Not Found');
})

app.set('port', 8080);

app.listen(app.get('port'), () => {
    console.log(('Running at http://127.0.0.1:%d'), app.get('port'));
    console.log('Press CTRL-C to stop\n');
});
