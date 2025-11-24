var fs = require('fs');
var path = require('path');
var formidable = require('formidable');
var child_process = require('child_process');
var crypto = require('crypto');
var Setting = require('../models/setting');
var Movie = require('../models/movie');

// 允许的视频文件类型
const ALLOWED_VIDEO_TYPES = [
    'video/mp4',
    'video/avi',
    'video/mov',
    'video/wmv',
    'video/rmvb',
    'video/flv',
    'video/mkv',
    'video/webm'
];

// 允许的图片文件类型
const ALLOWED_IMAGE_TYPES = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp'
];

// 允许的字幕文件类型
const ALLOWED_VTT_TYPES = [
    'text/vtt',
    'application/octet-stream' // 有些浏览器可能不识别vtt的MIME类型
];

// 文件大小限制 (500MB)
const MAX_FILE_SIZE = 500 * 1024 * 1024;

/**
 * 验证文件类型是否允许
 * @param {String} mimeType - 文件的MIME类型
 * @param {Array} allowedTypes - 允许的MIME类型数组
 * @returns {Boolean} 是否允许
 */
function validateFileType(mimeType, allowedTypes) {
    return allowedTypes.includes(mimeType);
}

/**
 * 验证文件大小是否符合限制
 * @param {Number} fileSize - 文件大小（字节）
 * @param {Number} maxSize - 最大允许大小（字节）
 * @returns {Boolean} 是否符合限制
 */
function validateFileSize(fileSize, maxSize) {
    return fileSize <= maxSize;
}

/**
 * 处理文件上传，支持分片上传
 * @param {Object} req - Express请求对象
 * @param {Object} res - Express响应对象
 */
