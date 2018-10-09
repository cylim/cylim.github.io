const emitter = require('./emitter')
const Socket = require('socket.io')

let io = {}

function sendMessageSocket(data) {
    io.emit('chatroom', data)
}

function init(server) {
    io = Socket(server)
    emitter.addListener('sendMessage', sendMessageSocket)

    io.on('connection', socket => {
        console.warn(`new connection: ${socket.id}`)

        socket.on('disconnect', reason => {
            console.warn(`${socket.id} disconnected because: ${reason}`)

            socket.disconnect()
        })
    })
}
module.exports = init

