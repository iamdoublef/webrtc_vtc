var WebSocketServer = require('ws').Server;
var UUID = require('node-uuid');
var events = require('events');
var util = require('util');
var message = new (require('./message'))();
var errorCb = function(rtc) {
	return function(error) {
		if (error) {
			rtc.emit("error", error);
		}
	};
};

function SkyRTC() {
	this.rooms = {};
	
	this.on('__call', function(data, socket) {
		console.log("__call:"+socket.id);
		var msg = message.createEventMsg("event","_alerting",{
			"socketId": socket.id
		});
		
		this.sendMsgToOthers(msg, socket.id, errorCb);
		this.emit('new_call', socket);
	});
	
	
	this.on('__join', function(data, socket) {
		console.log("__join: count:"+this.sockets.length+'socketId:'+socket.id);
		var ids = [],
			i, m,
			room = data.room || "__default",
			curSocket,
			curRoom;

		curRoom = this.rooms[room] = this.rooms[room] || [];
		
		for (i = 0, m = curRoom.length; i < m; i++) {
			curSocket = curRoom[i];
			if (curSocket.id === socket.id) {
				return;
			}
		}
		
		for (i = 0, m = curRoom.length; i < m; i++) {
			curSocket = curRoom[i];
			if (curSocket.id === socket.id) {
				continue;
			}
			ids.push(curSocket.id);
			
			var msg = message.createEventMsg("event","_new_peer",{
				"socketId": socket.id
			});
			
			curSocket.send(msg, errorCb);
		}

		curRoom.push(socket);
		socket.room = room;
		
		var msg = message.createEventMsg("event","_peers",{
			"connections": ids,
			"you": socket.id
		});

		socket.send(msg, errorCb);

		this.emit('new_peer', socket, room);
	});
	
	this.on('__leave', function(data, socket) {
		this.leaveRoom(data,socket);
	});
	
	this.on('__send_msg', function(data, socket){
		
		var msg = message.createEventMsg("event","_msg_arrive",{
			"socketId": socket.id,
			"msg":data.msg
		});
		
		this.sendMsgToOthers(msg,socket.id, errorCb);
	});

	this.on('__ice_candidate', function(data, socket) {
		var soc = this.getSocket(data.socketId);

		if (soc) {
			
			var msg = message.createEventMsg("event","_ice_candidate",{
				"label": data.label,
				"candidate": data.candidate,
				"socketId": socket.id
			});
			
			soc.send(msg, errorCb);

			this.emit('ice_candidate', socket, data);
		}
	});

	this.on('__offer', function(data, socket) {
		var soc = this.getSocket(data.socketId);

		if (soc) {
			var msg = message.createEventMsg("event","_offer",{
				"sdp": data.sdp,
				"socketId": socket.id
			});
			
			soc.send(msg, errorCb);
		}
		this.emit('offer', socket, data);
	});

	this.on('__answer', function(data, socket) {
		var soc = this.getSocket(data.socketId);
		if (soc) {
			var msg = message.createEventMsg("event","_answer",{
				"sdp": data.sdp,
				"socketId": socket.id
			});
			soc.send(msg, errorCb);
			this.emit('answer', socket, data);
		}
	});
}

util.inherits(SkyRTC, events.EventEmitter);

SkyRTC.prototype.addSocket = function(socket) {
	this.sockets.push(socket);
};

SkyRTC.prototype.removeSocket = function(socket) {
	var i = this.sockets.indexOf(socket),
		room = socket.room;
	this.sockets.splice(i, 1);
	//if (room) {
	if (room && this.rooms[room]) {
		//i = this.rooms[room].indexOf(socket);
		//this.rooms[room].splice(i, 1);
		//if (this.rooms[room].length === 0) {
			delete this.rooms[room];
		//}
	}
};

SkyRTC.prototype.broadcast = function(data, errorCb) {
	var i;
	for (i = this.sockets.length; i--;) {
		this.sockets[i].send(data, errorCb);
	}
};

