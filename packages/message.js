/**
 * 统一处理消息相关逻辑
 */
exports = module.exports =  function(){
	var me = this;
	
	/**
	 * 消息格式化
	 */
	me.createEventMsg = function(msgType, eventName ,data){
		var msgObject ={
			"msgType": msgType,
			"data": data
		};
		if(eventName){
			msgObject["eventName"] = eventName;
		};
		console.info("create msg ："+ JSON.stringify(msgObject));
		return JSON.stringify(msgObject);
	};
	
	/**
	 * 发送事件消息到某一客户端
	 */
//	me.sendEventToOneClient = function(eventName, data, fromSocketId, toSocketId){
//		
//		me.createEventMsg(eventName, data);
//		
//	};
//	
//	me.sendEventToOthers = function(eventName, data, fromSocketId){
//		
//	};
	
	
};

