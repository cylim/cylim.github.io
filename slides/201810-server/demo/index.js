const express = require('express')
// Middles 1
const bodyParser = require('body-parser') // req.body
const compression = require('compression') // gzip
const cors = require('cors') // cross origin
const helmet = require('helmet') // security

const app = express()
// Middles 2
app.use(helmet())
app.use(cors())
app.use(compression())
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))

// handle API routes: express3
app.use('/api', require('./routes'))

app.get('/', function (_, res) {
    res.sendFile(__dirname + '/index.html');
});

app.get('*', function (_, res) {
    res.status(404).send('Not Found')
})

app.set('port', 8080)

const feedback = () => {
    console.log(('Running at http://localhost:%d'), app.get('port'));
}
// app.listen(app.get('port'), feedback)

const server = require('http').Server(app)

server.listen(app.get('port'), feedback)
const socket = require('./utils/socket');
socket(server)