exports.postupload = function(req, res) {
    // 从setting中读取配置
    Setting.find().exec(function(err, setting) {
        var newset = setting[0];
        var uploadDir = './public/upload/';
        // 创建必要的目录结构
        if(!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        
        // 使用formidable处理文件上传
        var form = new formidable.IncomingForm();
        form.uploadDir = uploadDir;
        form.keepExtensions = true;
        form.maxFileSize = MAX_FILE_SIZE; // 设置文件大小限制
        
        form.parse(req, function(err, fields, files) {
            if(err) {
                console.error('上传错误:', err);
                // 检查是否是文件大小超过限制的错误
                if (err.message && err.message.includes('maxFileSize')) {
                    return res.json({error: 1, message: '文件大小超过限制，最大允许500MB'});
                }
                return res.json({error: 1, message: '上传失败'});
            }
            
            // 获取表单字段
            var uploadName = fields.name;
            var uploadChunkIndex = parseInt(fields.chunk, 10);
            var uploadChunks = parseInt(fields.chunks, 10);
            
            // 检查文件是否存在
            if (!files || !files.file) {
                return res.json({error: 1, message: '未收到文件'});
            }
            
            // 检查文件扩展名是否允许（对于分片上传，我们只检查文件名）
            const fileExtension = path.extname(uploadName).toLowerCase();
            const allowedVideoExtensions = ['.mp4', '.avi', '.mov', '.wmv', '.rmvb', '.flv', '.mkv', '.webm'];
            
            if (!allowedVideoExtensions.includes(fileExtension)) {
                // 删除已上传的文件
                fs.unlinkSync(files.file.path);
                return res.json({error: 1, message: '不支持的文件类型，仅允许视频文件'});
            }
            
            // 处理分片文件
            var chunksDir = path.join(uploadDir, uploadName + '_chunks');
            if(!fs.existsSync(chunksDir)) {
                fs.mkdirSync(chunksDir, { recursive: true });
            }
            
            // 重命名分片文件
            var chunkPath = path.join(chunksDir, uploadChunkIndex + '.part');
            fs.renameSync(files.file.path, chunkPath);
            
            // 检查是否所有分片都已上传
            var chunkFiles = fs.readdirSync(chunksDir);
            if(chunkFiles.length === uploadChunks) {
                // 合并分片
                var targetPath = path.join(uploadDir, uploadName);
                var writeStream = fs.createWriteStream(targetPath);
                
                mergeChunks(chunkFiles, chunksDir, writeStream, function() {
                    // 合并完成后删除临时目录
                    fs.rmdirSync(chunksDir, { recursive: true });
                    
                    // 返回成功信息
                    res.json({error: 0, message: '上传成功', url: '/upload/' + uploadName});
                });
            } else {
                // 分片上传中
                res.json({error: 0, message: '分片上传成功'});
            }
        });
    });
};

/**
 * 合并文件分片
 * @param {Array} chunkFiles - 分片文件列表
 * @param {String} chunksDir - 分片目录
 * @param {Object} writeStream - 写入流
 * @param {Function} callback - 回调函数
 */
function mergeChunks(chunkFiles, chunksDir, writeStream, callback) {
    // 对分片文件进行排序
    chunkFiles.sort(function(a, b) {
        return parseInt(a.split('.')[0]) - parseInt(b.split('.')[0]);
    });
    
    var index = 0;
    function appendToStream() {
        if(index >= chunkFiles.length) {
            writeStream.end();
            callback();
            return;
        }
        
        var chunkPath = path.join(chunksDir, chunkFiles[index]);
        var readStream = fs.createReadStream(chunkPath);
        
        readStream.on('end', function() {
            index++;
            appendToStream();
        });
        
        readStream.pipe(writeStream, { end: false });
    }
    
    appendToStream();
}

/**
 * 上传水印图片
 * @param {Object} req - Express请求对象
 * @param {Object} res - Express响应对象
 */
exports.uploadwatermark = function(req, res) {
    var form = new formidable.IncomingForm();
    form.uploadDir = './public/mark/';
    form.keepExtensions = true;
    form.maxFileSize = 10 * 1024 * 1024; // 水印图片限制10MB
    
    if(!fs.existsSync('./public/mark/')) {
        fs.mkdirSync('./public/mark/', { recursive: true });
    }
    
    form.parse(req, function(err, fields, files) {
        if(err) {
            console.log('水印上传错误:', err);
            res.redirect('back');
            return;
        }
        
        // 验证文件类型
        if (!files || !files.file) {
            res.redirect('back');
            return;
        }
        
        // 检查文件扩展名
        const fileExtension = path.extname(files.file.name).toLowerCase();
        if (fileExtension !== '.png') {
            // 删除已上传的文件
            fs.unlinkSync(files.file.path);
            res.redirect('back');
            return;
        }
        
        var oldpath = files.file.path;
        var newpath = './public/mark/mark.png';
        
        fs.renameSync(oldpath, newpath);
        
        res.redirect('/admin/setting');
    });
};

/**
 * 上传VTT字幕文件
 * @param {Object} req - Express请求对象
 * @param {Object} res - Express响应对象
 */
exports.uploadvtt = function(req, res) {
    var form = new formidable.IncomingForm();
    form.uploadDir = './public/vtt/';
    form.keepExtensions = true;
    form.maxFileSize = 5 * 1024 * 1024; // 字幕文件限制5MB
    
    if(!fs.existsSync('./public/vtt/')) {
        fs.mkdirSync('./public/vtt/', { recursive: true });
    }
    
    form.parse(req, function(err, fields, files) {
        if(err) {
            console.log('字幕上传错误:', err);
            res.json({success: false, error: err.message});
            return;
        }
        
        // 验证文件类型
        if (!files || !files.file) {
            res.json({success: false, error: '未收到文件'});
            return;
        }
        
        // 检查文件扩展名
        const fileExtension = path.extname(files.file.name).toLowerCase();
        if (fileExtension !== '.vtt') {
            // 删除已上传的文件
            fs.unlinkSync(files.file.path);
            res.json({success: false, error: '不支持的文件类型，仅允许.vtt字幕文件'});
            return;
        }
        
        var filename = files.file.name;
        var oldpath = files.file.path;
        var newpath = './public/vtt/' + filename;
        
        fs.renameSync(oldpath, newpath);
        
        res.json({success: true, filename: filename});
    });
};

/**
 * 上传电影海报
 * @param {Object} req - Express请求对象
 * @param {Object} res - Express响应对象
 */
exports.uploadposter = function(req, res) {
    var form = new formidable.IncomingForm();
    form.uploadDir = './public/posters/';
    form.keepExtensions = true;
    form.maxFileSize = 20 * 1024 * 1024; // 海报图片限制20MB
    
    if(!fs.existsSync('./public/posters/')) {
        fs.mkdirSync('./public/posters/', { recursive: true });
    }
    
    form.parse(req, function(err, fields, files) {
        if(err) {
            console.log('海报上传错误:', err);
            res.json({error: 1, message: '上传失败'});
            return;
        }
        
        // 验证文件类型
        if (!files || !files.file) {
            res.json({error: 1, message: '未收到文件'});
            return;
        }
        
        // 检查文件扩展名
        const fileExt = path.extname(files.file.name).toLowerCase();
        const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
        
        if (!allowedExtensions.includes(fileExt)) {
            // 删除已上传的文件
            fs.unlinkSync(files.file.path);
            res.json({error: 1, message: '不支持的文件类型，仅允许图片文件'});
            return;
        }
        
        var oldpath = files.file.path;
        var timestamp = new Date().getTime();
        var random = Math.floor(Math.random()*1000);
        var newname = timestamp + random + fileExt;
        var newpath = './public/posters/' + newname;
        
        fs.renameSync(oldpath, newpath);
        
        res.json({
            error: 0,
            url: '/posters/' + newname
        });
    });
};

/**
 * 电影入库处理
 * @param {Object} req - Express请求对象
 * @param {Object} res - Express响应对象
 */
exports.ruku = function(req, res) {
    var title = req.body.title;
    var desc = req.body.desc;
    var actor = req.body.actor;
    var director = req.body.director;
    var year = req.body.year;
    var area = req.body.area;
    var category = req.body.category;
    var tags = req.body.tags;
    var poster = req.body.poster;
    var source = req.body.source;
    var type = req.body.type;
    var pan = req.body.pan;
    
    // 生成随机ID
    var id = crypto.randomBytes(4).toString('hex');
    
    // 创建电影记录
    var newmovie = new Movie({
        title: title,
        desc: desc,
        actor: actor,
        director: director,
        year: year,
        area: area,
        category: category,
        tags: tags,
        poster: poster,
        source: source,
        id: id,
        type: type,
        pan: pan,
        time: new Date()
    });
    
    newmovie.save(function(err) {
        if(err) {
            console.log(err);
            res.json({error: 1, message: '保存失败'});
            return;
        }
        
        res.json({error: 0, message: '入库成功', url: '/admin/editmovie?id=' + newmovie._id});
    });
};

/**
 * 视频头部剪切处理
 * @param {Object} req - Express请求对象
 * @param {Object} res - Express响应对象
 */
exports.cuthead = function(req, res) {
    var videopath = req.body.videopath;
    var outputpath = req.body.outputpath;
    var from = req.body.from;
    
    // 使用ffmpeg剪切视频
    var ffmpegCmd = 'ffmpeg -ss ' + from + ' -i "' + videopath + '" -c copy "' + outputpath + '"';
    
    console.log(ffmpegCmd);
    
    child_process.exec(ffmpegCmd, function(err, stdout, stderr) {
        if(err) {
            console.log(err);
            res.json({error: 1, message: '剪切失败'});
            return;
        }
        
        res.json({error: 0, message: '剪切成功'});
    });
};