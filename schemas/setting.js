var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var SettingSchema = new Schema({
    host: String,
    hd: String,
    antiurl: [String],
    antiredirect: String,
    antikey: String,
    wmpath: String,
    miaoqie: String,
    screenshots: Number,
    tsjiami: String,
    api: String,
    enableTwoPass: String, // 启用/禁用2pass编码，值为"on"或"off"
    createAt: {
        type: Date,
        default: Date.now()
    }
});
SettingSchema.pre('save', function (next) {
    if (!this.createAt) {
        this.createAt = Date.now();
    }
    next();
});
module.exports = SettingSchema;