var Category = require('../models/category');
var Movie = require('../models/movie');

/**
 * 获取分类列表
 * @param {Object} req - Express请求对象
 * @param {Object} res - Express响应对象
 */
exports.getCategories = function(req, res) {
    Category.find()
        .exec(function(err, categories) {
            if(err) {
                console.log(err);
            }
            res.render('categories', {
                title:"分类管理",
                categories: categories
            })
        })
}

/**
 * 删除分类
 * @param {Object} req - Express请求对象
 * @param {Object} res - Express响应对象
 */
exports.delcategory = function(req, res) {
    var id = req.query.id;
    Category.deleteOne({_id: id}, function(err) {
        if(err) {
            console.log(err);
        }
        res.json({success:1});
    })
}

/**
 * 添加分类
 * @param {Object} req - Express请求对象
 * @param {Object} res - Express响应对象
 */
exports.addcategory = function(req, res) {
    var id = req.body.id;
    var inputcategory = req.body.inputcategory;
    var selectcategory = req.body.selectcategory;
    if(selectcategory&&selectcategory!="") {
        Movie.findOne({_id: id})
            .exec(function(err, movie) {
                if(err) {
                    console.log(err);
                }
                movie.category = selectcategory;
                movie.save(function(err) {
                    if(err) {
                        console.log(err);
                    }
                })
            })
    }
    if(inputcategory&&inputcategory!="") {
        var categoryarr = inputcategory.split(",");
        var newcategoryarr = [];
        categoryarr.forEach(element => {
            newcategoryarr.push({title: element});
        });
        Category.insertMany(newcategoryarr, function(err) {
            if(err) {
                console.log(err);
            }
        });
    }
    res.json({
        success:1
    });
}

/**
 * 编辑分类页面
 * @param {Object} req - Express请求对象
 * @param {Object} res - Express响应对象
 */
exports.editcategory = function(req, res) {
    var id = req.params.id;
    Category.findOne({_id: id})
        .exec(function(err, category) {
            if(err) {
                console.log(err);
            }
            res.render('editcategory', {
                title: '编辑分类'+category.title,
                category: category
            })
        })
}

/**
 * 更新分类信息
 * @param {Object} req - Express请求对象
 * @param {Object} res - Express响应对象
 */
exports.posteditcategory = function(req, res) {
    var id = req.params.id;
    var title = req.body.title;
    var antiurl = req.body.antiurl;
    var open = req.body.open;
    console.log(open);
    Category.findOne({_id:id})
        .exec(function(err, category) {
            if(err) {
                console.log(err);
            }
            // 更新所有使用该分类的电影
            Movie.updateMany({category:category.title},{ $set: { category: title }},function(err) {
                if(err) {
                    console.log(err);
                }
            });
            // 更新分类信息
            category.title = title;
            category.antiurl = antiurl;
            category.open = open;
            category.save(function(err) {
                if(err) {
                    console.log(err);
                }
                res.redirect("/admin/categories");
            })
        })
}

/**
 * 批量更新电影分类
 * @param {Object} req - Express请求对象
 * @param {Object} res - Express响应对象
 */
exports.updatecategory = function(req, res) {
    var datas = req.body.datas;
    var datasjson = JSON.parse(datas);
    for (let index = 0; index < datasjson.length; index++) {
        const element = datasjson[index];
        Movie.findOne({_id:element.id})
            .exec(function(err, movie) {
                if(err) {
                    console.log(err);
                }
                movie.category = element.category;
                movie.save(function(err) {
                    if(err) {
                        console.log(err);
                    }
                })
            })
    }
    res.json({
        success: 1
    });
}

/**
 * 为选中的电影设置分类
 * @param {Object} req - Express请求对象
 * @param {Object} res - Express响应对象
 */
exports.selectedcategory = function(req, res) {
    var ids = [];
    var category = req.body.category;
    ids = ids.concat(req.body.idarr);
    for (let index = 0; index < ids.length; index++) {
        const id = ids[index];
        Movie.findOne({_id:id})
            .exec(function(err, movie) {
                if(err) {
                    console.log(err);
                }
                movie.category = category;
                movie.save(function(err) {
                    if(err) {
                        console.log(err);
                    }
                })
            })
    }
    res.json({
        success: 1
    });
}