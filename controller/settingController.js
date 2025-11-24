var Setting = require('../models/setting');
var Fenfa = require('../models/fenfa');
var Portal = require('../models/portal');
var Player = require('../models/player');
var fs = require('fs');

/**
 * 系统设置页面
 * @param {Object} req - Express请求对象
 * @param {Object} res - Express响应对象
 */
exports.setting = function(req, res) {
    Setting.find()
        .exec(function(err, setting) {
            if(err) {
                console.log(err);
            }
            var newset;
            if(setting.length>0) {
                newset = setting[0];
            } else {
                newset = {
                    host:"",
                    hd: "",
                    antiurl: [""],
                    antiredirect: "https://ffmpeg.moejj.com",
                    antikey: "",
                    wmpath: "./public/mark/mark.png",
                    miaoqie: "",
                    tsjiami: "",
                    api: "",
                    screenshots: 0,
                    enableTwoPass: "on" // 默认启用2pass编码
                }
            }
            Fenfa.find()
                .exec(function(err, fenfa) {
                    if(err) {
                        console.log(err);
                    }
                    var newfenfa;
                    if(fenfa.length>0) {
                        newfenfa = fenfa[0]
                    } else {
                        newfenfa = {
                            kaiguan: "off",
                            domains: [""]
                        }
                    }
                    res.render("setting",{
                        user: req.session.user,
                        title: "云转码设置",
                        setting: newset,
                        fenfa: newfenfa
                    })
                });
        })
}

/**
 * 保存分发设置
 * @param {Object} req - Express请求对象
 * @param {Object} res - Express响应对象
 */
exports.postfenfa = function(req, res) {
    var kaiguan = req.body.kaiguan;
    var domains = req.body.domains;
    if(!kaiguan) {
        kaiguan = "";
    }
    Fenfa.find()
        .exec(function(err, fenfa) {
            if(err) {
                console.log(err);
            }
            console.log(fenfa[0]);
            if(fenfa.length>0) {
                fenfa[0].kaiguan = kaiguan;
                fenfa[0].domains = domains;
                fenfa[0].save(function(err) {
                    if(err) {
                        console.log(err);
                    }
                })
            } else {
                var fenfaobj = {
                    kaiguan: kaiguan,
                    domains: domains
                }
                var newfenfa = new Fenfa(fenfaobj);
                newfenfa.save(function(err) {
                    if(err) {
                        console.log(err);
                    }
                })
            }
            res.redirect("/admin/setting");
        })
}

/**
 * 保存系统设置
 * @param {Object} req - Express请求对象
 * @param {Object} res - Express响应对象
 */
exports.postsetting = function(req, res) {
    var host = req.body.host;
    var hd = req.body.hd;
    var antiurl = req.body.antiurl;
    var antiredirect = req.body.antiredirect;
    var antikey = req.body.key;
    var wmpath = req.body.watermark;
    var miaoqie = req.body.miaoqie;
    var screenshots = req.body.screenshots;
    var tsjiami = req.body.tsjiami;
    var api = req.body.api;
    var enableTwoPass = req.body.enableTwoPass;
    antiurlarr = antiurl.split("|");
    if(!miaoqie) {
        miaoqie = "";
    }
    if(!enableTwoPass) {
        enableTwoPass = "";
    }
    Setting.find()
        .exec(function(err,setting){
            if(err) {
                console.log(err);
            }
            if(setting.length>0){
                setting[0].host = host;
                setting[0].hd = hd;
                setting[0].antikey = antikey;
                setting[0].wmpath = wmpath;
                setting[0].antiurl = antiurlarr;
                setting[0].antiredirect = antiredirect;
                setting[0].miaoqie = miaoqie;
                setting[0].screenshots = screenshots;
                setting[0].tsjiami = tsjiami;
                setting[0].api = api;
                setting[0].enableTwoPass = enableTwoPass;
                setting[0].save(function(err) {
                    if(err) {
                        console.log(err);
                    }
                });
            } else {
                var settingobj = {
                    host: host,
                    hd: hd,
                    antiurl: antiurlarr,
                    antiredirect: antiredirect,
                    antikey: antikey,
                    miaoqie: miaoqie,
                    screenshots: screenshots,
                    wmpath: wmpath,
                    tsjiami: tsjiami,
                    api: api,
                    enableTwoPass: enableTwoPass
                }
                var setting = new Setting(settingobj);
                setting.save(function(err) {
                    if(err) {
                        console.log(err);
                    }
                });
            }
        });
    res.redirect("/admin/setting");
}

