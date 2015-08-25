/**
 * 统一处理链接
 */
var util = require("util"),
	events = require('events'),
	UUID = require('node-uuid'),
	logger = require('./log/logger'),
	WebSocketServer = require('ws').Server;

/**
 * 创建wsserver
 * @param port 监听端口
 */
function newWSServer(port){
	if (typeof port != 'number') 
		throw new Error("new WebSocketServer error，listenPort is not number！ ");
	return new WebSocketServer({
					port: port
				});
};

var connections = function(port){
	var _me = this;
	events.EventEmitter.call(_me);
	
	//链接到服务端相关客户端
	_me.clientsArr = []; 
	
	var wsServer = newWSServer(port);
	
	//添加监听
	wsServer.on('connection', function(socket) {
		_me.addClient(socket);
		
		//为新连接绑定事件处理器
		socket.on('message', function(data) {
			_me.msgArrived(data, socket);
		});
		
		//连接关闭后从SkyRTC实例中移除连接，并通知其他连接
		socket.on('close', function() {
			_me.removeClient(socket);
		});
	});
	
	wsServer.on("error", function(e){
		logger.error("wsSockert error", e);
	});
	
};

/**
 * 继承
 */
util.inherits(connections, events.EventEmitter);

/**
 * 增加客户端
 */
connections.prototype.addClient = function(socket) {
	var _me = this;
	socket.id = UUID.v4();
	_me.clientsArr.push(socket);
	
	that.emit('addClient', socket);
};

/**
 * 客户端发送消息到服务端
 */
connections.prototype.msgArrived = function(data, socket) {
	var _me = this;
	_me.emit("msgArrived", socket, data);
};

/**
 * 删除客户端
 */
connections.prototype.removeClient = function(socket) {
	var _me = this;
	var i = _me.clientsArr.indexOf(socket);
	_me.clientsArr.splice(i, 1);
	_me.emit("removeClient", socket);
};


connections.prototype.sendMessage = function(msg, fromClientId, toClientIds) {
	var i, curClient;
	try {
		for (i = this.clientsArr.length; i--;) {
			curClient = this.clientsArr[i];
			if (socketId === curClient.id) {
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

