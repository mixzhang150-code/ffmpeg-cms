var ffmpeg = require('fluent-ffmpeg');
var Movie = require('../models/movie');
var Setting = require('../models/setting');
var fs = require('fs');
exports.transcode = function(movie){
var path = movie.path;
var id = movie._id;
var outpath = './public/videos/';
var des = outpath + id;
var videoarr = path.split(".");
videoarr.pop();
var srtpath = videoarr.join(".")+".srt";
fs.exists(des, function(exists){
    if(!exists){
        fs.mkdir(des,function(err) {
            if(err) {
                console.log(err);
            } 
        })
    }
});
ffmpeg.ffprobe(path,function(err,metadata){
    if(err) {
        console.log(err);
    }
    Setting.find()
        .exec(function(err, setting) {
            var wmimage = setting[0].wmpath;
            var hd = setting[0].hd*1;
            var wd = 0;
            var markdir = "./public/mark/mark.png";
            var videometa = metadata.format;
            var videostreams = metadata.streams;
            var bitrate = Math.floor(videometa.bit_rate / 1000);
            var size = "";
            var bv = 500;
            var bufsize = 1000;
            var maxrate = 500;
            var config = [];
            var videooriginH = 0;
            var videooriginC = "";
            var audiooriginC = "";
            var tsjiami = setting[0].tsjiami;
            if(!wmimage || wmimage == "") {
                wmimage = markdir;
            }
            var vf = 'movie=' + wmimage + ' [watermark]; [in][watermark] overlay=main_w-overlay_w [out]';
            if (hd==480) {
                wd = 720;
            } else if (hd==1080) {
                wd = 1920;
                bv = 2000;
                bufsize = 4000;
                maxrate = 2000;
            } else {
                wd = 1280;
                bv = 1000;
                bufsize = 2000;
                maxrate = 1000;
            }
            if(bitrate < bv) {
                bv = bitrate;
                maxrate = bv;
                bufsize = 2*bv;
            }
            for (var i = 0; i < videostreams.length; i++) {
                if (videostreams[i].codec_type == 'video') {
                    if (videostreams[i].height <= hd) {
                        hd = videostreams[i].height;
                    }
                    if (videostreams[i].width <= wd) {
                        wd = videostreams[i].width;
                    }
                    videooriginH = videostreams[i].height;
                    videooriginC = videostreams[i].codec_name;
                    break;
                }
            }
            for (var i = 0; i < videostreams.length; i++) {
                if (videostreams[i].codec_type == 'audio') {
                    audiooriginC = videostreams[i].codec_name;
                    break;
                }
            }
            size = wd + "x" + hd;
            var srtexists = fs.existsSync(srtpath);
            if(srtexists) {
                vf = 'movie=' + wmimage + ' [watermark]; [in][watermark] overlay=main_w-overlay_w,subtitles=' + srtpath + '[out]';
            }
            // 检查是否启用2pass编码（默认启用）
            var enableTwoPass = setting[0].enableTwoPass !== undefined ? setting[0].enableTwoPass : "on";
            
            // 基本配置
            config = [
                '-s ' + size,
                '-b:v ' + bv + "k",
                '-vcodec libx264',
                '-acodec aac',
                '-ac 2',
                '-b:a 128k',
                '-bufsize ' + bufsize + "k",
                '-maxrate ' + maxrate + "k",
                '-q:v 6',
                '-strict -2',
                '-start_number 0',
                '-hls_time 10',
                '-hls_list_size 0',
                '-f hls'
            ];
            if(tsjiami=='on') {
                fs.writeFileSync(des+"/key.info",setting[0].host+"/videos/"+id+"/ts.key\n"+des+"/ts.key");
                var key = randomkey();
                fs.writeFileSync(des+"/ts.key",key);
                var jiamiconfig = '-hls_key_info_file '+des+'/key.info';
                config.push(jiamiconfig);
            }
            if(setting[0].miaoqie == "on") {
                if (videooriginH <= setting[0].hd * 1 && videooriginC == "h264" && audiooriginC == "aac") {
                    if(srtexists) {
                        ffmpegtransandchunk(des, path, config, vf, id);
                    } else {
                        chunk(path, des, id, config, vf, tsjiami);
                    }
                } else {
                    ffmpegtransandchunk(des, path, config, vf, id);
                }
            } else {
                ffmpegtransandchunk(des, path, config, vf, id);
            }
        });
})

}

