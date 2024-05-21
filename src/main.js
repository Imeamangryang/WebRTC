import WebSR from "@websr/websr"

// STUN server
//
const stun_address = `stun:${window.location.hostname}`


// UI
//
const consoleEl = document.getElementById('console')
const videoEl = document.getElementById('videoPreview')
const codecPreferences = document.getElementById('codec')

export function printMsg(msg, type = null) {
    var msgEl = document.createElement('p')
    if (typeof (msg) != 'string') {
        msgEl.innerText = JSON.stringify(msg, null, 2)
    } else {
        msgEl.innerText = msg
    }
    if (type != null) msgEl.classList.add(type)
    consoleEl.appendChild(msgEl)
    consoleEl.scrollTop = consoleEl.scrollHeight
}

export async function drawVideoOnCanvas() {
    // 비디오의 너비 및 높이를 캔버스에 맞게 설정
    const dpr = window.devicePixelRatio;

    const canvas = document.getElementById('canvas')
    canvas.width = videoEl.clientWidth * dpr;
    canvas.height = videoEl.clientHeight * dpr;

    const srcanvas = document.getElementById('sr_video')
    srcanvas.width = videoEl.clientWidth * dpr;
    srcanvas.height = videoEl.clientHeight * dpr;

    const gpu = await WebSR.initWebGPU();
    if(!gpu) printMsg("Browser/device doesn't support WebGPU");
    
    const websr = new WebSR({
        source: videoEl,
        network_name: "anime4k/cnn-2x-l",
        weights: await (await fetch('./cnn-2x-l.json')).json(), //found in weights/anime4k folder
        gpu,
        canvas: srcanvas
    });

    await websr.start();

    // 캔버스 컨텍스트 가져오기
    const ctx = canvas.getContext('2d');

    // 캔버스에 비디오 프레임을 그리는 루프 설정
    function drawFrame() {
        // 비디오 프레임을 캔버스에 그림
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
        // ctx.drawImage(canvas, 0, 0, canvas.width * 0.5, canvas.height * 0.5);
        // ctx.drawImage(canvas, 0, 0, canvas.width * 0.5, canvas.height * 0.5, 0, 0, srcanvas.width, srcanvas.height);

        // 다음 프레임을 그리기 위해 requestAnimationFrame 호출
        requestAnimationFrame(drawFrame);
    }

    // 비디오를 그리는 루프 시작
    drawFrame();
}

export function initComparisons() {
    var x, i;
    /* Find all elements with an "overlay" class: */
    x = document.getElementsByClassName("img-comp-overlay");
    for (i = 0; i < x.length; i++) {
      /* Once for each "overlay" element:
      pass the "overlay" element as a parameter when executing the compareImages function: */
      compareImages(x[i]);
    }
    function compareImages(img) {
      var slider, img, clicked = 0, w, h;
      /* Get the width and height of the img element */
      w = img.offsetWidth;
      h = img.offsetHeight;
      /* Set the width of the img element to 50%: */
      img.style.width = (w / 2) + "px";
      /* Create slider: */
      slider = document.createElement("DIV");
      slider.setAttribute("class", "img-comp-slider");
      /* Insert slider */
      img.parentElement.insertBefore(slider, img);
      /* Position the slider in the middle: */
      slider.style.top = (h / 2) - (slider.offsetHeight / 2) + "px";
      slider.style.left = (w / 2) - (slider.offsetWidth / 2) + "px";
      /* Execute a function when the mouse button is pressed: */
      slider.addEventListener("mousedown", slideReady);
      /* And another function when the mouse button is released: */
      window.addEventListener("mouseup", slideFinish);
      /* Or touched (for touch screens: */
      slider.addEventListener("touchstart", slideReady);
       /* And released (for touch screens: */
      window.addEventListener("touchend", slideFinish);
      function slideReady(e) {
        /* Prevent any other actions that may occur when moving over the image: */
        e.preventDefault();
        /* The slider is now clicked and ready to move: */
        clicked = 1;
        /* Execute a function when the slider is moved: */
        window.addEventListener("mousemove", slideMove);
        window.addEventListener("touchmove", slideMove);
      }
      function slideFinish() {
        /* The slider is no longer clicked: */
        clicked = 0;
      }
      function slideMove(e) {
        var pos;
        /* If the slider is no longer clicked, exit this function: */
        if (clicked == 0) return false;
        /* Get the cursor's x position: */
        pos = getCursorPos(e)
        /* Prevent the slider from being positioned outside the image: */
        if (pos < 0) pos = 0;
        if (pos > w) pos = w;
        /* Execute a function that will resize the overlay image according to the cursor: */
        slide(pos);
      }
      function getCursorPos(e) {
        var a, x = 0;
        e = (e.changedTouches) ? e.changedTouches[0] : e;
        /* Get the x positions of the image: */
        a = img.getBoundingClientRect();
        /* Calculate the cursor's x coordinate, relative to the image: */
        x = e.pageX - a.left;
        /* Consider any page scrolling: */
        x = x - window.pageXOffset;
        return x;
      }
      function slide(x) {
        /* Resize the image: */
        img.style.width = x + "px";
        /* Position the slider: */
        slider.style.left = img.offsetWidth - (slider.offsetWidth / 2) + "px";
      }
    }
  }

