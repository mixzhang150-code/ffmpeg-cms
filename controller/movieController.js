const Movie = require('../models/movie');
const Category = require('../models/category');
const Setting = require('../models/setting');
const Player = require('../models/player');
const FFmpeghelper = require('../helper/newffmpeg');
const ListsFFmpegHelper = require('../helper/listsffmpeg');
const ffmpegcut = require('../helper/ffmpegcut');
const fs = require('fs');
const async = require('async');
const _ = require('underscore');
const moment = require('moment');

/**
 * 上传电影页面
 * @param {Object} req - Express请求对象
 * @param {Object} res - Express响应对象
 */
exports.getupload = (req, res) => {
    res.render('upload', {
        user: req.session.user,
        title: '上传电影'
    });
}

/**
 * 处理电影上传
 * @param {Object} req - Express请求对象
 * @param {Object} res - Express响应对象
 */
exports.postupload = (req, res) => {
    const file = req.file;
    const body = req.body;
    const des = './movies/';
    const filename = file.originalname;
    const filearr = filename.split('.');
    filearr.pop();
    const path = filearr.join('.');
    const tmppath = des + path;
    
    // 检查并创建临时目录
    if (!fs.existsSync(tmppath)) {
        fs.mkdirSync(tmppath);
    }
    
    const newfilename = filename + body.dzchunkindex;
    fs.renameSync(file.path, tmppath + '/' + newfilename);
    
    // 当所有分片上传完成时，合并文件
    if (parseInt(body.dzchunkindex) + 1 === parseInt(body.dztotalchunkcount)) {
        const files = fs.readdirSync(tmppath);
        
        files.forEach((file, i) => {
            fs.appendFileSync(file.path + '', fs.readFileSync(tmppath + '/' + filename + i));
            fs.unlinkSync(tmppath + '/' + filename + i);
        });
        
        fs.rmdirSync(tmppath);
        
        const movieObj = {
            status: 'waiting',
            originalname: file.originalname,
            path: file.path,
            size: body.dztotalfilesize
        };
        
        const movie = new Movie(movieObj);
        movie.save().catch(err => console.error('保存电影失败:', err));
    }
    
    return res.json({ success: 1 });
}

/**
 * 获取电影列表
 * @param {Object} req - Express请求对象
 * @param {Object} res - Express响应对象
 */
exports.getmovies = function(req, res) {
    var page = req.query.page > 0 ? req.query.page : 1;
    var perPage = req.query.counts>0?req.query.counts*1:10;
    var keyword = req.query.keyword;
    if(keyword&&keyword!=""){
        var reg = /^[A-Za-z0-9]{24}$/;
        if(reg.test(keyword)) {
            Movie
                .find({_id: keyword})
                .exec(function(err, movies) {
                    Category.find()
                        .exec(function(err,categories) {
                            return res.render("movies", {
                                user: req.session.user,
                                title: '搜索结果',
                                movies: movies,
                                categories: categories,
                                page: 1,
                                pages: 1
                            })
                        })
                })
        } else {
            var reg = new RegExp(keyword);
            Movie
                .find({originalname: reg})
                .exec(function(err, movies) {
                    Category.find()
                        .exec(function(err,categories) {
                            return res.render("movies", {
                                user: req.session.user,
                                title: '搜索结果',
                                movies: movies,
                                categories: categories,
                                page: 1,
                                pages: 1
                            })
                        })
                })
        }
    } else {
        var category = req.query.category;
        var search = {};
        if(category&&category!=""){
            search = {category: category};
        }
        Movie
            .find(search)
            .sort('-createAt')
            .limit(perPage)
            .skip(perPage * (page-1))
            .exec(function(err, movies) {
                if(err) {
                    console.log(err);
                }
                async.parallel({
                    all: function(callback) {
                        Movie.find().count(function(err, count) {
                            if(err) {
                                console.log(err);
                            }
                            callback(null, count);
                        })
                    },
                    finished: function(callback) {
                        Movie.find({status: 'finished'})
                            .count(function(err, count) {
                                if(err) {
                                    console.log(err);
                                }
                                callback(null, count);
                            })
                    },
                    waiting: function(callback) {
                        Movie.find({status: 'waiting'})
                            .count(function(err, count) {
                                if(err) {
                                    console.log(err);
                                }
                                callback(null,count);
                            })
                    },
                    categories: function(callback) {
                        Category.find()
                            .exec(function(err, categories) {
                                if(err) {
                                    console.log(err);
                                }
                                callback(null, categories);
                            })
                    }
                }, function(err,results) {
                    if(err) {
                        console.log(err);
                    }
                    res.render("movies", {
                        user: req.session.user,
                        title: "全部电影库",
                        movies: movies,
                        categories: results.categories,
                        page: page,
                        all: results.all,
                        finished: results.finished,
                        waiting: results.waiting,
                        pages: Math.ceil(results.all / perPage)
                    })
                })
            })
    }
}