function ffmpegtransandchunk(des, path, config, vf, id) {
    // 从配置中判断是否启用2pass
    Setting.find()
        .exec(function(err, setting) {
            if(err) {
                console.log(err);
                // 如果获取设置失败，使用默认值
                singlePassTranscode(des, path, config, vf, id);
                return;
            }
            
            var enableTwoPass = setting[0].enableTwoPass !== undefined ? setting[0].enableTwoPass : "on";
            
            if (enableTwoPass === "on") {
                twoPassTranscode(des, path, config, vf, id);
            } else {
                singlePassTranscode(des, path, config, vf, id);
            }
        });
}

// 单通道转码（原有的实现）
function singlePassTranscode(des, path, config, vf, id) {
    ffmpeg(path)
        .addOptions(config)
        .addOption('-vf', vf)
        .output(des + '/index.m3u8')
        .on('start', function () {
            updateMovieStatus(id, "trans&chunk");
        })
        .on('error', function (err, stdout, stderr) {
            console.log('Cannot process video: ' + path + err.message);
        })
        .on('end', function () {
            completeTranscode(path, des, id);
        })
        .run();
}

// 双通道转码实现
function twoPassTranscode(des, path, config, vf, id) {
    // 第一步：收集统计信息
    var firstPassConfig = [...config];
    // 移除输出格式相关参数，替换为null输出
    firstPassConfig = firstPassConfig.filter(option => !option.startsWith('-start_number') && !option.startsWith('-hls_time') && !option.startsWith('-hls_list_size') && !option.startsWith('-f hls'));
    firstPassConfig.push('-pass 1', '-an', '-f null');
    
    // 第二步：实际编码
    var secondPassConfig = [...config];
    secondPassConfig.push('-pass 2');
    
    console.log('开始2pass编码 - 第一阶段');
    updateMovieStatus(id, "trans&chunk_pass1");
    
    // 执行第一阶段
    ffmpeg(path)
        .addOptions(firstPassConfig)
        .addOption('-vf', vf)
        .output('/dev/null') // Unix系统
        .on('error', function(err, stdout, stderr) {
            console.log('2pass第一阶段错误: ' + err.message);
            // 如果/dev/null不存在（Windows系统），尝试使用NUL
            tryTwoPassWithNUL(des, path, config, vf, id);
        })
        .on('end', function() {
            console.log('完成2pass编码 - 第一阶段');
            console.log('开始2pass编码 - 第二阶段');
            updateMovieStatus(id, "trans&chunk_pass2");
            
            // 执行第二阶段
            ffmpeg(path)
                .addOptions(secondPassConfig)
                .addOption('-vf', vf)
                .output(des + '/index.m3u8')
                .on('error', function(err, stdout, stderr) {
                    console.log('2pass第二阶段错误: ' + err.message);
                })
                .on('end', function() {
                    console.log('完成2pass编码 - 第二阶段');
                    // 清理pass文件
                    cleanupPassFiles(des);
                    completeTranscode(path, des, id);
                })
                .run();
        })
        .run();
}

// 在Windows系统上尝试2pass编码（使用NUL代替/dev/null）
function tryTwoPassWithNUL(des, path, config, vf, id) {
    var firstPassConfig = [...config];
    firstPassConfig = firstPassConfig.filter(option => !option.startsWith('-start_number') && !option.startsWith('-hls_time') && !option.startsWith('-hls_list_size') && !option.startsWith('-f hls'));
    firstPassConfig.push('-pass 1', '-an', '-f null');
    
    var secondPassConfig = [...config];
    secondPassConfig.push('-pass 2');
    
    ffmpeg(path)
        .addOptions(firstPassConfig)
        .addOption('-vf', vf)
        .output('NUL') // Windows系统
        .on('end', function() {
            console.log('完成2pass编码 - 第一阶段（Windows）');
            console.log('开始2pass编码 - 第二阶段');
            updateMovieStatus(id, "trans&chunk_pass2");
            
            ffmpeg(path)
                .addOptions(secondPassConfig)
                .addOption('-vf', vf)
                .output(des + '/index.m3u8')
                .on('error', function(err, stdout, stderr) {
                    console.log('2pass第二阶段错误: ' + err.message);
                })
                .on('end', function() {
                    console.log('完成2pass编码 - 第二阶段');
                    cleanupPassFiles(des);
                    completeTranscode(path, des, id);
                })
                .run();
        })
        .run();
}

