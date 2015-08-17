/*
 * 话务提供的接口方法，提供业务调用
 */
Teller.Fn = new (function() {
	var phoneEvent = null;
	var tellerEvt = null;
	var logger = null;
	var jsUrl = "teller/webrtc/TellerFn.js";
	var audio = null;
	var rtc = null;
	var me =  this;
	var remoteVideo = null;
	var localVideo = null;
	var Ext  = null;
	
	this.init = function() {
		if(!logger) logger = top.Fn.serverLog;
		logger.debug('Teller.Fn.init', jsUrl);
		if (!rtc) rtc = SkyRTC();
		if (!audio)  audio = Util.Audio;
		if (!phoneEvent) phoneEvent = top.Fn.PhoneEvent;
		if (!tellerEvt) tellerEvt = Teller.Evt;
		if (!Ext) Ext = top.Ext;
		
			
//	  try {
			// 成功创建WebSocket连接
			rtc.on("socket_opened", function(socket) {
				logger.log("socket_opened=" + socket,jsUrl);
				rtc.createStream({
					"video" : true,
					"audio" : true
				});
			});
			
			// 成功创建WebSocket连接
			rtc.on("connected", function(socket) {
				logger.log("connected=" + socket,jsUrl);
			});
			
			// 创建本地视频流成功
			rtc.on("stream_created", function(stream) {
//				var newVideo = document.createElement("video"),
//			        id = "localVideo";
//			    newVideo.setAttribute("autoplay", "autoplay");
//			    newVideo.setAttribute("id", id);
//			    var parentNode = document.getElementById('localVideoDiv');
//			    parentNode.appendChild(newVideo);
				//Ext.getCmp('localWindow').show();
				if(!localVideo)localVideo = top.document.getElementById('localVideoDiv');
			    rtc.attachStream(localVideo, stream);
			    me.loginSucc();
			    
			});
			// 创建本地视频流失败
			rtc.on("stream_create_error", function() {
				alert("create stream failed!");
			});
			
			
			/********************************************************************/
			
			//接收到文字信息
			rtc.on('data_channel_message', this.msgArrived);
			//接收振铃
			rtc.on('alerting',this.alerting);
			
			//接收到其他用户的视频流
			  rtc.on('pc_add_stream', function(stream) {
//				  var newVideo = document.createElement("video"),
//			        id = "remoteVideo";
//			    newVideo.setAttribute("autoplay", "autoplay");
//			    newVideo.setAttribute("id", id);
//			    var parentNode = document.getElementById('remoteVideoDiv');
//			    parentNode.appendChild(newVideo);
				if(!remoteVideo)remoteVideo = top.document.getElementById('remoteVideoDiv');
			    rtc.attachStream(remoteVideo, stream);
			    Ext.getCmp('localWindow').show();
			    Ext.getCmp('remoteWindow').show();
			    me.talkingEvt();
			  });
			  
			  //离开会议
			  rtc.on('remove_peer', this.releaseEvt);
			  rtc.on('msgArrive', this.msgArrive);
			
			me.createVideoWindow();
			me.createRemoteWindow();
			phoneEvent.init(me);
//		} catch (e) {
//			tellerEvt.tellerOcxFailed(e.name+";"+e.message);
//		}
		
	};
	
	
	
	this.createVideoWindow = function(){
		var Ext  = top.Ext;
		
		Ext.create('Ext.window.Window', {
		    title: 'local Video',
		    id:'localWindow',
		    height: 300,
		    width: 380,
		    x:800,
		    y:200,
		    layout: 'fit',
		    resizable:false,
		    closable:false,
		    closeAction:'hide',
		    constrain:true,
		    renderTo:Ext.getBody(), 
		    html:'<video id="localVideoDiv" autoplay width=100% height=100%></video>'
		}).show();
		Ext.getCmp('localWindow').hide();
	};
	
	this.createRemoteWindow = function(){
		var Ext  = top.Ext;
		
		Ext.create('Ext.window.Window', {
		    title: 'remoteVideo',
		    id:'remoteWindow',
		    height: 300,
		    width: 380,
		    x:800,
		    y:400,
		    layout: 'fit',
		    resizable:false,
		    closable:false,
		    closeAction:'hide',
		    constrain:true,
		    renderTo:Ext.getBody(), 
		    html:'<video id="remoteVideoDiv" width=100% height=100%></video>'
		}).show();
		Ext.getCmp('remoteWindow').hide();
	};

	/***************************************************************************
	 * 初始化
	 **************************************************************************/
	/**
	 * 登陆CCMS 参数:agentNo:柜员对应平台工号 password:柜员对应平台工号密码
	 */
	this.login = function(agentNo, password) {
		logger.debug("login:agentNo=" + agentNo, jsUrl);
		rtc.connect(Teller.websocketurl);
//		rtc.connect("ws:" + window.location.href.substring(window.location.protocol.length).split(':')[0]+":3000");
//		rtc.connect("ws:" + window.location.href.substring(window.location.protocol.length).split('#')[0], window.location.hash.slice(1));
	}
	
	// 柜员登录成功事件
	this.loginSucc = function() {
		logger.info("TellerEvt.js loginSucc:");
		phoneEvent.loginSucc();
		setTimeout(function(){
			phoneEvent.idle();
		},500);
	}
	/**
	 * 登出
	 */
	this.logout = function() {
	}

	/**
	 * 柜员强制登出
	 */
	this.forceLogout = function() {
	}

	/***************************************************************************
	 * 状态控制
	 **************************************************************************/
	/**
	 * 柜员示忙
	 */
	this.busy = function() {
	}	

	/**
	 * 柜员示闲
	 */
	this.idle = function() {
	}

	/***************************************************************************
	 * 呼叫控制
	 **************************************************************************/
	/**
	 * 呼叫
	 */
	this.call = function() {
		logger.debug("TellerFn.js TellerCall", jsUrl);
		rtc.join();
		setTimeout(function(){
			rtc.call();
		},1000);
		logger.debug("TellerFn.js TellerCall, result:", jsUrl);
	}
	
	/**
	 * 应答
	 */
	this.answer = function() {
		logger.debug("TellerFn.js TellerAnswer", jsUrl);
		audio.stop();
		rtc.join();
		logger.debug("TellerFn.js TellerAnswer, result:" + result, jsUrl);
	}
	
	/**
	 * 应答
	 */
	this.talkingEvt = function() {
		// 呼叫建立事件
		logger.info('TellerEvt.js talking：');
		phoneEvent.talking(Util.DateUtil.getTime(),"vtm101");
	}

	/**
	 * 释放
	 */
	this.release = function() {
		logger.debug("TellerReleaseCall：", jsUrl);
		audio.stop();
		// 创建本地视频流
		rtc.leave();
		logger.debug("TellerReleaseCall result:" + result, jsUrl);
	}
	
	
	/**
	 * 释放
	 */
	this.releaseEvt = function(socketId) {
		logger.debug("releaseEvt：", jsUrl);
		audio.stop();
		// 创建本地视频流
		//rtc.leave();
//		  var parent = document.getElementById("remoteVideoDiv");
//		    var childs =parent.childNodes;
//	         for(var i=childs.length;i--;i>0){
//	        	 parent.removeChild(childs[i]);
//	         }
	    Ext.getCmp('localWindow').hide();
	    Ext.getCmp('remoteWindow').hide();
	    setTimeout(function(){
			phoneEvent.idle();
		},500);
	}
	

	/**
	 * 保持
	 */
	this.hold = function() {
		logger.debug("TellerHold", jsUrl);
		logger.debug("TellerHold" + ("柜员保持结果为:" + result), jsUrl);
	}

	/**
	 * 取消保持
	 */
	this.unHold = function() {
		logger.debug("TellerUnHold", jsUrl);
		logger.debug("TellerUnHold" + (" 柜员取保持结果为:" + result), jsUrl);
	}

	/**
	 * 静音
	 */
	this.mute = function() {
		logger.debug("TellerMute", jsUrl);
		logger.debug("TellerMute" + (" 柜员静音结果为:" + result), jsUrl);
	}

	/**
	 * 取消静音
	 */
	this.unMute = function() {
		logger.debug("TellerUnMute", jsUrl);
		logger.debug("TellerUnMute result:" + result, jsUrl);
	}

	/**
	 * VTA发送消息给VTM 参数 sendMsg:消息内容
	 */
	this.sendMsgToTerm = function(msg) {
		logger.debug("TellerFn.js sendMsgToTerm:" + msg, jsUrl);
		//广播消息
	    rtc.sendMsg(msg);
		logger.debug("TellerFn.js sendMsgToTerm:" + result, jsUrl);
	}
	
	/*****************************************/
	// 2.呼叫振铃事件
	this.alerting = function(socketId) {
		logger.debug('TellerEvt.js alerting event:'+socketId, jsUrl);
		audio.start();
		if(null != socketId){
			phoneEvent.alerting(socketId,"vtmnotest");
		}else{
			logger.error("alerting event info is null or the json format is bad, event info=" + socketId, jsUrl);
			alert("alerting event info is null or the json format is bad, event info=" + socketId);
		}
	}
	
	// 1.数据到达事件
	this.msgArrive = function( socketId, message) {
		logger.debug('TellerEvt.js msgArrived event, message :' + message, jsUrl);
//		var msgJson = json.decode(message);
		if(null != message){
			phoneEvent.msgArrived(message);
		}else{
			logger.error('Ocx msgArrived event, message format is not json :' + message, jsUrl);
		}
	}
	
	/************************************************************/
	//拍照 fileName 保存到本地的文件路径
	this.takePhoto =  function(fileName, canvas){
		if(!localVideo)return false;
	    drawImage(canvas.getContext("2d"), localVideo, 0, 0, canvas.width, canvas.height);
		logger.debug('TellerEvt.js takePhoto event, fileName :'+fileName, jsUrl);
	}
	
})();
