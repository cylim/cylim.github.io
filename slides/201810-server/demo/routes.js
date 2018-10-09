const express = require('express');

const router = express.Router();

// WARN:- Don't do this
const data = [{ message: 'Hi', name: 'Alice' }, { message: 'Hello', name: 'Bob' }]
// more routes: routes2
router
.get('/messages', (_, res) => {
    res.status(200).send(data)
})
.post('/message', (req, res) => {
    data.push(req.body)
    res.status(200).send({ success: true })
})

router.use('*', function (_, res) {
    res.status(400).send({
        code: 'E_API_NOT_AVAILABLE',
        message: 'APIs Not Available.'
    })
});

module.exports = router;