export function playVideo(stream) {
    if (videoEl.srcObject === stream) return

    videoEl.srcObject = stream;
    videoEl.play()

    if (window.stream) window.stream.getTracks().forEach(track => track.stop())
    window.stream = stream

    printMsg('Stream started', 'success');
    printMsg(stream.getVideoTracks()[0].getSettings())
    try {
        printMsg(stream.getAudioTracks()[0].getSettings())
    } catch (error) {
        printMsg('Audio track not found', 'warn')
    }
}

consoleEl.onclick = (e) => {
    if (e.target.nodeName == 'P') {
        window.getSelection().selectAllChildren(e.target)
        navigator.clipboard.writeText(e.target.innerText)
    }
}


// WebSocket
//
export function getWsAddress() {
    var l = window.location;
    return ((l.protocol == "https:") ? "wss://" : "ws://") + l.host
}

export function initSignal(name, type) {
    var socket = new WebSocket(`${getWsAddress()}/signal?name=${name}&type=${type}`);
    if (window.socket) {
        if (window.socket.readyState == WebSocket.CONNECTING) {
            window.socket.onclose = () => {
                printMsg(`Closing a CONNECTING websocket`, 'warn')
            }
        }
        window.socket.close(1000, 'new connection requested')
    }
    window.socket = socket

    socket.onopen = () => {
        printMsg('Websocket connection established', 'success')
        printMsg(`Waiting for ${type == 'host' ? 'client' : 'host'}...`)
    }

    socket.onmessage = (e) => {
        try {
            var msg = JSON.parse(e.data)

            if (msg.type == 'start') {
                startPeer()
            } else if (msg.type == 'offer') {
                onReceiveSDPOffer(msg.data)
            } else if (msg.type == 'answer') {
                onReceiveSDPAnswer(msg.data)
            } else if (msg.type == 'candidate') {
                onReceiveICECandidate(msg.data)
            } else if (msg.type == 'heartbeat') {
                //logToConsole('Heartbeat received')
            }

        } catch (error) {
            printMsg(`Error handling message from server:\n${error}`)
        }
    }

    socket.onclose = (e) => {
        printMsg(`Websocket connection closed (${e.code}), reason: ${e.reason}`, 'error')
        if (!e.wasClean) {
            printMsg('Attempting to reconnect...', 'error')
            setTimeout(() => {
                initSignal(name, type)
            }, 1000)
        }
    }
}

// WebSocket heartbeat
setInterval(() => {
    try {
        if (window.socket.readyState == WebSocket.OPEN) {
            window.socket.send(JSON.stringify({ type: 'heartbeat' }))
        }
    } catch (error) { }
}, 5000);


