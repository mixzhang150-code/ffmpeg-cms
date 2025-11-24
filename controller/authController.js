var bcrypt = require('bcrypt');
const saltRounds = 10;
var User = require('../models/user');
var Portal = require('../models/portal');
const { validationResult } = require('express-validator/check');

/**
 * 用户登录页面
 * @param {Object} req - Express请求对象
 * @param {Object} res - Express响应对象
 */
exports.login = function(req, res) {
    var user = req.session.leveluser;
    Portal.find()
        .exec(function(err, portal) {
            if(err) {
                console.log(err);
            }
            res.render(req.portal.theme+"/cmslogin", {
                user: user,
                portal: portal[0],
                title: "用户登陆",
                info: req.flash('info')
            })
        })
}

/**
 * 用户注册页面
 * @param {Object} req - Express请求对象
 * @param {Object} res - Express响应对象
 */
exports.reg = function(req, res) {
    Portal.find()
        .exec(function(err, portal) {
            if(err) {
                console.log(err);
            }
            res.render(req.portal.theme+'/cmsreg', {
                portal: portal[0],
                title: '用户注册',
                info: req.flash('info')
            })
        })
}

/**
 * 处理用户注册请求
 * @param {Object} req - Express请求对象
 * @param {Object} res - Express响应对象
 */
exports.postreg = function(req, res) {
    const errors = validationResult(req);
    if(!errors.isEmpty()) {
        return res.status(422).json({
            errors: errors.array()
        });
    }
    var username = req.body.username;
    var email = req.body.email;
    // 使用bcrypt加密密码
    bcrypt.hash(req.body.password, saltRounds, function(err, hash) {
        if (err) {
            console.error('密码加密失败:', err);
            res.redirect('/register');
            return;
        }
        var newuserobj = {
            username: username,
            email: email,
            password: hash
        }
    User.findOne({username: username})
        .exec(function(err,user) {
            if(err) {
                console.log(err);
            }
            if(user) {
                req.flash('info', '此用户名已经被注册');
                return res.redirect('/register');
            }
            User.findOne({email: email})
                .exec(function(err, user) {
                    if(err) {
                        console.log(err);
                    }
                    if(user) {
                        req.flash('info', '此邮箱已经被注册');
                        return res.redirect("/register");
                    }
                    var newuser = new User(newuserobj);
                    newuser.save(function(err,user) {
                        if(err) {
                            console.log(err);
                        }
                        req.session.leveluser = user.username;
                        res.redirect('/');
                    });
                })
        });
    });
}

/**
 * 处理用户登录请求
 * @param {Object} req - Express请求对象
 * @param {Object} res - Express响应对象
 */
exports.postlogin = function(req, res) {
    const errors = validationResult(req);
    if(!errors.isEmpty()) {
        return res.status(422).json({
            errors: errors.array()
        });
    }
    var email = req.body.email;
    User.findOne({email:email})
        .exec(function(err,user){
            if(err) {
                console.log(err);
            }
            if(!user) {
                req.flash('info','对不起，邮箱或密码错误');
                return res.redirect("/login");
            }
            // 使用bcrypt验证密码
            bcrypt.compare(req.body.password, user.password, function(err, result) {
                if (err || !result) {
                    req.flash('info','对不起，邮箱或密码错误');
                    return res.redirect("/login");
                }
                req.session.leveluser = user.username;
                res.redirect("/");
            });
        });
}

/**
 * 用户登出
 * @param {Object} req - Express请求对象
 * @param {Object} res - Express响应对象
 */
exports.logout = function(req, res) {
    req.session.leveluser = null;
    res.redirect("/");
}