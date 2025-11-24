const bcrypt = require('bcrypt');
const { validationResult } = require('express-validator/check');
const User = require('../models/user');
const Portal = require('../models/portal');

const saltRounds = 10;

/**
 * 用户登录页面
 * @param {Object} req - Express请求对象
 * @param {Object} res - Express响应对象
 */
exports.login = async (req, res) => {
    try {
        const user = req.session.leveluser;
        const portal = await Portal.find().exec();
        
        res.render(req.portal.theme + "/cmslogin", {
            user,
            portal: portal[0],
            title: "用户登陆",
            info: req.flash('info')
        });
    } catch (error) {
        console.error('获取登录页面失败:', error);
        res.status(500).send('服务器内部错误');
    }
}

/**
 * 用户注册页面
 * @param {Object} req - Express请求对象
 * @param {Object} res - Express响应对象
 */
exports.reg = async (req, res) => {
    try {
        const portal = await Portal.find().exec();
        
        res.render(req.portal.theme + '/cmsreg', {
            portal: portal[0],
            title: '用户注册',
            info: req.flash('info')
        });
    } catch (error) {
        console.error('获取注册页面失败:', error);
        res.status(500).send('服务器内部错误');
    }
}

/**
 * 处理用户注册请求
 * @param {Object} req - Express请求对象
 * @param {Object} res - Express响应对象
 */
exports.postreg = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(422).json({
                errors: errors.array()
            });
        }
        
        const { username, email, password } = req.body;
        
        // 使用bcrypt加密密码
        const hash = await bcrypt.hash(password, saltRounds);
        
        const newuserobj = {
            username,
            email,
            password: hash
        };
        
        // 检查用户名是否已存在
        const existingUser = await User.findOne({ username }).exec();
        if (existingUser) {
            req.flash('info', '此用户名已经被注册');
            return res.redirect('/register');
        }
        
        // 检查邮箱是否已存在
        const existingEmail = await User.findOne({ email }).exec();
        if (existingEmail) {
            req.flash('info', '此邮箱已经被注册');
            return res.redirect("/register");
        }
        
        // 创建新用户
        const newuser = new User(newuserobj);
        const savedUser = await newuser.save();
        
        req.session.leveluser = savedUser.username;
        res.redirect('/');
    } catch (error) {
        console.error('注册失败:', error);
        res.redirect('/register');
    }
}

/**
 * 处理用户登录请求
 * @param {Object} req - Express请求对象
 * @param {Object} res - Express响应对象
 */
exports.postlogin = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(422).json({
                errors: errors.array()
            });
        }
        
        const { email, password } = req.body;
        
        // 查找用户
        const user = await User.findOne({ email }).exec();
        if (!user) {
            req.flash('info', '对不起，邮箱或密码错误');
            return res.redirect("/login");
        }
        
        // 使用bcrypt验证密码
        const result = await bcrypt.compare(password, user.password);
        if (!result) {
            req.flash('info', '对不起，邮箱或密码错误');
            return res.redirect("/login");
        }
        
        req.session.leveluser = user.username;
        res.redirect("/");
    } catch (error) {
        console.error('登录失败:', error);
        req.flash('info', '登录时发生错误');
        res.redirect("/login");
    }
}

/**
 * 用户登出
 * @param {Object} req - Express请求对象
 * @param {Object} res - Express响应对象
 */
exports.logout = (req, res) => {
    req.session.leveluser = null;
    res.redirect("/");
}