// RTC event handlers
//
export function initPeerConnection() {
    printMsg("Initiating peer connection")
    try {
        var peerConnection = new RTCPeerConnection({
            iceServers: [{ urls: stun_address }],
        });
    } catch (error) {
        printMsg("Your browser doesn't support WebRTC (RTCPeerConnection)", 'error')
        return
    }
    if (window.peerConnection) window.peerConnection.close()
    window.peerConnection = peerConnection

    peerConnection.onnegotiationneeded = async () => {
        const offer = await peerConnection.createOffer();
        printMsg('Created SDP offer:', 'warn')
        printMsg(offer, 'warn')
        peerConnection.setLocalDescription(offer)

        socket.send(JSON.stringify({
            type: 'offer',
            data: offer
        }))
        printMsg('SDP offer sent')
    }

    peerConnection.onicecandidate = (e) => {
        if (e.candidate) {
            printMsg('Created ICE candidate:', 'warn')
            printMsg(e.candidate, 'warn')

            socket.send(JSON.stringify({
                type: 'candidate',
                data: e.candidate
            }))
            printMsg('ICE candidate sent')
        }
    };

    peerConnection.oniceconnectionstatechange = (e) => {
        var state = e.currentTarget.iceConnectionState
        printMsg(`Connection state changed: ${state}`, state == 'connected' ? 'success' : 'warn')
    }

    peerConnection.onicegatheringstatechange = (e) => {
        printMsg(`ICE gathering state: ${e.target.iceGatheringState}`)
    }
}

export async function onReceiveSDPOffer(sdp) {
    printMsg('Received SDP offer:', 'success')
    printMsg(sdp, 'success')
    await peerConnection.setRemoteDescription(sdp);

    // change preferred codec before creating SDP answer
    setRecvCodec()

    const answer = await peerConnection.createAnswer();
    printMsg('Created SDP answer:', 'warn')
    printMsg(answer, 'warn')
    await peerConnection.setLocalDescription(answer);

    socket.send(JSON.stringify({
        type: 'answer',
        data: answer
    }))
    printMsg('SDP answer sent')
}

export async function onReceiveSDPAnswer(sdp) {
    printMsg('Received SDP answer:', 'success')
    printMsg(sdp, 'success')

    // modify SDP to achieve higher bitrate (Chrome only)
    printMsg('Modified SDP:')
    sdp.sdp = sdp.sdp.replace(/(m=video.*\r\n)/g, `$1b=AS:${parseInt(document.getElementById('bitrate').value)}\r\n`);
    printMsg(sdp)

    await peerConnection.setRemoteDescription(sdp);
    // actual codec after negotiation
    printPeerCodec()
}

export function onReceiveICECandidate(candidate) {
    printMsg('Received remote ICE candidate:', 'success')
    printMsg(candidate, 'success')
    peerConnection.addIceCandidate(candidate)
}


// Misc
//
export function printPeerCodec() {
    peerConnection.getStats().then((stats) => {
        stats.forEach((stat) => {
            if (stat.type == 'codec') {
                printMsg(`Using codec: ${stat.mimeType} ${stat.sdpFmtpLine || ''}`)
            }
        })
    })
}

export function getRecvCodec() {
    const { codecs } = RTCRtpReceiver.getCapabilities('video');
    codecs.forEach(codec => {
        if (['video/red', 'video/ulpfec', 'video/rtx'].includes(codec.mimeType)) {
            return;
        }
        const codecStr = (codec.mimeType + ' ' + (codec.sdpFmtpLine || '')).trim()
        const option = document.createElement('option');
        option.value = codecStr;
        option.innerText = option.value;
        codecPreferences.appendChild(option);

    });
    codecPreferences.disabled = false;
}

export function setRecvCodec() {
    try {
        const preferredCodec = codecPreferences.value
        if (preferredCodec !== '') {
            const [mimeType, sdpFmtpLine] = preferredCodec.split(' ');
            const { codecs } = RTCRtpReceiver.getCapabilities('video');
            const selectedCodecIndex = codecs.findIndex(c => c.mimeType === mimeType && c.sdpFmtpLine === sdpFmtpLine);
            const selectedCodec = codecs[selectedCodecIndex];
            codecs.splice(selectedCodecIndex, 1);
            codecs.unshift(selectedCodec);
            peerConnection.getTransceivers().forEach((transceiver) => {
                if (transceiver.receiver.track.kind == 'video') transceiver.setCodecPreferences(codecs);
            })
        }
    } catch (error) {
        printMsg(`Failed to set preferred codec: ${error}`, 'warn')
    }
}
