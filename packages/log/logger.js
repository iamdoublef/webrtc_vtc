/**
 * 统一日志处理
 */

function formatLog(data, url){
	var output = new Date() +　" | " + data;
	if(url){
		output = output +　" | " + url; 
	}
	return output;
}

exports.log = exports.debug = exports.info = exports.warn = function(data, url){
	console.info(formatLog(data, url));
};


exports.error = function(data, error, url){
	console.error(formatLog(data, url));
	if(error) console.error(error);
};