/**
 * 获取电影详情
 * @param {Object} req - Express请求对象
 * @param {Object} res - Express响应对象
 */
exports.getmovie = function(req, res) {
    var id = req.params.id;
    async.parallel({
        movie: function(callback) {
            Movie.findOneAndUpdate({
                _id: id
            }, {
                $inc: {
                    count: 1
                }
            })
                .exec(function(err,movie){
                    if(err) {
                        console.log(err);
                    }
                    callback(null, movie);
                });
        },
        setting: function(callback) {
            Setting.find()
                .exec(function(err, setting){
                    if(err) {
                        console.log(err);
                    }
                    callback(null, setting[0]);
                })
        },
        player: function(callback) {
            Player.find()
                .exec(function(err, players) {
                    if(err) {
                        console.log(err);
                    }
                    callback(null, players[0]);
                });
        }
    }, function(err,results) {
        if(err) {
            console.log(err);
        }
        if(!results.movie) {
            res.statusCode = 404;
            return res.send("对不起，此页面不存在");
        }
        var waplock = true;
        if(results.player.waplock == 'on') {
            var agent = req.headers["user-agent"].toLowerCase();
            var phoneviewer = agent.match(/(iphone|ipod|ipad|android)/);
            var browser = agent.match(/mqqbrowser/);
            if(phoneviewer) {
                if(browser) {
                    waplock = false;
                }
            }
        }
        Category.findOne({title: results.movie.category})
            .exec(function(err, category) {
                if(err) {
                    console.log(err);
                }
                var categoryanti = "";
                var open = "";
                if(category) {
                    categoryanti = category.antiurl?category.antiurl:"";
                    open = category.open?category.open:"";
                }
                var rgba = colorRgba(results.player.wenzibackground, results.player.wenzibackgroundopacity);
                if (results.setting.antikey!=""){
                    cache.getTokenByRedis(function(err, token){
                        if(err) {
                            console.log(err);
                        }
                        res.render("movie",{
                            level:req.level,
                            title: results.movie.originalname+"在线播放",
                            id:id,
                            token: token,
                            poster: results.movie.poster,
                            phoneviewer: phoneviewer,
                            antiredirect: results.setting.antiredirect,
                            waplock: waplock,
                            player: results.player,
                            rgba: rgba,
                            antiurl: results.setting.antiurl,
                            categoryanti: categoryanti,
                            open: open
                        })
                    })
                } else {
                    res.render("movie",{
                        level:req.level,
                        title: results.movie.originalname+"在线播放",
                        id:id,
                        token: '',
                        poster: results.movie.poster,
                        phoneviewer: phoneviewer,
                        antiredirect: results.setting.antiredirect,
                        waplock: waplock,
                        player: results.player,
                        rgba: rgba,
                        antiurl: results.setting.antiurl,
                        categoryanti: categoryanti,
                        open: open
                    })
                }
            })
    });
}