/**
 * 门户设置页面
 * @param {Object} req - Express请求对象
 * @param {Object} res - Express响应对象
 */
exports.portal = function(req, res) {
    var portal;
    Portal.find()
        .exec(function(err, portals) {
            if(err) {
                console.log(err);
            }
            if(portals.length>0) {
                portal=portals[0];
            } else {
                portal = {
                    title: '',
                    seotitle: '',
                    kaiguan: '',
                    usersystem: '',
                    host: '',
                    screenshots: 0,
                    keywords: '',
                    description: '',
                    moviestitle: '视频',
                    images: '',
                    imagestitle: '图集',
                    articles: '',
                    articlestitle: '文章',
                    theme: 'default',
                    tongji: ''
                }
            }
            res.render('portal', {
                title: '门户cms设置',
                portal: portal
            })
        });
}

/**
 * 保存门户设置
 * @param {Object} req - Express请求对象
 * @param {Object} res - Express响应对象
 */
exports.postportal = function(req, res) {
    var title = req.body.title;
    var seotitle = req.body.seotitle;
    var keywords = req.body.keywords;
    var kaiguan = req.body.kaiguan;
    var host = req.body.host;
    var screenshots = req.body.screenshots;
    var moviestitle = req.body.moviestitle;
    var description = req.body.description;
    var usersystem = req.body.usersystem;
    var images = req.body.images;
    var imagestitle = req.body.imagestitle;
    var articles = req.body.articles;
    var articlestitle = req.body.articlestitle;
    var theme = req.body.theme;
    var tongji = req.body.tongji;
    Portal.find()
        .exec(function(err, portals) {
            if(err) {
                console.log(err);
            }
            if(portals.length>0) {
                portals[0].screenshots = screenshots;
                portals[0].host = host;
                portals[0].title = title;
                portals[0].seotitle = seotitle;
                portals[0].kaiguan = kaiguan;
                portals[0].usersystem = usersystem;
                portals[0].keywords = keywords;
                portals[0].description = description;
                portals[0].moviestitle = moviestitle;
                portals[0].images = images;
                portals[0].imagestitle = imagestitle;
                portals[0].articles = articles;
                portals[0].articlestitle = articlestitle;
                portals[0].theme = theme,
                portals[0].tongji = tongji;
                portals[0].save(function(err) {
                    if(err) {
                        console.log(err);
                    }
                })
            } else {
                var portalobj = {
                    host: host,
                    screenshots: screenshots,
                    title: title,
                    seotitle: seotitle,
                    keywords: keywords,
                    kaiguan: kaiguan,
                    usersystem: usersystem,
                    description: description,
                    moviestitle: moviestitle,
                    articles: articles,
                    images: images,
                    imagestitle: imagestitle,
                    articlestitle: articlestitle,
                    theme: theme,
                    tongji: tongji
                }
                var newportal = new Portal(portalobj);
                newportal.save(function(err) {
                    if(err) {
                        console.log(err);
                    }
                })
            }
            res.redirect("/admin/portal");
        })
}

/**
 * 播放器设置页面
 * @param {Object} req - Express请求对象
 * @param {Object} res - Express响应对象
 */
