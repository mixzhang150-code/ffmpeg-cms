var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var UserSchema = new Schema({
    username: {
        type: String,
        required: true,
        unique: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
        // 注意：密码使用bcrypt加密存储，不要直接存储明文密码
    },
    level: {
        type: Number,
        default: 1
    },
    duedate: Date,
    createAt: {
        type: Date
    }
});
UserSchema.pre('save', function (next) {
    if (!this.createAt) {
        this.createAt = Date.now();
    }
    // 注意：密码加密在控制器中处理，使用bcrypt库
    next();
});

/**
 * 注意事项：
 * 1. 密码字段存储的是bcrypt加密后的哈希值
 * 2. 验证密码时请使用bcrypt.compare()方法
 * 3. 永远不要尝试存储明文密码或使用简单哈希算法
 */
module.exports = UserSchema;