var SkyRTC = function() {
    var PeerConnection = (window.PeerConnection || window.webkitPeerConnection00 || window.webkitRTCPeerConnection || window.mozRTCPeerConnection|| window.RTCPeerConnection);
    var URL = (window.URL || window.webkitURL || window.msURL || window.oURL);
    var getUserMedia = (navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia);
    var nativeRTCIceCandidate = (window.mozRTCIceCandidate || window.RTCIceCandidate);
    var nativeRTCSessionDescription = (window.mozRTCSessionDescription || window.RTCSessionDescription); // order is very important: "RTCSessionDescription" defined in Nighly but useless
    var moz = !!navigator.mozGetUserMedia;
    var iceServer =   {
        "iceServers": [{
            "url": "stun:stun.l.google.com:19302"
        }]
    };
    var packetSize = 1000;

    /**********************************************************/
    /*                                                        */
    /*                       事件处理器                       */
    /*                                                        */
    /**********************************************************/
    function EventEmitter() {
        this.events = {};
    }
    //绑定事件函数
    EventEmitter.prototype.on = function(eventName, callback) {
        this.events[eventName] = this.events[eventName] || [];
        this.events[eventName].push(callback);
    };
    //触发事件函数
    EventEmitter.prototype.emit = function(eventName, _) {
        var events = this.events[eventName],
            args = Array.prototype.slice.call(arguments, 1),
            i, m;

        if (!events) {
            return;
        }
        for (i = 0, m = events.length; i < m; i++) {
            events[i].apply(null, args);
        }
    };


    /**********************************************************/
    /*                                                        */
    /*                   流及信道建立部分                     */
    /*                                                        */
    /**********************************************************/


    /*******************基础部分*********************/
    function skyrtc() {
        //本地media stream
        this.localMediaStream = null;
        //所在房间
        this.room = "";
        //接收文件时用于暂存接收文件
        this.fileData = {};
        //本地WebSocket连接
        this.socket = null;
        //本地socket的id，由后台服务器创建
        this.me = null;
        //保存所有与本地相连的peer connection， 键为socket id，值为PeerConnection类型
        this.peerConnections = {};
        //保存所有与本地连接的socket的id
        this.connections = [];
        //初始时需要构建链接的数目
        this.numStreams = 0;
        //初始时已经连接的数目
        this.initializedStreams = 0;
        //保存所有的data channel，键为socket id，值通过PeerConnection实例的createChannel创建
        this.dataChannels = {};
        //保存所有发文件的data channel及其发文件状态
        this.fileChannels = {};
        //保存所有接受到的文件
        this.receiveFiles = {};
    }
    //继承自事件处理器，提供绑定事件和触发事件的功能
    skyrtc.prototype = new EventEmitter();


    /*************************服务器连接部分***************************/


    //本地连接信道，信道为websocket
    skyrtc.prototype.connect = function(server) {
        var socket,
            that = this;
        
        socket = this.socket = new WebSocket(server);
        socket.onopen = function() {
            Logger.log("socket_opened_event");
            that.emit("socket_opened", socket);
        };

        socket.onmessage = function(message) {
        	 Logger.log("socket_receive_message:" + message.data);
            var json = JSON.parse(message.data);
            if (json.eventName) {
                that.emit(json.eventName, json.data);
            } else {
                that.emit("socket_receive_message", socket, json);
            }
        };

        socket.onerror = function(error) {
        	Logger.log("onerror:"+error);
            that.emit("socket_error", error, socket);
        };

        socket.onclose = function(data) {
        	Logger.log("socket.onclose:"+data);
            that.localMediaStream.close();
            var pcs = that.peerConnections;
            for (i = pcs.length; i--;) {
                that.closePeerConnection(pcs[i]);
                pcs[i] = null;
            }
            that.peerConnections = [];
//            that.dataChannels = {};
//            that.fileChannels = {};
            that.connections = [];
            that.emit('socket_closed', socket);
        };

        this.on('_peers', function(data) {
        	Logger.log("socket._peers:"+data.connections);
            //获取所有服务器上的
            that.connections = data.connections;
            that.me = data.you;
            that.createPeerConnections();
            setTimeout(function(){
            	that.addStreams();
            	that.emit("get_peers", that.connections);
//              that.emit('connected', socket);
            	if(that.connections.length > 0) setTimeout(function(){that.sendOffers();}, 1000);
            },1000);
        });

        this.on("_ice_candidate", function(data) {
        	try{
        		var candidate = new nativeRTCIceCandidate(data.candidate);
//        			new nativeRTCIceCandidate({
//        				      sdpMLineIndex: data.label,
//        				      candidate: data.candidate
//        				    });
        	}catch(e){
        		Logger.log("new nativeRTCIceCandidate error ");
        		return;
        	}
            var pc = that.peerConnections[data.socketId];
            pc.addIceCandidate(candidate,
                    function() { Logger.log("socket.addIceCandidate success socketId:"+data.socketId);},
                    function(err) { Logger.log("socket.addIceCandidate error:"+err); });
            that.emit('get_ice_candidate', candidate);
        });

        this.on('_new_peer', function(data) {
            that.connections.push(data.socketId);
            var pc = that.createPeerConnection(data.socketId),
                i, m;
            setTimeout(function(){
            	Logger.log("addStream");
            	pc.addStream(that.localMediaStream);
            	that.emit('new_peer', data.socketId);
            },1000);
            
        });

        this.on('_remove_peer', function(data) {
//            var sendId;
            
        	var i, cs = that.connections;
            for (i = cs.length; i--;) {
            	if(cs[i] != that.me){
            		that.closePeerConnection(that.peerConnections[cs[i]]);
            		that.peerConnections[cs[i]] = null;
                    delete that.peerConnections[cs[i]];
                    delete that.connections[i];
            	}
            };
            
//            that.closePeerConnection(that.peerConnections[data.socketId]);
//            delete that.peerConnections[data.socketId];
//            delete that.dataChannels[data.socketId];
//            for (sendId in that.fileChannels[data.socketId]) {
//                that.emit("send_file_error", new Error("Connection has been closed"), data.socketId, sendId, that.fileChannels[data.socketId][sendId].file);
//            }
//            delete that.fileChannels[data.socketId];
            that.emit("remove_peer", data.socketId);
        });

        this.on('_offer', function(data) {
            that.receiveOffer(data.socketId, data.sdp);
            that.emit("get_offer", data);
        });

        this.on('_answer', function(data) {
            that.receiveAnswer(data.socketId, data.sdp);
            that.emit('get_answer', data);
        });
        
        this.on('_alerting', function(data) {
            that.emit('alerting', data.socketId);
        });

//        this.on('ready', function() {
//            
////            that.addDataChannels();
//            setTimeout(that.sendOffers,1000);
//        });
        this.on('_leaveSuccess', function(data) {
            that.emit('rlease', data.socketId);
        })
        
        this.on('_msg_arrive', function(data) {
            that.emit('msgArrive', data.socketId, data.msg);
        })
    };
    
    //呼叫
    skyrtc.prototype.call = function(callNo){
    	 var that = this;
    	 that.socket.send(JSON.stringify({
             "eventName": "__call",
             "data": {
             }
         }));
    }
    
    //加入会议
    skyrtc.prototype.join = function(room){
    	 var that = this;
    	 room = room || "";
    	 that.socket.send(JSON.stringify({
             "eventName": "__join",
             "data": {
                 "room": room
             }
         }));
    }
    
    //离开会议
    skyrtc.prototype.leave = function(){
    	 var that = this;
    	 that.socket.send(JSON.stringify({
             "eventName": "__leave",
             "data": {}
         }));
    }
    
  //发送消息
    skyrtc.prototype.sendMsg = function(msg){
    	 var that = this;
    	 that.socket.send(JSON.stringify({
             "eventName": "__send_msg",
             "data": {
            	 "msg":msg
             }
         }));
    }


    /*************************流处理部分*******************************/


    //创建本地流
    skyrtc.prototype.createStream = function(options) {
        var that = this;

        options.video = !!options.video;
        options.audio = !!options.audio;

        if (getUserMedia) {
            this.numStreams++;
            getUserMedia.call(navigator, options, function(stream) {
                    that.localMediaStream = stream;
                    that.initializedStreams++;
                    that.emit("stream_created", stream);
                	Logger.log("skyrtc.prototype.createStream:stream_createdin,itializedStreams="+that.initializedStreams+";numStreams="+that.numStreams);
//                    if (that.initializedStreams === that.numStreams) {
//                        that.emit("ready");
//                    }
                },
                function(error) {
                    that.emit("stream_create_error", error);
                });
        } else {
            that.emit("stream_create_error", new Error('WebRTC is not yet supported in this browser.'));
        }
    };
    //将本地流添加到所有的PeerConnection实例中
    skyrtc.prototype.addStreams = function() {
        var i, m,
            stream,
            connection;
        for (connection in this.peerConnections) {
        	Logger.log("skyrtc.prototype.addStreams:connectionid"+connection);
            this.peerConnections[connection].addStream(this.localMediaStream);
            Logger.log("skyrtc.prototype.addStreams finish:connectionid"+connection);
        }
    };

    //将流绑定到video标签上用于输出
    skyrtc.prototype.attachStream = function(element, stream) {
        	Logger.log("skyrtc.prototype.attachStream:domid");
            attachMediaStream(element, stream);
    };

    /***********************信令交换部分*******************************/


    //向所有PeerConnection发送Offer类型信令
    skyrtc.prototype.sendOffers = function() {
    	Logger.log("skyrtc.prototype.sendOffers:");
        var i, m,
            pc,
            that = this,
            pcCreateOfferCbGen = function(pc, socketId) {
                return function(session_desc) {
                	Logger.log("createOffer success socketId:"+socketId+";session_desc");
                    pc.setLocalDescription(session_desc);
                    that.socket.send(JSON.stringify({
                        "eventName": "__offer",
                        "data": {
                            "sdp": session_desc.sdp,
                            "socketId": socketId
                        }
                    }));
                };
            },
            pcCreateOfferErrorCb = function(error) {
                Logger.log(error);
            };
        for (i = 0, m = this.connections.length; i < m; i++) {
            pc = this.peerConnections[this.connections[i]];
            pc.createOffer(pcCreateOfferCbGen(pc, this.connections[i]), pcCreateOfferErrorCb);
        }
    };

    //接收到Offer类型信令后作为回应返回answer类型信令
    skyrtc.prototype.receiveOffer = function(socketId, sdp) {
    	Logger.log("skyrtc.prototype.receiveOffer,socketId"+socketId+";sdp:");
//        var pc = this.peerConnections[socketId];
        this.sendAnswer(socketId, sdp);
    };

    //发送answer类型信令
    skyrtc.prototype.sendAnswer = function(socketId, sdp) {
    	Logger.log("skyrtc.prototype.sendAnswer,socketId"+socketId+";sdp:");
        var pc = this.peerConnections[socketId];
        var that = this;
        var offer = new RTCSessionDescription({
            type: 'offer',
            sdp: sdp
          });
        pc.setRemoteDescription(new nativeRTCSessionDescription(offer));
        pc.createAnswer(function(session_desc) {
        	Logger.log("createAnswer session_desc:")
            pc.setLocalDescription(session_desc);
            that.socket.send(JSON.stringify({
                "eventName": "__answer",
                "data": {
                    "socketId": socketId,
                    "sdp": session_desc.sdp
                }
            }));
        }, function(error) {
            Logger.log(error);
        });
    };

    //接收到answer类型信令后将对方的session描述写入PeerConnection中
    skyrtc.prototype.receiveAnswer = function(socketId, sdp) {
    	Logger.log("skyrtc.prototype.receiveAnswer,socketId"+socketId+";sdp:");
        var pc = this.peerConnections[socketId];
        var answer = new RTCSessionDescription({
            type: 'answer',
            sdp: sdp
          });
        pc.setRemoteDescription(new nativeRTCSessionDescription(answer));
    };


    /***********************点对点连接部分*****************************/


    //创建与其他用户连接的PeerConnections
    skyrtc.prototype.createPeerConnections = function() {
    	Logger.log("createPeerConnections");
        var i, m;
        for (i = 0, m = this.connections.length; i < m; i++) {
            this.createPeerConnection(this.connections[i]);
        }
        
        Logger.log("createPeerConnections finish！");
    };

    //创建单个PeerConnection
    skyrtc.prototype.createPeerConnection = function(socketId) {
    	Logger.log("createPeerConnection socketId:"+socketId);
        var that = this;
        var pc = new PeerConnection(iceServer);
        this.peerConnections[socketId] = pc;
        pc.onicecandidate = function(evt) {
        	Logger.log("onicecandidate socketId:"+socketId+";evt.candidate.candidate:"+evt.candidate.candidate );
            if (evt.candidate){
            	var msg = JSON.stringify({
                    "eventName": "__ice_candidate",
                    "data": {
                        "label": evt.candidate.sdpMLineIndex,
                        "candidate": evt.candidate.candidate,
                        "socketId": socketId
                    }
                });
                that.socket.send(msg);
            }
            that.emit("pc_get_ice_candidate", evt.candidate, socketId);
        };

        pc.onaddstream = function(evt) {
        	Logger.log("onaddstream");
            that.emit('pc_add_stream', evt.stream);
        };

        Logger.log("createPeerConnection finish socketId:"+socketId );
        return pc;
    };

    //关闭PeerConnection连接
    skyrtc.prototype.closePeerConnection = function(pc) {
        if (!pc) return;
        Logger.info('closePeerConnection');
        pc.close();
        pc = null;
    };


    return new skyrtc();
};