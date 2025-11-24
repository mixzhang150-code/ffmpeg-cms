/**
 * 统一错误处理中间件
 * 提供全局错误捕获和格式化响应
 */

/**
 * 自定义错误类
 * @param {String} message - 错误消息
 * @param {Number} statusCode - HTTP状态码
 * @param {Boolean} isOperational - 是否为可操作错误
 */
class AppError extends Error {
    constructor(message, statusCode, isOperational = true) {
        super(message);
        this.statusCode = statusCode;
        this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
        this.isOperational = isOperational;
        
        // 捕获错误堆栈，但不包括构造函数调用
        Error.captureStackTrace(this, this.constructor);
    }
}

/**
 * 404错误处理中间件
 * @param {Object} req - Express请求对象
 * @param {Object} res - Express响应对象
 * @param {Function} next - 下一个中间件函数
 */
const notFoundHandler = (req, res, next) => {
    const error = new AppError(`无法找到 ${req.originalUrl} 路径`, 404);
    next(error);
};

/**
 * 开发环境错误处理器
 * @param {Error} err - 错误对象
 * @param {Object} req - Express请求对象
 * @param {Object} res - Express响应对象
 */
const devErrorHandler = (err, req, res) => {
    console.error('开发环境错误:', err);
    
    // 如果是API请求，返回JSON格式错误
    if (req.originalUrl.startsWith('/api/')) {
        return res.status(err.statusCode || 500).json({
            status: err.status || 'error',
            error: err,
            message: err.message,
            stack: err.stack
        });
    }
    
    // 否则渲染错误页面
    return res.status(err.statusCode || 500).render('error', {
        title: '错误',
        message: err.message || '服务器内部错误',
        error: err
    });
};

/**
 * 生产环境错误处理器
 * @param {Error} err - 错误对象
 * @param {Object} req - Express请求对象
 * @param {Object} res - Express响应对象
 */
const prodErrorHandler = (err, req, res) => {
    // 只记录可操作的错误
    if (err.isOperational) {
        // 如果是API请求，返回JSON格式错误
        if (req.originalUrl.startsWith('/api/')) {
            return res.status(err.statusCode).json({
                status: err.status,
                message: err.message
            });
        }
        
        // 否则渲染错误页面
        return res.status(err.statusCode).render('error', {
            title: '错误',
            message: err.message || '服务器内部错误'
        });
    }
    
    // 记录不可操作的错误（编程错误等）
    console.error('生产环境错误:', err);
    
    // 对于不可操作的错误，返回通用错误消息
    if (req.originalUrl.startsWith('/api/')) {
        return res.status(500).json({
            status: 'error',
            message: '服务器内部错误，请联系管理员'
        });
    }
    
    return res.status(500).render('error', {
        title: '错误',
        message: '服务器内部错误，请稍后再试'
    });
};

/**
 * 处理特定类型的错误
 * @param {Error} err - 错误对象
 * @returns {Error} 处理后的错误对象
 */
const handleSpecificErrors = (err) => {
    // 处理MongoDB唯一索引错误
    if (err.code === 11000) {
        const value = err.errmsg.match(/"([^"]*)"/)[1];
        const message = `该值 '${value}' 已被使用，请选择其他值`;
        return new AppError(message, 400);
    }
    
    // 处理MongoDB验证错误
    if (err.name === 'ValidationError') {
        const errors = Object.values(err.errors).map(el => el.message);
        const message = `输入数据验证失败: ${errors.join('. ')}`;
        return new AppError(message, 400);
    }
    
    // 处理MongoDB错误
    if (err.name === 'CastError') {
        const message = `找不到ID为 ${err.value} 的资源`;
        return new AppError(message, 404);
    }
    
    // 处理文件上传错误
    if (err.name === 'MulterError' || err.message.includes('maxFileSize')) {
        return new AppError('文件上传失败: ' + err.message, 413);
    }
    
    // 如果不是特定类型的错误，返回原始错误
    return err;
};

/**
 * 全局错误处理中间件
 * @param {Error} err - 错误对象
 * @param {Object} req - Express请求对象
 * @param {Object} res - Express响应对象
 * @param {Function} next - 下一个中间件函数
 */
const globalErrorHandler = (err, req, res, next) => {
    // 设置默认错误状态码和消息
    err.statusCode = err.statusCode || 500;
    err.status = err.status || 'error';
    
    // 处理特定类型的错误
    const handledError = handleSpecificErrors(err);
    
    // 根据环境选择不同的错误处理器
    if (process.env.NODE_ENV === 'development') {
        devErrorHandler(handledError, req, res);
    } else {
        prodErrorHandler(handledError, req, res);
    }
};

module.exports = {
    AppError,
    notFoundHandler,
    globalErrorHandler
};