// 清理pass文件
function cleanupPassFiles(des) {
    try {
        if (fs.existsSync(des + '/ffmpeg2pass-0.log')) {
            fs.unlinkSync(des + '/ffmpeg2pass-0.log');
        }
        if (fs.existsSync(des + '/ffmpeg2pass-0.log.mbtree')) {
            fs.unlinkSync(des + '/ffmpeg2pass-0.log.mbtree');
        }
    } catch (err) {
        console.log('清理pass文件错误: ' + err.message);
    }
}

// 更新电影状态的辅助函数
function updateMovieStatus(id, status) {
    Movie.findOne({ _id: id })
        .exec(function (err, movie) {
            if (err) {
                console.log(err);
                return;
            }
            movie.status = status;
            movie.save(function (err) {
                if (err) console.log(err);
            });
        });
}

// 完成转码的辅助函数
function completeTranscode(path, des, id) {
    screenshots(path, des);
    Movie.findOne({ _id: id })
        .exec(function (err, movie) {
            if (err) {
                console.log(err);
                return;
            }
            movie.status = "finished";
            movie.save(function (err) {
                if (err) console.log(err);
            });
        });
    }
}
function screenshots(path, des) {
    Setting.find()
        .exec(function(err, setting) {
            if(err) {
                console.log(err);
            }
            ffmpeg(path)
                .screenshots({
                    count: setting[0].screenshots,
                    filename: "%i.jpg",
                    folder: des
                })
                .on('end', function () {
                    thumbnails(des, path);
                });
        });  
}
function chunk(path, des, id, config, vf, tsjiami) {
    var chunkconfig = [
        '-c copy',
        '-bsf:v h264_mp4toannexb',
        '-hls_time 10',
        '-strict -2',
        '-start_number 0',
        '-hls_list_size 0'
    ];
    if(tsjiami=='on') {
        chunkconfig.push('-hls_key_info_file '+des+'/key.info');
    }
    ffmpeg(path)
        .addOptions(chunkconfig).output(des + "/index.m3u8")
        .on('end', function () {
            screenshots(path, des);
            Movie.findOne({
                    _id: id
                })
                .exec(function (err, movie) {
                    if (err) {
                        console.log(err);
                    }
                    movie.status = "finished";
                    movie.save(function (err) {
                        console.log(err);
                    })
                })
        })
        .on('error', function (err, stdout, stderr) {
            console.log('Cannot chunk video: ' + path + err.message);
            deleteall(des);
            fs.mkdirSync(des);
            ffmpegtransandchunk(des, path, config, vf, id);
        })
        .on("start", function () {
            Movie.findOne({
                    _id: id
                })
                .exec(function (err, movie) {
                    if (err) {
                        console.log(err);
                    }
                    console.log("chunking");
                    movie.status = "chunking";
                    movie.save(function (err) {
                        console.log(err);
                    })
                });
        })
        .run()
}
function deleteall(path) {
    var files = [];
    if (fs.existsSync(path)) {
        files = fs.readdirSync(path);
        files.forEach(function (file, index) {
            var curPath = path + "/" + file;
            if (fs.statSync(curPath).isDirectory()) { // recurse
                deleteall(curPath);
            } else { // delete file
                fs.unlinkSync(curPath);
            }
        });
        fs.rmdirSync(path);
    }
};
function thumbnails(des, path) {
    var nsg = require('node-sprite-generator');
    var Jimp = require('jimp');
    var tmp = des+'/dplayer-thumbnails';
    var output = des+ '/thumbnails.jpg';
    ffmpeg(path)
            .screenshots({
                count: 100,
                folder: tmp,
                filename: 'screenshot%00i.png',
                size: '160x?'
            })
            .on('end', function () {
                nsg({
                    src: [
                        tmp + '/*.png'
                    ],
                    spritePath: tmp + '/sprite.png',
                    stylesheetPath: tmp + '/sprite.css',
                    layout: 'horizontal',
                    compositor: 'jimp'
                }, function (err) {
                    Jimp.read(tmp + '/sprite.png', function (err, lenna) {
                        if (err) throw err;
                        lenna.quality(parseInt(85))
                            .write(output);
                        fs.unlinkSync(path);
                        deleteall(tmp);
                    });
                });
            });
}
function randomkey() {
    var data = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "a", "b", "c", "d", "e", "f","g","A","B","C","D","E","F","G"];
    for (var j = 0; j < 500; j++) {
        var result = "";
        for (var i = 0; i < 16; i++) {
            r = Math.floor(Math.random() * data.length);

            result += data[r];
        }
        return result;
    }
}