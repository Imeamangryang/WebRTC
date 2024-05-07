// import express from 'express';
// import expressWs from 'express-ws';
// import http from 'http';
// import stun from 'stun';
const express = require('express');
const expressWs = require('express-ws');
const http = require('http');
const path = require('path');
const stun = require('stun');

// init http(s) server
//
const app = express();
app.use(express.static('static'));
app.use('/node_modules', express.static(path.join(__dirname, 'node_modules')))

const httpServer = http.createServer(app);

httpServer.listen(3000, () => { console.log(`HTTP server listening on :${3000}`) })

expressWs(app, httpServer);

// init STUN server
//
const server = stun.createServer({ type: 'udp4' })
server.listen(3478, null, () => { console.log(`STUN server listening on 0.0.0.0:3478`) })

server.on('bindingRequest', (req, rinfo) => {
    console.log(`Received STUN binding request from ${rinfo.address}:${rinfo.port}`)
    const response = stun.createMessage();
    response.setType(stun.constants.STUN_BINDING_RESPONSE);
    response.setTransactionID(req.transactionId);
    // respond with IP and port
    response.addAddress(rinfo.address, rinfo.port)
    server.send(response, rinfo.port, rinfo.address);
});


// peers list
//
var peers = {}

// signaling channel
//
app.ws('/signal', (ws, req) => {
    const name = req.query.name;
    const type = req.query.type;
    const ip = ws._socket.remoteAddress

    var reject = false
    // reject empty names
    if (name == null || name == '') {
        reject = 'name not specified'
        ws.close(1000, reject)
    }
    // init peer object
    else if (peers[name] == undefined) {
        peers[name] = {}
        peers[name][type] = ws
    }
    // reject multiple endpoints
    else if (peers[name][type] != undefined && peers[name][type]._socket.remoteAddress != ip) {
        reject = 'already registered'
        ws.close(1000, reject)
    }
    // update peers list
    else {
        peers[name][type] = ws
    }

    // reject or accept
    if (reject != false) {
        console.log(`[${name}] (${type}) REJECTED: ${reject}`);
        return
    }
    console.log(`[${name}] (${type}) CONNECTED (${ip})`);

    // clear lastOnline on peer connection
    delete peers[name].lastOnline

    // if both host and client are online, tells them to start peer connection
    if (peers[name].host != undefined && peers[name].client != undefined) {
        console.log(`[${name}] Telling host and client to start peer connection`)
        peers[name].host.send(JSON.stringify({ type: 'start' }))
        peers[name].client.send(JSON.stringify({ type: 'start' }))
    }

    // handle SDP & ICE messages
    ws.on('message', (e) => {
        try {
            const msg = JSON.parse(e)
            console.log(`[${name}] (${type}): Received ${msg.type}`)

            // host SDP offer -> client
            if (msg.type == 'offer') {
                peers[name].client.send(JSON.stringify(msg))
            }
            // client SDP answer -> host
            else if (msg.type == 'answer') {
                peers[name].host.send(JSON.stringify(msg))
            }
            // exchange ICE candidates
            else if (msg.type == 'candidate') {
                peers[name][type == 'host' ? 'client' : 'host'].send(JSON.stringify(msg))
            }
        } catch (error) {
            console.warn(error)
        }
    });

    ws.on('close', () => {
        console.log(`[${name}] (${type}) DISCONNECTED`);
        if (peers[name][type] == ws) delete peers[name][type]
        // set lastOnline timestamp if both peers have been disconnected
        if (Object.keys(peers[name]).length == 0) {
            let ts = Date.now()
            console.log(`[${name}] Last online: ${ts}`)
            peers[name].lastOnline = ts
        }
    });
});

// WebSocket heartbeat
//
setInterval(() => {
    try {
        for (let name in peers) {
            for (let type in peers[name]) {
                if (peers[name][type].send instanceof Function) {
                    peers[name][type].send(JSON.stringify({ type: 'heartbeat' }))
                }
            }
        }
    } catch (error) {
        console.warn(error)
    }
}, 5000);

// get peers list
//
app.get('/peers', (req, res) => {
    result = {}
    for (let name in peers) {
        result[name] = {}
        for (let type in peers[name]) {
            result[name][type] = typeof (peers[name][type]) == 'object' ? true : peers[name][type]
        }
    }
    res.send(JSON.stringify(result));
})

// generate peer code
//
app.get('/peerCode', (req, res) => {
    function randInt(length) {
        return Math.floor(Math.random() * (10 ** length - 10 ** (length - 1)) + 10 ** (length - 1))
    }
    var randomCode = 0
    while (randomCode == 0 || peers[randomCode.toString()] != undefined) {
        randomCode = randInt(4)
    }
    res.send(randomCode.toString())
})