SkyRTC.prototype.broadcastInRoom = function(room, data, errorCb) {
	var curRoom = this.rooms[room],
		i;
	if (curRoom) {
		for (i = curRoom.length; i--;) {
			curRoom[i].send(data, errorCb);
		}
	}
};

SkyRTC.prototype.sendMsgToOthers = function(msg, socketId, errorCb) {
	var i, curSocket;
	if (!this.sockets) {
		return;
	}
	try {
		for (i = this.sockets.length; i--;) {
			curSocket = this.sockets[i];
			if (socketId === curSocket.id) {
				continue;
			} else {
				curSocket.send(msg, errorCb);
				console.log(curSocket.id + ",sendmsgtoOthers:" + msg);
			}
		}
	} catch (e) {
		errorCb(e.name+";"+e.message);
	}
};

SkyRTC.prototype.getRooms = function() {
	var rooms = [],
		room;
	for (room in this.rooms) {
		rooms.push(room);
	}
	return rooms;
};

SkyRTC.prototype.getSocket = function(id) {
	var i,
		curSocket;
	if (!this.sockets) {
		return;
	}
	for (i = this.sockets.length; i--;) {
		curSocket = this.sockets[i];
		if (id === curSocket.id) {
			return curSocket;
		}
	}
	return;
};

SkyRTC.prototype.leaveRoom = function(data, socket) {
	var i, m,
	room = socket.room,
	curRoom,
	that = this;
	if (room && this.rooms[room]) {
		curRoom = that.rooms[room];
		try {
			for (i = curRoom.length; i--;) {
				//if (curRoom[i].id === socket.id) {
				//	continue;
				//}
				
				var msg = message.createEventMsg("event","_remove_peer",{
					"socketId": socket.id
				});
				
				curRoom[i].send(msg, errorCb);
			}
		} catch (e) {
			errorCb(e.name+";"+e.message);
		}
	}

	//if (room) {
	if (room && this.rooms[room]) {
		//i = this.rooms[room].indexOf(socket);
		//this.rooms[room].splice(i, 1);
		//if (this.rooms[room].length === 0) {
			delete this.rooms[room];
		//}
	}
	
	that.emit('remove_peer', socket.id, that);
};

SkyRTC.prototype.init = function(socket) {
	var that = this;
	socket.id = UUID.v4();
	that.addSocket(socket);
	//为新连接绑定事件处理器
	socket.on('message', function(data) {
		console.log('message arrived:'+data);
		var json = JSON.parse(data);
		if (json.eventName) {
			that.emit(json.eventName, json.data, socket);
		} else {
			that.emit("socket_message", socket, data);
		}
	});
	//连接关闭后从SkyRTC实例中移除连接，并通知其他连接
	socket.on('close', function() {
		var i, m,
			room = socket.room,
			curRoom;
		if (room) {
			curRoom = that.rooms[room];
			try {
				for (i = curRoom.length; i--;) {
					if (curRoom[i].id === socket.id) {
						continue;
					}
					
					var msg = message.createEventMsg("event","_remove_peer",{
						"socketId": socket.id
					});
					curRoom[i].send(msg, errorCb);
				}
			} catch (e) {
				errorCb(e.name+";"+e.message);
			}
		}

		that.removeSocket(socket);

		that.emit('remove_peer', socket.id, that);
	});
	that.emit('new_connect', socket);
};

module.exports.listen = function(server) {
	var SkyRTCServer;
	if (typeof server === 'number') {
		SkyRTCServer = new WebSocketServer({
			port: server
		});
	} else {
		SkyRTCServer = new WebSocketServer({
			server: server
		});
	}

	SkyRTCServer.rtc = new SkyRTC();
	errorCb = errorCb(SkyRTCServer.rtc);
	SkyRTCServer.on('connection', function(socket) {
		this.rtc.init(socket);
	});

	return SkyRTCServer;
};