/**
 * 转码电影
 * @param {Object} req - Express请求对象
 * @param {Object} res - Express响应对象
 */
exports.transcode = function(req, res) {
    Movie
        .find({status:"waiting"})
        .exec(function(err, movies){
            if(err){
                console.log(err);
            }
            for (let i = 0; i < movies.length; i++) {
                FFmpeghelper.transcode(movies[i]);
            }
            res.json({
                success: 1
            });
        })
}

/**
 * 批量转码
 * @param {Object} req - Express请求对象
 * @param {Object} res - Express响应对象
 */
exports.listszhuanma = function(req, res) {
    ListsFFmpegHelper.transcode();
    res.json({
        success:1
    })
}

/**
 * 删除电影
 * @param {Object} req - Express请求对象
 * @param {Object} res - Express响应对象
 */
exports.delete = async (req, res) => {
    try {
        const { id } = req.query;
        const movie = await Movie.findOne({ _id: id }).exec();
        
        if (!movie) {
            return res.json({ success: 0, message: '电影不存在' });
        }
        
        // 删除电影记录
        await movie.remove();
        
        // 删除电影文件
        if (movie.path && fs.existsSync(movie.path)) {
            fs.unlinkSync(movie.path);
        }
        
        // 删除视频目录
        deleteall(`./public/videos/${id}`);
        
        res.json({ success: 1 });
    } catch (error) {
        console.error('删除电影失败:', error);
        res.json({ success: 0, message: '删除失败' });
    }
}

/**
 * 编辑电影信息
 * @param {Object} req - Express请求对象
 * @param {Object} res - Express响应对象
 */
exports.editmovie = async (req, res) => {
    try {
        const { id } = req.params;
        const movie = await Movie.findOne({ _id: id }).exec();
        
        res.render('editmovie', {
            title: '修改电影标题',
            movie
        });
    } catch (error) {
        console.error('获取电影编辑页面失败:', error);
        res.status(500).render('error', {
            message: '服务器内部错误',
            error
        });
    }
}

/**
 * 更新电影信息
 * @param {Object} req - Express请求对象
 * @param {Object} res - Express响应对象
 */
exports.postupdatemovie = async (req, res) => {
    try {
        const { id } = req.params;
        const { originalname } = req.body;
        
        const movie = await Movie.findOne({ _id: id }).exec();
        if (!movie) {
            return res.status(404).render('error', {
                message: '电影不存在',
                error: { status: 404 }
            });
        }
        
        movie.originalname = originalname;
        await movie.save();
        
        res.redirect('/admin/movies');
    } catch (error) {
        console.error('更新电影失败:', error);
        res.status(500).render('error', {
            message: '服务器内部错误',
            error
        });
    }
}

/**
 * 处理颜色转换
 * @param {string} str - 颜色字符串
 * @param {number} n - 透明度
 * @returns {string} - RGBA颜色值
 */
const colorRgba = (str, n) => {
    //十六进制颜色值的正则表达式
    var reg = /^#([0-9a-fA-f]{3}|[0-9a-fA-f]{6})$/;
    var sColor = str.toLowerCase();
    //十六进制颜色转换为RGB格式  
    if(sColor && reg.test(sColor)){  
        if(sColor.length === 4){
            var sColorNew = "#";  
            for(var i=1; i<4; i+=1){  //例如：#eee,#fff等
                sColorNew += sColor.slice(i,i+1).concat(sColor.slice(i,i+1));     
            }  
            sColor = sColorNew;  
        }
        //处理六位颜色值  
        var sColorChange = [];  
        for(var i=1; i<7; i+=2){  
            sColorChange.push(parseInt("0x"+sColor.slice(i,i+2)));    
        }
        return "rgba(" + sColorChange.join(",") + ","+n+")"; 
    }else{  
        return sColor;    
    }
}

/**
 * 递归删除目录
 * @param {string} path - 目录路径
 */
const deleteall = (path) => {
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