exports.bofangqi = function(req, res) {
   var player;
   Player.find()
       .exec(function(err, players) {
           if(err) {
               console.log(err);
           }
           if(players.length>0) {
               player=players[0];
           } else {
               player = {
                   kaiguan: '',
                   mark: '/mark/mark.png',
                   position: 'lefttop',
                   markx: 20,
                   marky: 20,
                   p2p: 'on',
                   waplock: 'on',
                   locktip: '<p style="color:#fff;">请使用qq浏览器观看</p>',
                   font: 'Microsoft Yahei',
                   fontsize: 14,
                   opacity: 0.8,
                   bold: 'on',
                   color: '#701919',
                   text: '云转码express-ffmpeg',
                   wenzikaiguan: 'on',
                   italic: 'on',
                   underline: 'on',
                   link: 'http://ffmpeg.moejj.com',
                   wenziposition: 'lefttop',
                   wenzibackground: '#fff',
                   wenzibackgroundopacity: 0.5,
                   tongji: '',
                   wenzix: 20,
                   wenziy: 20
               }
           }
           res.render('adminplayer', {
               title: '播放器设置',
               player: player
           })
       });
}

/**
 * 保存播放器设置
 * @param {Object} req - Express请求对象
 * @param {Object} res - Express响应对象
 */
exports.postbofangqi = function(req, res) {
    var kaiguan = req.body.kaiguan;
    var position = req.body.position;
    var mark = req.body.watermark;
    var markx = req.body.markx;
    var marky = req.body.marky;
    var p2p = req.body.p2p;
    var wenzikaiguan = req.body.wenzikaiguan;
    var font = req.body.font;
    var fontsize = req.body.fontsize;
    var opacity = req.body.opacity;
    var link = req.body.link;
    var wenziposition = req.body.wenziposition;
    var wenzibackground = req.body.wenzibackground;
    var wenzibackgroundopacity = req.body.wenzibackgroundopacity;
    var wenzix = req.body.wenzix;
    var wenziy = req.body.wenziy;
    var color = req.body.color;
    var bold = req.body.bold;
    var text = req.body.text;
    var italic = req.body.italic;
    var underline = req.body.underline;
    var waplock = req.body.waplock;
    var locktip = req.body.locktip;
    var tongji = req.body.tongji;
    Player.find()
        .exec(function(err, players) {
            if(err) {
                console.log(err);
            }
            if(players.length>0) {
                players[0].kaiguan = kaiguan;
                players[0].mark = mark;
                players[0].position = position;
                players[0].markx = markx;
                players[0].marky = marky;
                players[0].p2p = p2p;
                players[0].waplock = waplock;
                players[0].locktip = locktip;
                players[0].wenzikaiguan = wenzikaiguan;
                players[0].font = font;
                players[0].fontsize = fontsize;
                players[0].opacity = opacity;
                players[0].link = link;
                players[0].wenziposition = wenziposition;
                players[0].wenzibackground = wenzibackground;
                players[0].wenzibackgroundopacity = wenzibackgroundopacity;
                players[0].wenzix = wenzix;
                players[0].wenziy = wenziy;
                players[0].color = color;
                players[0].bold = bold;
                players[0].text = text;
                players[0].italic = italic;
                players[0].underline = underline;
                players[0].tongji = tongji;
                players[0].save(function(err) {
                    if(err) {
                        console.log(err);
                    }
                })
            } else {
                var playerobj = {
                    kaiguan: kaiguan,
                    mark: mark,
                    position: position,
                    markx: markx,
                    marky: marky,
                    p2p: p2p,
                    waplock: waplock,
                    locktip: locktip,
                    text: text,
                    wenzikaiguan: wenzikaiguan,
                    font: font,
                    fontsize: fontsize,
                    opacity: opacity,
                    bold: bold,
                    color: color,
                    underline: underline,
                    italic: italic,
                    link: link,
                    wenziposition: wenziposition,
                    wenzibackground:wenzibackground,
                    wenzibackgroundopacity: wenzibackgroundopacity,
                    wenzix: wenzix,
                    wenziy: wenziy,
                    tongji: tongji
                };
                var newplayer = new Player(playerobj);
                newplayer.save(function(err) {
                    if(err) {
                        console.log(err);
                    }
                })
            }
            res.redirect("/admin/bofangqi");
        })
}